import { prisma } from "@/lib/prisma";
import { demoCases } from "@/lib/demo-data";

export type RecoveryCaseSummary = {
  id: string;
  caseNumber: string;
  customer: string;
  email: string | null;
  amountPaise: number;
  paymentMethod: string;
  failureReason: string;
  priorityScore: number;
  recoveryProbability: number;
  recommendedAction: string;
  attempts: number;
  status: string;
  nextActionAt: string | null;
  requiresApproval: boolean;
  demo: boolean;
};

function demoSummary(item: (typeof demoCases)[number]): RecoveryCaseSummary {
  return {
    id: item.transaction.id,
    caseNumber: item.transaction.id,
    customer: item.transaction.customer,
    email: null,
    amountPaise: Math.round(item.transaction.amount * 100),
    paymentMethod: item.transaction.method,
    failureReason: item.transaction.failureReason,
    priorityScore: item.decision.score,
    recoveryProbability: item.decision.probability,
    recommendedAction: item.decision.action,
    attempts: item.transaction.attempts,
    status: item.decision.stopped ? "STOPPED" : item.decision.requiresApproval ? "AWAITING_APPROVAL" : "ANALYZED",
    nextActionAt: item.decision.stopped ? null : new Date(Date.now() + item.decision.delayMinutes * 60_000).toISOString(),
    requiresApproval: item.decision.requiresApproval,
    demo: true,
  };
}

export async function listRecoveryCases(): Promise<{ cases: RecoveryCaseSummary[]; demo: boolean }> {
  try {
    const cases = await prisma.recoveryCase.findMany({
      include: { transaction: { include: { customer: true } } },
      orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    });
    return {
      demo: false,
      cases: cases.map((item) => ({
        id: item.id,
        caseNumber: item.caseNumber,
        customer: item.transaction.customer.name,
        email: item.transaction.customer.email,
        amountPaise: item.transaction.amountPaise,
        paymentMethod: item.transaction.paymentMethod,
        failureReason: item.failureCategory,
        priorityScore: item.priorityScore,
        recoveryProbability: item.recoveryProbability,
        recommendedAction: item.recommendedAction,
        attempts: item.recoveryAttemptCount,
        status: item.status,
        nextActionAt: item.nextActionAt?.toISOString() ?? null,
        requiresApproval: item.requiresApproval,
        demo: false,
      })),
    };
  } catch {
    return { cases: demoCases.map(demoSummary), demo: true };
  }
}

export async function getRecoveryCase(id: string) {
  try {
    const item = await prisma.recoveryCase.findFirst({
      where: { OR: [{ id }, { caseNumber: id }, { transaction: { externalTransactionId: id } }] },
      include: { transaction: { include: { customer: true } }, actions: { orderBy: { createdAt: "desc" } }, auditLogs: { orderBy: { createdAt: "asc" } } },
    });
    if (item) {
      return {
        id: item.id,
        caseNumber: item.caseNumber,
        customer: item.transaction.customer,
        transaction: item.transaction,
        status: item.status,
        priorityScore: item.priorityScore,
        recoveryProbability: item.recoveryProbability,
        failureReason: item.failureCategory,
        recommendedAction: item.recommendedAction,
        recommendedChannel: item.recommendedChannel,
        recommendedDelayMinutes: item.recommendedDelayMinutes,
        decisionExplanation: item.decisionExplanation,
        requiresApproval: item.requiresApproval,
        paymentLinkUrl: item.paymentLinkUrl,
        recoveryAttemptCount: item.recoveryAttemptCount,
        maxRecoveryAttempts: item.maxRecoveryAttempts,
        actions: item.actions,
        auditLogs: item.auditLogs,
        demo: false,
      };
    }
  } catch {
    // Demo mode keeps the case view usable without a database connection.
  }

  const demo = demoCases.find(({ transaction }) => transaction.id === id);
  if (!demo) return null;
  return {
    id: demo.transaction.id,
    caseNumber: demo.transaction.id,
    customer: { name: demo.transaction.customer, email: null, phone: null, doNotContact: false },
    transaction: { externalTransactionId: demo.transaction.id, amountPaise: Math.round(demo.transaction.amount * 100), paymentMethod: demo.transaction.method, errorReason: demo.transaction.failureReason, attemptCount: demo.transaction.attempts },
    status: demo.decision.stopped ? "STOPPED" : demo.decision.requiresApproval ? "AWAITING_APPROVAL" : "ANALYZED",
    priorityScore: demo.decision.score,
    recoveryProbability: demo.decision.probability,
    failureReason: demo.transaction.failureReason,
    recommendedAction: demo.decision.action,
    recommendedChannel: demo.transaction.consent ? "EMAIL" : null,
    recommendedDelayMinutes: demo.decision.delayMinutes,
    decisionExplanation: demo.decision.explanation,
    requiresApproval: demo.decision.requiresApproval,
    paymentLinkUrl: null,
    recoveryAttemptCount: demo.transaction.attempts,
    maxRecoveryAttempts: 3,
    actions: [],
    auditLogs: [],
    demo: true,
  };
}
