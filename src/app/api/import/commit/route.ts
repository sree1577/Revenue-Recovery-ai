import { randomUUID } from "node:crypto";
import { ActionStatus, ActionType, AuditActor, Prisma, RecoveryCaseStatus, TransactionStatus } from "@prisma/client";
import { z } from "zod";
import { normalizedImportRowSchema } from "@/lib/import/csv";
import { prisma } from "@/lib/prisma";
import { analyzeTransaction } from "@/lib/recovery-agent";

const requestSchema = z.object({ rows: z.array(normalizedImportRowSchema).min(1).max(10_000) });

function getActionType(action: string, stopped: boolean) {
  if (stopped) return ActionType.STOP;
  if (action.toLowerCase().includes("link")) return ActionType.CREATE_PAYMENT_LINK;
  if (action.toLowerCase().includes("reminder")) return ActionType.SEND_EMAIL;
  if (action.toLowerCase().includes("wait")) return ActionType.WAIT;
  return ActionType.REQUEST_ALTERNATIVE_METHOD;
}

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ success: false, data: null, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "The import confirmation payload is invalid.", 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_IMPORT_ROWS", "The import data failed server validation.", 400);

  const seen = new Set<string>();
  const duplicateRequestRows = parsed.data.rows.filter((row) => {
    if (seen.has(row.externalTransactionId)) return true;
    seen.add(row.externalTransactionId);
    return false;
  });
  if (duplicateRequestRows.length > 0) return errorResponse("DUPLICATE_IMPORT_ROWS", "The confirmation contains duplicate transaction IDs.", 400);

  try {
    const result = await prisma.$transaction(async (database) => {
      const imported: string[] = [];
      const duplicates: string[] = [];
      for (const row of parsed.data.rows) {
        const existing = await database.transaction.findUnique({ where: { externalTransactionId: row.externalTransactionId } });
        if (existing) {
          duplicates.push(row.externalTransactionId);
          continue;
        }

        const customer = await database.customer.findFirst({ where: { email: row.email } });
        const savedCustomer = customer
          ? await database.customer.update({
              where: { id: customer.id },
              data: { name: row.customerName, phone: row.phone, consentEmail: row.consentEmail, consentSms: row.consentSms, consentWhatsApp: row.consentWhatsApp },
            })
          : await database.customer.create({
              data: { name: row.customerName, email: row.email, phone: row.phone, consentEmail: row.consentEmail, consentSms: row.consentSms, consentWhatsApp: row.consentWhatsApp },
            });

        const transaction = await database.transaction.create({
          data: {
            externalTransactionId: row.externalTransactionId,
            customerId: savedCustomer.id,
            amountPaise: row.amountPaise,
            currency: "INR",
            paymentMethod: row.paymentMethod,
            status: TransactionStatus.FAILED,
            errorCode: row.errorCode,
            errorStep: row.errorStep,
            errorReason: row.failureReason,
            errorSource: row.errorSource,
            attemptCount: row.attempts,
            occurredAt: new Date(row.occurredAt),
          },
        });
        const decision = analyzeTransaction({
          id: row.externalTransactionId,
          customer: row.customerName,
          amount: row.amountPaise / 100,
          method: row.paymentMethod,
          failureReason: row.failureReason,
          attempts: row.attempts,
          previousSuccesses: row.previousSuccesses,
          consent: row.consentEmail || row.consentSms || row.consentWhatsApp,
          doNotContact: savedCustomer.doNotContact,
        });
        const caseStatus = decision.stopped ? RecoveryCaseStatus.STOPPED : decision.requiresApproval ? RecoveryCaseStatus.AWAITING_APPROVAL : RecoveryCaseStatus.ANALYZED;
        const recoveryCase = await database.recoveryCase.create({
          data: {
            caseNumber: `RCV-${randomUUID().slice(0, 8).toUpperCase()}`,
            transactionId: transaction.id,
            status: caseStatus,
            priorityScore: decision.score,
            recoveryProbability: decision.probability,
            failureCategory: row.failureReason,
            recommendedAction: decision.action,
            recommendedChannel: row.consentEmail ? "EMAIL" : row.consentSms ? "SMS" : row.consentWhatsApp ? "WHATSAPP" : null,
            recommendedDelayMinutes: decision.delayMinutes,
            decisionExplanation: decision.explanation,
            requiresApproval: decision.requiresApproval,
            stoppedAt: decision.stopped ? new Date() : null,
            stopReason: decision.stopped ? decision.explanation : null,
            maxRecoveryAttempts: Number(process.env.MAX_RECOVERY_ATTEMPTS ?? 3),
            nextActionAt: decision.stopped ? null : new Date(Date.now() + decision.delayMinutes * 60_000),
          },
        });
        await database.recoveryAction.create({
          data: {
            recoveryCaseId: recoveryCase.id,
            type: getActionType(decision.action, decision.stopped),
            status: decision.stopped ? ActionStatus.CANCELLED : ActionStatus.PENDING,
            channel: recoveryCase.recommendedChannel,
            scheduledAt: recoveryCase.nextActionAt,
            idempotencyKey: `initial:${recoveryCase.id}`,
          },
        });
        await database.auditLog.create({
          data: {
            recoveryCaseId: recoveryCase.id,
            eventType: "CASE_ANALYZED",
            actor: AuditActor.AGENT,
            decision: decision.action,
            inputSnapshot: { transactionId: row.externalTransactionId, amountPaise: row.amountPaise, failureCategory: row.failureReason, attempts: row.attempts },
            outputSnapshot: { priorityScore: decision.score, recoveryProbability: decision.probability, stopped: decision.stopped, requiresApproval: decision.requiresApproval },
            policyVersion: "2026-09-01",
          },
        });
        imported.push(recoveryCase.caseNumber);
      }
      return { imported, duplicates };
    });
    return Response.json({ success: true, data: result, error: null });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientInitializationError) return errorResponse("DATABASE_UNAVAILABLE", "Database persistence is unavailable. Check DATABASE_URL and try again.", 503);
    return errorResponse("IMPORT_COMMIT_FAILED", "The import could not be saved. No partial changes were committed.", 500);
  }
}
