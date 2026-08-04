-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('PROVISION', 'FREEZE', 'UNFREEZE', 'CONSUME', 'EXHAUST');

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "creditBalanceId" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditTransaction_creditBalanceId_idx" ON "CreditTransaction"("creditBalanceId");

-- CreateIndex
CREATE INDEX "CreditTransaction_sourceRef_type_idx" ON "CreditTransaction"("sourceRef", "type");

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_creditBalanceId_fkey" FOREIGN KEY ("creditBalanceId") REFERENCES "CreditBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
