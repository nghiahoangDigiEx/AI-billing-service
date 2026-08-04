/*
  Warnings:

  - Added the required column `creditsIncluded` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "creditsIncluded" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING';
