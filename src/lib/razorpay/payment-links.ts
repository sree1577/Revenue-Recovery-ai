import { randomUUID } from "node:crypto";
import { ActionStatus, ActionType, AuditActor, RecoveryCaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { getRecoveryCase } from "@/lib/recovery-cases";

export type PaymentLinkResult = {
  paymentLinkId: string;
  paymentLinkUrl: string;
  expiresAt: string;
  simulated: boolean;
  reused: boolean;
};

function isFuture(value: Date | null) {
  return Boolean(value && value.getTime() > Date.now());
}

function demoLink(caseNumber: string): PaymentLinkResult {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return {
    paymentLinkId: `sim_${caseNumber.toLowerCase()}_${randomUUID().slice(0, 8)}`,
    paymentLinkUrl: `https://demo.recoverai.test/payment/${encodeURIComponent(caseNumber)}`,
    expiresAt: expiresAt.toISOString(),
    simulated: true,
    reused: false,
  };
}

export async function createPaymentLink(caseId: string): Promise<PaymentLinkResult> {
  if (!process.env.DATABASE_URL && process.env.DEMO_MODE === "true") {
    const demoCase = await getRecoveryCase(caseId);
    if (!demoCase) throw new Error("CASE_NOT_FOUND");
    if (demoCase.status === "RECOVERED") throw new Error("CASE_RECOVERED");
    if (demoCase.status === "STOPPED") throw new Error("CASE_STOPPED");
    if (demoCase.requiresApproval) throw new Error("APPROVAL_REQUIRED");
    return demoLink(demoCase.caseNumber);
  }
  const existingCase = await prisma.recoveryCase.findFirst({ where: { OR: [{ id: caseId }, { caseNumber: caseId }] }, include: { transaction: { include: { customer: true } } } });
  if (!existingCase) throw new Error("CASE_NOT_FOUND");
  if (existingCase.status === RecoveryCaseStatus.RECOVERED) throw new Error("CASE_RECOVERED");
  if (existingCase.status === RecoveryCaseStatus.STOPPED || existingCase.status === RecoveryCaseStatus.EXPIRED) throw new Error("CASE_STOPPED");
  if (existingCase.requiresApproval && !existingCase.approvedAt) throw new Error("APPROVAL_REQUIRED");
  if (existingCase.paymentLinkId && existingCase.paymentLinkUrl && isFuture(existingCase.paymentLinkExpiresAt)) {
    return { paymentLinkId: existingCase.paymentLinkId, paymentLinkUrl: existingCase.paymentLinkUrl, expiresAt: existingCase.paymentLinkExpiresAt!.toISOString(), simulated: existingCase.paymentLinkId.startsWith("sim_"), reused: true };
  }

  const client = getRazorpayClient();
  if (!client) {
    if (process.env.DEMO_MODE !== "true") throw new Error("RAZORPAY_NOT_CONFIGURED");
    const simulated = demoLink(existingCase.caseNumber);
    await prisma.$transaction(async (database) => {
      await database.recoveryCase.update({ where: { id: existingCase.id }, data: { status: RecoveryCaseStatus.PAYMENT_LINK_CREATED, paymentLinkId: simulated.paymentLinkId, paymentLinkUrl: simulated.paymentLinkUrl, paymentLinkExpiresAt: new Date(simulated.expiresAt) } });
      await database.recoveryAction.create({ data: { recoveryCaseId: existingCase.id, type: ActionType.CREATE_PAYMENT_LINK, status: ActionStatus.SIMULATED, channel: "RAZORPAY_TEST", scheduledAt: new Date(), executedAt: new Date(), idempotencyKey: `payment-link:${existingCase.id}:${simulated.paymentLinkId}` } });
      await database.auditLog.create({ data: { recoveryCaseId: existingCase.id, eventType: "PAYMENT_LINK_CREATED", actor: AuditActor.SYSTEM, decision: "Simulated payment link created in demo mode.", outputSnapshot: { simulated: true, paymentLinkId: simulated.paymentLinkId, expiresAt: simulated.expiresAt }, policyVersion: "2026-09-01" } });
    });
    return simulated;
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const referenceId = `recoverai_${existingCase.caseNumber}_${randomUUID().slice(0, 8)}`;
  const paymentLink = await client.paymentLink.create({
    amount: existingCase.transaction.amountPaise,
    currency: "INR",
    accept_partial: false,
    reference_id: referenceId,
    description: `Payment recovery for ${existingCase.caseNumber}`,
    customer: { name: existingCase.transaction.customer.name, email: existingCase.transaction.customer.email ?? undefined, contact: existingCase.transaction.customer.phone ?? undefined },
    expire_by: Math.floor(expiresAt.getTime() / 1000),
    reminder_enable: false,
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/cases/${encodeURIComponent(existingCase.caseNumber)}`,
    callback_method: "get",
  });
  const result: PaymentLinkResult = { paymentLinkId: paymentLink.id, paymentLinkUrl: paymentLink.short_url, expiresAt: new Date((paymentLink.expire_by ?? Math.floor(expiresAt.getTime() / 1000)) * 1000).toISOString(), simulated: false, reused: false };
  await prisma.$transaction(async (database) => {
    await database.recoveryCase.update({ where: { id: existingCase.id }, data: { status: RecoveryCaseStatus.PAYMENT_LINK_CREATED, paymentLinkId: result.paymentLinkId, paymentLinkUrl: result.paymentLinkUrl, paymentLinkExpiresAt: new Date(result.expiresAt) } });
    await database.recoveryAction.create({ data: { recoveryCaseId: existingCase.id, type: ActionType.CREATE_PAYMENT_LINK, status: ActionStatus.EXECUTED, channel: "RAZORPAY_TEST", scheduledAt: new Date(), executedAt: new Date(), idempotencyKey: `payment-link:${existingCase.id}:${result.paymentLinkId}` } });
    await database.auditLog.create({ data: { recoveryCaseId: existingCase.id, eventType: "PAYMENT_LINK_CREATED", actor: AuditActor.SYSTEM, decision: "Razorpay Test Mode payment link created.", outputSnapshot: { simulated: false, paymentLinkId: result.paymentLinkId, expiresAt: result.expiresAt }, policyVersion: "2026-09-01" } });
  });
  return result;
}
