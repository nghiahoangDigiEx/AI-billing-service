-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSED', 'DEAD_LETTERED');

-- Drop index that depends on the column before changing its type
DROP INDEX IF EXISTS "BillingOutbox_status_nextAttemptAt_idx";

-- AlterTable
ALTER TABLE "BillingOutbox" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BillingOutbox" ALTER COLUMN "status" TYPE "OutboxStatus" USING "status"::text::"OutboxStatus";
ALTER TABLE "BillingOutbox" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "BillingOutboxStatus";

-- CreateTable
CREATE TABLE "UserOutbox" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserOutbox_eventId_key" ON "UserOutbox"("eventId");

-- CreateIndex
CREATE INDEX "UserOutbox_status_nextAttemptAt_idx" ON "UserOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "BillingOutbox_status_nextAttemptAt_idx" ON "BillingOutbox"("status", "nextAttemptAt");
