import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  TransactionStatus,
  RecoveryCaseStatus,
} from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});

const prisma = new PrismaClient({ adapter });

const seedTransactions = [
  {
    id: "PAY-1048",
    name: "Aarav Kumar",
    email: "aarav@example.test",
    amountPaise: 249900,
    method: "UPI",
    reason: "UPI_REQUEST_EXPIRED",

    // Recovery Agent demo decision
    priorityScore: 78,
    recoveryProbability: 85,
    failureCategory: "TEMPORARY_FAILURE",
    recommendedAction: "CREATE_PAYMENT_LINK",
    recommendedChannel: "EMAIL",
    recommendedDelayMinutes: 10,
    decisionExplanation:
      "UPI request expired. Customer can retry safely using a fresh payment link.",
  },
  {
    id: "PAY-1049",
    name: "Meera Rao",
    email: "meera@example.test",
    amountPaise: 890000,
    method: "Netbanking",
    reason: "BANK_TIMEOUT",

    priorityScore: 90,
    recoveryProbability: 80,
    failureCategory: "BANK_TEMPORARY_FAILURE",
    recommendedAction: "CREATE_PAYMENT_LINK",
    recommendedChannel: "EMAIL",
    recommendedDelayMinutes: 30,
    decisionExplanation:
      "Bank timeout is likely temporary. Retry after a short delay with a fresh payment link.",
  },
  {
    id: "PAY-1050",
    name: "Vikram Shah",
    email: "vikram@example.test",
    amountPaise: 1850000,
    method: "Card",
    reason: "CARD_EXPIRED",

    priorityScore: 96,
    recoveryProbability: 65,
    failureCategory: "PAYMENT_METHOD_FAILURE",
    recommendedAction: "REQUEST_ALTERNATIVE_METHOD",
    recommendedChannel: "EMAIL",
    recommendedDelayMinutes: 0,
    decisionExplanation:
      "The customer's card has expired. Recovery requires an alternative payment method.",
  },
];

async function main() {
  console.log("Starting Revenue Recovery AI seed...");

  // -----------------------------------------
  // Agent configuration
  // -----------------------------------------

  await prisma.agentSettings.upsert({
    where: {
      id: "default",
    },
    update: {},
    create: {
      id: "default",
      enabled: true,
      maxRecoveryAttempts: 3,
      quietHoursStart: 21,
      quietHoursEnd: 9,
      approvalThresholdPaise: 1000000,
      defaultRecoveryDelayMin: 30,
      demoMode: false,
      aiMessageGeneration: true,
      simulatedCommunication: true,
    },
  });

  // -----------------------------------------
  // Customers + Transactions + Recovery Cases
  // -----------------------------------------

  for (const item of seedTransactions) {
    const customer = await prisma.customer.upsert({
      where: {
        externalId: `demo-${item.id}`,
      },

      update: {},

      create: {
        externalId: `demo-${item.id}`,
        name: item.name,
        email: item.email,
        consentEmail: true,
      },
    });

    const transaction = await prisma.transaction.upsert({
      where: {
        externalTransactionId: item.id,
      },

      update: {},

      create: {
        externalTransactionId: item.id,
        customerId: customer.id,
        amountPaise: item.amountPaise,
        paymentMethod: item.method,
        errorReason: item.reason,
        attemptCount: 1,
        occurredAt: new Date(),
        status: TransactionStatus.FAILED,
      },
    });

    // Human approval required for >= ₹10,000
    const requiresApproval = item.amountPaise >= 1000000;

    const recoveryCase = await prisma.recoveryCase.upsert({
      where: {
        transactionId: transaction.id,
      },

      update: {},

      create: {
        caseNumber: `CASE-${item.id.replace("PAY-", "")}`,

        transactionId: transaction.id,

        status: requiresApproval
          ? RecoveryCaseStatus.AWAITING_APPROVAL
          : RecoveryCaseStatus.ANALYZED,

        priorityScore: item.priorityScore,

        recoveryProbability: item.recoveryProbability,

        failureCategory: item.failureCategory,

        recommendedAction: item.recommendedAction,

        recommendedChannel: item.recommendedChannel,

        recommendedDelayMinutes: item.recommendedDelayMinutes,

        decisionExplanation: item.decisionExplanation,

        requiresApproval,

        recoveryAttemptCount: 0,

        maxRecoveryAttempts: 3,

        nextActionAt: requiresApproval
          ? null
          : new Date(Date.now() + item.recommendedDelayMinutes * 60 * 1000),
      },
    });

    // -----------------------------------------
    // Audit trail
    // -----------------------------------------

    const existingAudit = await prisma.auditLog.findFirst({
      where: {
        recoveryCaseId: recoveryCase.id,
        eventType: "RECOVERY_CASE_ANALYZED",
      },
    });

    if (!existingAudit) {
      await prisma.auditLog.create({
        data: {
          recoveryCaseId: recoveryCase.id,

          eventType: "RECOVERY_CASE_ANALYZED",

          actor: "AGENT",

          decision: item.recommendedAction,

          inputSnapshot: {
            transactionId: item.id,
            amountPaise: item.amountPaise,
            paymentMethod: item.method,
            failureReason: item.reason,
          },

          outputSnapshot: {
            priorityScore: item.priorityScore,
            recoveryProbability: item.recoveryProbability,
            recommendedAction: item.recommendedAction,
            recommendedChannel: item.recommendedChannel,
            requiresApproval,
          },

          policyVersion: "demo-v1",
        },
      });
    }

    console.log(
      `Created/verified ${item.id} → ${recoveryCase.caseNumber}`,
    );
  }

  console.log("Revenue Recovery AI seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });