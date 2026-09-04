import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ActionStatus, AuditActor, Prisma, RecoveryCaseStatus, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const paidEvents = new Set(["payment.captured", "order.paid", "payment_link.paid", "subscription.charged", "invoice.paid"]);

export function verifyWebhookSignature(rawBody: string, signature: string | null, secret = process.env.RAZORPAY_WEBHOOK_SECRET) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = Buffer.from(signature, "utf8");
  const calculated = Buffer.from(expected, "utf8");
  return provided.length === calculated.length && timingSafeEqual(provided, calculated);
}

export function invalidEventId(rawBody: string, signature: string | null) {
  return `invalid_${createHash("sha256").update(`${signature ?? ""}:${rawBody}`).digest("hex")}`;
}

function entity(payload: Record<string, unknown>, key: string) {
  const value = payload.payload;
  if (!value || typeof value !== "object") return {};
  const item = (value as Record<string, unknown>)[key];
  return item && typeof item === "object" ? item as Record<string, unknown> : {};
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
}

export async function processRazorpayWebhook(input: { rawBody: string; signature: string | null; eventId: string | null }) {
  const payload = JSON.parse(input.rawBody) as Record<string, unknown>;
  const eventType = typeof payload.event === "string" ? payload.event : "unknown";
  const externalEventId = input.eventId?.trim() || invalidEventId(input.rawBody, input.signature);
  const signatureVerified = verifyWebhookSignature(input.rawBody, input.signature);
  let storedEvent;

  try {
    storedEvent = await prisma.webhookEvent.create({ data: { provider: "RAZORPAY", externalEventId, eventType, payload: payload as Prisma.InputJsonValue, signatureVerified } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { duplicate: true, processed: false };
    throw error;
  }

  if (!signatureVerified) {
    await prisma.webhookEvent.update({ where: { id: storedEvent.id }, data: { processingError: "Signature verification failed." } });
    throw new Error("INVALID_SIGNATURE");
  }

  if (!paidEvents.has(eventType)) {
    await prisma.webhookEvent.update({ where: { id: storedEvent.id }, data: { processedAt: new Date() } });
    return { duplicate: false, processed: false };
  }

  try {
    const paymentLink = entity(payload, "payment_link");
    const payment = entity(payload, "payment");
    const order = entity(payload, "order");
    const subscription = entity(payload, "subscription");
    const invoice = entity(payload, "invoice");
    const paymentLinkId = typeof paymentLink.id === "string" ? paymentLink.id : typeof payment.payment_link_id === "string" ? payment.payment_link_id : null;
    const paymentId = typeof payment.id === "string" ? payment.id : null;
    const orderId = typeof order.id === "string" ? order.id : typeof payment.order_id === "string" ? payment.order_id : null;
    const referenceId = typeof paymentLink.reference_id === "string" ? paymentLink.reference_id : typeof order.receipt === "string" ? order.receipt : null;
    const amountPaise = numberValue(paymentLink.amount_paid) ?? numberValue(paymentLink.amount) ?? numberValue(payment.amount) ?? numberValue(order.amount_paid) ?? numberValue(order.amount) ?? numberValue(subscription.amount) ?? numberValue(invoice.amount);

    await prisma.$transaction(async (database) => {
      const recoveryCase = await database.recoveryCase.findFirst({
        where: { OR: [
          ...(paymentLinkId ? [{ paymentLinkId }] : []),
          ...(paymentId ? [{ transaction: { razorpayPaymentId: paymentId } }] : []),
          ...(orderId ? [{ transaction: { razorpayOrderId: orderId } }] : []),
          ...(referenceId ? [{ caseNumber: referenceId }, { caseNumber: referenceId.replace(/^recoverai_/, "").split("_")[0] }] : []),
        ] },
        include: { transaction: true },
      });
      if (!recoveryCase) return;
      if (amountPaise !== null && amountPaise !== recoveryCase.transaction.amountPaise) throw new Error("PAYMENT_AMOUNT_MISMATCH");
      if (recoveryCase.status === RecoveryCaseStatus.RECOVERED || recoveryCase.transaction.status === TransactionStatus.PAID) return;

      await database.transaction.update({ where: { id: recoveryCase.transactionId }, data: { status: TransactionStatus.PAID, razorpayPaymentId: paymentId ?? undefined, razorpayOrderId: orderId ?? undefined } });
      await database.recoveryCase.update({ where: { id: recoveryCase.id }, data: { status: RecoveryCaseStatus.RECOVERED, recoveredAmountPaise: recoveryCase.transaction.amountPaise, recoveredAt: new Date(), nextActionAt: null } });
      await database.recoveryAction.updateMany({ where: { recoveryCaseId: recoveryCase.id, status: { in: [ActionStatus.PENDING, ActionStatus.APPROVED] } }, data: { status: ActionStatus.CANCELLED, failureMessage: "Cancelled after verified payment." } });
      await database.auditLog.create({ data: { recoveryCaseId: recoveryCase.id, eventType: "PAYMENT_VERIFIED", actor: AuditActor.RAZORPAY, decision: "Verified provider payment; recovery stopped.", inputSnapshot: { eventType, paymentLinkId, paymentId, orderId }, outputSnapshot: { status: RecoveryCaseStatus.RECOVERED, recoveredAmountPaise: recoveryCase.transaction.amountPaise }, policyVersion: "2026-09-01" } });
    });
    await prisma.webhookEvent.update({ where: { id: storedEvent.id }, data: { processedAt: new Date() } });
    return { duplicate: false, processed: true };
  } catch (error) {
    await prisma.webhookEvent.update({ where: { id: storedEvent.id }, data: { processingError: error instanceof Error && error.message === "PAYMENT_AMOUNT_MISMATCH" ? "Payment amount did not match the recovery case." : "Webhook processing failed." } });
    throw error;
  }
}
