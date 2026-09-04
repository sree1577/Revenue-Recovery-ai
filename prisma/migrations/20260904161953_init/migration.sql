-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('FAILED', 'PENDING', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RecoveryCaseStatus" AS ENUM ('DETECTED', 'ANALYZED', 'AWAITING_APPROVAL', 'APPROVED', 'ACTION_SCHEDULED', 'PAYMENT_LINK_CREATED', 'CONTACTED', 'RECOVERED', 'STOPPED', 'ESCALATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('WAIT', 'CREATE_PAYMENT_LINK', 'SEND_EMAIL', 'SEND_SMS', 'SEND_WHATSAPP', 'REQUEST_ALTERNATIVE_METHOD', 'ESCALATE', 'STOP');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'APPROVED', 'EXECUTED', 'FAILED', 'CANCELLED', 'SIMULATED');

-- CreateEnum
CREATE TYPE "AuditActor" AS ENUM ('SYSTEM', 'AGENT', 'MERCHANT', 'RAZORPAY', 'CUSTOMER');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "preferredChannel" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "consentEmail" BOOLEAN NOT NULL DEFAULT false,
    "consentSms" BOOLEAN NOT NULL DEFAULT false,
    "consentWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "previousSuccessfulPayments" INTEGER NOT NULL DEFAULT 0,
    "previousFailedPayments" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "externalTransactionId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpayOrderId" TEXT,
    "customerId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentMethod" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'FAILED',
    "errorCode" TEXT,
    "errorStep" TEXT,
    "errorReason" TEXT,
    "errorSource" TEXT,
    "errorDescription" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" "RecoveryCaseStatus" NOT NULL DEFAULT 'DETECTED',
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "recoveryProbability" INTEGER NOT NULL DEFAULT 0,
    "failureCategory" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "recommendedChannel" TEXT,
    "recommendedDelayMinutes" INTEGER NOT NULL DEFAULT 0,
    "decisionExplanation" TEXT NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "stopReason" TEXT,
    "paymentLinkId" TEXT,
    "paymentLinkUrl" TEXT,
    "paymentLinkExpiresAt" TIMESTAMP(3),
    "recoveredAmountPaise" INTEGER,
    "recoveredAt" TIMESTAMP(3),
    "nextActionAt" TIMESTAMP(3),
    "recoveryAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxRecoveryAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryAction" (
    "id" TEXT NOT NULL,
    "recoveryCaseId" TEXT NOT NULL,
    "type" "ActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "channel" TEXT,
    "message" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "failureMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "recoveryCaseId" TEXT,
    "eventType" TEXT NOT NULL,
    "actor" "AuditActor" NOT NULL,
    "decision" TEXT,
    "inputSnapshot" JSONB,
    "outputSnapshot" JSONB,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxRecoveryAttempts" INTEGER NOT NULL DEFAULT 3,
    "quietHoursStart" INTEGER NOT NULL DEFAULT 21,
    "quietHoursEnd" INTEGER NOT NULL DEFAULT 9,
    "approvalThresholdPaise" INTEGER NOT NULL DEFAULT 1000000,
    "defaultRecoveryDelayMin" INTEGER NOT NULL DEFAULT 30,
    "demoMode" BOOLEAN NOT NULL DEFAULT true,
    "aiMessageGeneration" BOOLEAN NOT NULL DEFAULT true,
    "simulatedCommunication" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_externalId_key" ON "Customer"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_externalTransactionId_key" ON "Transaction"("externalTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_razorpayPaymentId_key" ON "Transaction"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Transaction_customerId_idx" ON "Transaction"("customerId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCase_caseNumber_key" ON "RecoveryCase"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCase_transactionId_key" ON "RecoveryCase"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCase_paymentLinkId_key" ON "RecoveryCase"("paymentLinkId");

-- CreateIndex
CREATE INDEX "RecoveryCase_status_idx" ON "RecoveryCase"("status");

-- CreateIndex
CREATE INDEX "RecoveryCase_priorityScore_idx" ON "RecoveryCase"("priorityScore");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryAction_idempotencyKey_key" ON "RecoveryAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RecoveryAction_recoveryCaseId_status_idx" ON "RecoveryAction"("recoveryCaseId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_recoveryCaseId_createdAt_idx" ON "AuditLog"("recoveryCaseId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actor_createdAt_idx" ON "AuditLog"("actor", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_externalEventId_key" ON "WebhookEvent"("externalEventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_eventType_idx" ON "WebhookEvent"("provider", "eventType");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryAction" ADD CONSTRAINT "RecoveryAction_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
