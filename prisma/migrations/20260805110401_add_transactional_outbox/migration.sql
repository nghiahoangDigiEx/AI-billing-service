-- CreateEnum
CREATE TYPE "BillingOutboxStatus" AS ENUM ('PENDING', 'PROCESSED', 'DEAD_LETTERED');

-- CreateTable
CREATE TABLE "BillingOutbox" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "BillingOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingOutbox_eventId_key" ON "BillingOutbox"("eventId");

-- CreateIndex
CREATE INDEX "BillingOutbox_status_nextAttemptAt_idx" ON "BillingOutbox"("status", "nextAttemptAt");

-- CreateTable
CREATE TABLE "CreditInbox" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditInbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditInbox_eventId_key" ON "CreditInbox"("eventId");

-- CreateTable
CREATE TABLE "EventDlq" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDlq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventDlq_eventId_idx" ON "EventDlq"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditBalance_source_sourceRef_key" ON "CreditBalance"("source", "sourceRef");
