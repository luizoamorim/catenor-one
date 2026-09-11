-- CreateEnum
CREATE TYPE "catenor_private"."AccountBindingPurpose" AS ENUM ('DISTRIBUTION_RECEIVING', 'AGENT_EXECUTION');

-- AlterEnum
ALTER TYPE "catenor_private"."ProviderBindingRole" ADD VALUE 'INVESTOR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'AGENT_EXECUTION_WALLET_PROVISIONED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'ACCOUNT_BINDING_CREATED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'DISTRIBUTION_REQUEST_DENIED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'DISTRIBUTION_ELIGIBILITY_EVALUATED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'DISTRIBUTION_PLAN_CREATED';

-- CreateTable
CREATE TABLE "catenor_private"."AccountBinding" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "purpose" "catenor_private"."AccountBindingPurpose" NOT NULL,
    "account" TEXT NOT NULL,
    "walletProvider" TEXT NOT NULL,
    "walletRef" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountBinding_subjectId_purpose_key" ON "catenor_private"."AccountBinding"("subjectId", "purpose");

-- AddForeignKey
ALTER TABLE "catenor_private"."AccountBinding" ADD CONSTRAINT "AccountBinding_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "catenor_private"."Subject"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

