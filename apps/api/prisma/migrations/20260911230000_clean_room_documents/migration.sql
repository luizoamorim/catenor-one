-- Clean-room demo [REF-IMPL] (prompt 2026-09-11-023): private document index, SPV execution binding, audit types.

-- CreateEnum
CREATE TYPE "catenor_private"."DocumentKind" AS ENUM ('CAPABILITY_GRANT', 'RELATIONSHIP_CREDENTIAL', 'INVESTOR_CREDENTIAL', 'OFFERING_DEFINITION', 'DECISION', 'DISTRIBUTION_PLAN');

-- CreateEnum
CREATE TYPE "catenor_private"."DocumentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- AlterEnum
ALTER TYPE "catenor_private"."AccountBindingPurpose" ADD VALUE 'SPV_EXECUTION';

-- AlterEnum
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'RELATIONSHIP_ESTABLISHED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'SPV_EXECUTION_WALLET_PROVISIONED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'OFFERING_DEFINED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'CREDENTIAL_ISSUED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'OFFERING_ELIGIBILITY_EVALUATED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'INVESTMENT_AUTHORIZED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'INVESTMENT_EXECUTED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'REVENUE_RECEIVED';
ALTER TYPE "catenor_private"."AuditEventType" ADD VALUE 'DISTRIBUTION_PAYOUT_EXECUTED';

-- CreateTable
CREATE TABLE "catenor_private"."DocumentRecord" (
    "id" TEXT NOT NULL,
    "kind" "catenor_private"."DocumentKind" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "status" "catenor_private"."DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusChangedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRecord_subjectId_kind_idx" ON "catenor_private"."DocumentRecord"("subjectId", "kind");

-- AddForeignKey
ALTER TABLE "catenor_private"."DocumentRecord" ADD CONSTRAINT "DocumentRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "catenor_private"."Subject"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
