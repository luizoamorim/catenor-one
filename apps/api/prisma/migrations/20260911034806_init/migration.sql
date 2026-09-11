-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catenor_private";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catenor_public";

-- CreateEnum
CREATE TYPE "catenor_public"."SubjectLifecycle" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "catenor_public"."VerificationMethodStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "catenor_public"."TrustAnchorStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "catenor_public"."PublishedDecisionOutcome" AS ENUM ('ALLOW');

-- CreateEnum
CREATE TYPE "catenor_private"."SubjectType" AS ENUM ('HUMAN', 'ORGANIZATION', 'AGENT');

-- CreateEnum
CREATE TYPE "catenor_private"."ProviderBindingRole" AS ENUM ('COMPANY', 'REPRESENTATIVE');

-- CreateEnum
CREATE TYPE "catenor_private"."ProviderBindingStatus" AS ENUM ('PENDING_ATTACHMENT', 'ATTACHED_UNVERIFIED', 'BINDING_VERIFIED', 'BINDING_MISMATCH');

-- CreateEnum
CREATE TYPE "catenor_private"."KeyPurpose" AS ENUM ('CREDENTIAL_ASSERTION', 'AUTHENTICATION', 'DELEGATION', 'RECOVERY', 'FINANCIAL_EXECUTION');

-- CreateEnum
CREATE TYPE "catenor_private"."KeyReferenceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "catenor_private"."AdmissionPhase" AS ENUM ('STARTED', 'KEY_PROVISIONED', 'KEY_PROOF_VALID', 'KEY_PROOF_INVALID', 'VERIFICATION_REQUESTED', 'EVIDENCE_RECEIVED', 'VERIFICATION_FAILED', 'DECIDED', 'ENDORSED', 'ADMITTED');

-- CreateEnum
CREATE TYPE "catenor_private"."ChallengeStatus" AS ENUM ('ISSUED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "catenor_private"."VerificationRunStatus" AS ENUM ('PENDING', 'EVIDENCE_RECEIVED', 'ERROR', 'TIMED_OUT', 'BINDING_MISMATCH');

-- CreateEnum
CREATE TYPE "catenor_private"."RetentionMode" AS ENUM ('COMMITMENT_ONLY');

-- CreateEnum
CREATE TYPE "catenor_private"."PolicyOutcome" AS ENUM ('ALLOW', 'DENY', 'ERROR');

-- CreateEnum
CREATE TYPE "catenor_private"."RequirementStatus" AS ENUM ('SATISFIED', 'FALSE', 'MISSING');

-- CreateEnum
CREATE TYPE "catenor_private"."FactName" AS ENUM ('ORGANIZATION_KYB_VERIFIED', 'ORGANIZATION_STATUS_VALID', 'ORGANIZATION_AML_CLEAR', 'AUTHORIZED_REPRESENTATIVE_VERIFIED', 'REPRESENTATIVE_AUTHORITY_CONFIRMED', 'ASSERTION_KEY_POSSESSION_VALID', 'ASSERTION_KEY_PURPOSE_VALID', 'EVIDENCE_FRESH');

-- CreateEnum
CREATE TYPE "catenor_private"."FactSource" AS ENUM ('KEY_POSSESSION_VERIFIER', 'CONFIDENTIAL_VERIFICATION');

-- CreateEnum
CREATE TYPE "catenor_private"."AuditEventType" AS ENUM ('SUBJECT_CREATED', 'KEY_ADDED', 'DID_DOCUMENT_CREATED', 'ADMISSION_REQUESTED', 'KEY_POSSESSION_VERIFIED', 'CONFIDENTIAL_EVIDENCE_VERIFIED', 'POLICY_EVALUATED', 'BOOTSTRAP_ENDORSEMENT_CREATED', 'TRUST_ANCHOR_ADMITTED', 'TRUST_ANCHOR_ADMISSION_DENIED', 'BOOTSTRAP_ACCESS_DENIED', 'PROVIDER_REFERENCES_ATTACHED', 'KEY_POSSESSION_FAILED', 'CONFIDENTIAL_VERIFICATION_REQUESTED', 'CONFIDENTIAL_VERIFICATION_FAILED', 'ADMISSION_ALREADY_ADMITTED');

-- CreateTable
CREATE TABLE "catenor_public"."DidDocumentProjection" (
    "did" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "lifecycle" "catenor_public"."SubjectLifecycle" NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DidDocumentProjection_pkey" PRIMARY KEY ("did")
);

-- CreateTable
CREATE TABLE "catenor_public"."VerificationMethodProjection" (
    "id" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "publicKeyMultibase" TEXT NOT NULL,
    "relationships" TEXT[],
    "status" "catenor_public"."VerificationMethodStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationMethodProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catenor_public"."PolicyPublication" (
    "policyId" TEXT NOT NULL,
    "canonicalJson" TEXT NOT NULL,
    "policyHash" TEXT NOT NULL,

    CONSTRAINT "PolicyPublication_pkey" PRIMARY KEY ("policyId")
);

-- CreateTable
CREATE TABLE "catenor_public"."DecisionProjection" (
    "decisionRef" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "decision" "catenor_public"."PublishedDecisionOutcome" NOT NULL,
    "evaluatedAt" TEXT NOT NULL,
    "evidenceCommitment" TEXT NOT NULL,
    "decisionCommitment" TEXT NOT NULL,

    CONSTRAINT "DecisionProjection_pkey" PRIMARY KEY ("decisionRef")
);

-- CreateTable
CREATE TABLE "catenor_public"."BootstrapEndorsementProjection" (
    "id" TEXT NOT NULL,
    "decisionRef" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "BootstrapEndorsementProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catenor_public"."TrustAnchorAdmissionRecord" (
    "id" TEXT NOT NULL,
    "trustDomain" TEXT NOT NULL,
    "trustAnchor" TEXT NOT NULL,
    "admissionPolicy" TEXT NOT NULL,
    "policyHash" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "verificationMethod" TEXT NOT NULL,
    "evidenceCommitment" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "decisionRef" TEXT NOT NULL,
    "bootstrapEndorsementRef" TEXT NOT NULL,

    CONSTRAINT "TrustAnchorAdmissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catenor_public"."TrustAnchorStatusProjection" (
    "trustDomain" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "status" "catenor_public"."TrustAnchorStatus" NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TrustAnchorStatusProjection_pkey" PRIMARY KEY ("trustDomain","did")
);

-- CreateTable
CREATE TABLE "catenor_public"."TrustDomainProjection" (
    "id" TEXT NOT NULL,
    "bootstrapConfigurationHash" TEXT NOT NULL,
    "initialTrustAnchorDid" TEXT,

    CONSTRAINT "TrustDomainProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catenor_private"."Subject" (
    "id" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "type" "catenor_private"."SubjectType" NOT NULL,
    "lifecycle" "catenor_public"."SubjectLifecycle" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catenor_private"."ProviderBinding" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "role" "catenor_private"."ProviderBindingRole" NOT NULL,
    "bindingRef" TEXT NOT NULL,
    "externalSubjectId" TEXT,
    "status" "catenor_private"."ProviderBindingStatus" NOT NULL DEFAULT 'PENDING_ATTACHMENT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProviderBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catenor_private"."KeyManagementReference" (
    "verificationMethodId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "signerRef" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "purpose" "catenor_private"."KeyPurpose" NOT NULL,
    "status" "catenor_private"."KeyReferenceStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyManagementReference_pkey" PRIMARY KEY ("verificationMethodId")
);

-- CreateTable
CREATE TABLE "catenor_private"."AdmissionSession" (
    "id" TEXT NOT NULL,
    "sessionRef" TEXT NOT NULL,
    "trustDomain" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "operatorRef" TEXT NOT NULL,
    "state" "catenor_private"."AdmissionPhase" NOT NULL DEFAULT 'STARTED',
    "providerRefsAttached" BOOLEAN NOT NULL DEFAULT false,
    "assertionVerificationMethod" TEXT,
    "keyPossessionValid" BOOLEAN,
    "keyPurposeValid" BOOLEAN,
    "keyPossessionReasons" TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AdmissionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catenor_private"."KeyPossessionChallenge" (
    "challengeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "verificationMethod" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "trustDomain" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "issuedAt" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "status" "catenor_private"."ChallengeStatus" NOT NULL DEFAULT 'ISSUED',
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "KeyPossessionChallenge_pkey" PRIMARY KEY ("challengeId")
);

-- CreateTable
CREATE TABLE "catenor_private"."ConfidentialVerificationRun" (
    "runId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "creWorkflowId" TEXT NOT NULL,
    "creExecutionId" TEXT,
    "status" "catenor_private"."VerificationRunStatus" NOT NULL DEFAULT 'PENDING',
    "code" TEXT,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "facts" JSONB,
    "evidenceCommitment" TEXT,
    "commitmentInputs" JSONB,
    "evidenceSources" JSONB NOT NULL,
    "retentionMode" "catenor_private"."RetentionMode" NOT NULL DEFAULT 'COMMITMENT_ONLY',
    "bootstrapConfigurationHashEcho" TEXT,
    "resultAuth" JSONB,
    "donReport" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ConfidentialVerificationRun_pkey" PRIMARY KEY ("runId")
);

-- CreateTable
CREATE TABLE "catenor_private"."DecisionRecord" (
    "decisionRef" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "decision" "catenor_private"."PolicyOutcome" NOT NULL,
    "evaluatedAt" TEXT NOT NULL,
    "evidenceCommitment" TEXT NOT NULL,
    "decisionCommitment" TEXT NOT NULL,
    "policyHash" TEXT NOT NULL,
    "errorReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionRecord_pkey" PRIMARY KEY ("decisionRef")
);

-- CreateTable
CREATE TABLE "catenor_private"."DecisionTrace" (
    "decisionRef" TEXT NOT NULL,
    "claim" "catenor_private"."FactName" NOT NULL,
    "status" "catenor_private"."RequirementStatus" NOT NULL,
    "factValue" BOOLEAN,
    "provenanceSource" "catenor_private"."FactSource",
    "provenanceRef" TEXT,
    "reasons" TEXT[],

    CONSTRAINT "DecisionTrace_pkey" PRIMARY KEY ("decisionRef","claim")
);

-- CreateTable
CREATE TABLE "catenor_private"."AuditEvent" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "trustDomain" TEXT NOT NULL,
    "type" "catenor_private"."AuditEventType" NOT NULL,
    "subject" TEXT,
    "issuer" TEXT,
    "requestId" TEXT,
    "timestamp" TEXT NOT NULL,
    "details" JSONB,
    "prevHash" TEXT NOT NULL,
    "eventHash" TEXT NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationMethodProjection_did_idx" ON "catenor_public"."VerificationMethodProjection"("did");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionProjection_decisionCommitment_key" ON "catenor_public"."DecisionProjection"("decisionCommitment");

-- CreateIndex
CREATE UNIQUE INDEX "BootstrapEndorsementProjection_decisionRef_key" ON "catenor_public"."BootstrapEndorsementProjection"("decisionRef");

-- CreateIndex
CREATE UNIQUE INDEX "TrustAnchorAdmissionRecord_decisionRef_key" ON "catenor_public"."TrustAnchorAdmissionRecord"("decisionRef");

-- CreateIndex
CREATE UNIQUE INDEX "TrustAnchorAdmissionRecord_bootstrapEndorsementRef_key" ON "catenor_public"."TrustAnchorAdmissionRecord"("bootstrapEndorsementRef");

-- CreateIndex
CREATE UNIQUE INDEX "TrustAnchorAdmissionRecord_trustDomain_trustAnchor_key" ON "catenor_public"."TrustAnchorAdmissionRecord"("trustDomain", "trustAnchor");

-- CreateIndex
CREATE UNIQUE INDEX "TrustDomainProjection_initialTrustAnchorDid_key" ON "catenor_public"."TrustDomainProjection"("initialTrustAnchorDid");

-- CreateIndex
CREATE UNIQUE INDEX "TrustDomainProjection_id_initialTrustAnchorDid_key" ON "catenor_public"."TrustDomainProjection"("id", "initialTrustAnchorDid");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_did_key" ON "catenor_private"."Subject"("did");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderBinding_bindingRef_key" ON "catenor_private"."ProviderBinding"("bindingRef");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderBinding_subjectId_role_key" ON "catenor_private"."ProviderBinding"("subjectId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "KeyManagementReference_signerRef_key" ON "catenor_private"."KeyManagementReference"("signerRef");

-- CreateIndex
CREATE INDEX "KeyManagementReference_subjectId_idx" ON "catenor_private"."KeyManagementReference"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionSession_sessionRef_key" ON "catenor_private"."AdmissionSession"("sessionRef");

-- CreateIndex
CREATE INDEX "AdmissionSession_subjectId_idx" ON "catenor_private"."AdmissionSession"("subjectId");

-- CreateIndex
CREATE INDEX "AdmissionSession_trustDomain_idx" ON "catenor_private"."AdmissionSession"("trustDomain");

-- CreateIndex
CREATE UNIQUE INDEX "KeyPossessionChallenge_sessionId_key" ON "catenor_private"."KeyPossessionChallenge"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "KeyPossessionChallenge_nonce_key" ON "catenor_private"."KeyPossessionChallenge"("nonce");

-- CreateIndex
CREATE INDEX "ConfidentialVerificationRun_status_deadlineAt_idx" ON "catenor_private"."ConfidentialVerificationRun"("status", "deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConfidentialVerificationRun_sessionId_attempt_key" ON "catenor_private"."ConfidentialVerificationRun"("sessionId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionRecord_sessionId_key" ON "catenor_private"."DecisionRecord"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionRecord_decisionCommitment_key" ON "catenor_private"."DecisionRecord"("decisionCommitment");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_seq_key" ON "catenor_private"."AuditEvent"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_eventHash_key" ON "catenor_private"."AuditEvent"("eventHash");

-- CreateIndex
CREATE INDEX "AuditEvent_subject_idx" ON "catenor_private"."AuditEvent"("subject");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_trustDomain_prevHash_key" ON "catenor_private"."AuditEvent"("trustDomain", "prevHash");

-- AddForeignKey
ALTER TABLE "catenor_public"."VerificationMethodProjection" ADD CONSTRAINT "VerificationMethodProjection_did_fkey" FOREIGN KEY ("did") REFERENCES "catenor_public"."DidDocumentProjection"("did") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_public"."BootstrapEndorsementProjection" ADD CONSTRAINT "BootstrapEndorsementProjection_decisionRef_fkey" FOREIGN KEY ("decisionRef") REFERENCES "catenor_public"."DecisionProjection"("decisionRef") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_public"."TrustAnchorAdmissionRecord" ADD CONSTRAINT "TrustAnchorAdmissionRecord_trustDomain_fkey" FOREIGN KEY ("trustDomain") REFERENCES "catenor_public"."TrustDomainProjection"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_public"."TrustAnchorAdmissionRecord" ADD CONSTRAINT "TrustAnchorAdmissionRecord_decisionRef_fkey" FOREIGN KEY ("decisionRef") REFERENCES "catenor_public"."DecisionProjection"("decisionRef") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_public"."TrustAnchorAdmissionRecord" ADD CONSTRAINT "TrustAnchorAdmissionRecord_bootstrapEndorsementRef_fkey" FOREIGN KEY ("bootstrapEndorsementRef") REFERENCES "catenor_public"."BootstrapEndorsementProjection"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_public"."TrustAnchorStatusProjection" ADD CONSTRAINT "TrustAnchorStatusProjection_trustDomain_did_fkey" FOREIGN KEY ("trustDomain", "did") REFERENCES "catenor_public"."TrustAnchorAdmissionRecord"("trustDomain", "trustAnchor") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_public"."TrustDomainProjection" ADD CONSTRAINT "TrustDomainProjection_id_initialTrustAnchorDid_fkey" FOREIGN KEY ("id", "initialTrustAnchorDid") REFERENCES "catenor_public"."TrustAnchorAdmissionRecord"("trustDomain", "trustAnchor") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_private"."ProviderBinding" ADD CONSTRAINT "ProviderBinding_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "catenor_private"."Subject"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_private"."KeyManagementReference" ADD CONSTRAINT "KeyManagementReference_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "catenor_private"."Subject"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_private"."AdmissionSession" ADD CONSTRAINT "AdmissionSession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "catenor_private"."Subject"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_private"."KeyPossessionChallenge" ADD CONSTRAINT "KeyPossessionChallenge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "catenor_private"."AdmissionSession"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_private"."ConfidentialVerificationRun" ADD CONSTRAINT "ConfidentialVerificationRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "catenor_private"."AdmissionSession"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_private"."DecisionRecord" ADD CONSTRAINT "DecisionRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "catenor_private"."AdmissionSession"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "catenor_private"."DecisionTrace" ADD CONSTRAINT "DecisionTrace_decisionRef_fkey" FOREIGN KEY ("decisionRef") REFERENCES "catenor_private"."DecisionRecord"("decisionRef") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- ===================================================================================================
-- Raw SQL (not generated by Prisma) — reviewed and approved by the maintainer on 2026-09-11 (T3.1).
-- Not added on purpose: ProviderBinding.provider = 'sumsub' (provider-generic model).
-- [P1, T3.5] append-only trigger on catenor_private."AuditEvent" comes in a later migration.
-- ===================================================================================================

-- ---------------------------------------------------------------------------------------------------
-- C1  commitment format: 0x + 64 lowercase hex  (PLAN §6 commitment profile)
-- ---------------------------------------------------------------------------------------------------
ALTER TABLE "catenor_public"."PolicyPublication"
  ADD CONSTRAINT "PolicyPublication_policyHash_format" CHECK ("policyHash" ~ '^0x[0-9a-f]{64}$');
ALTER TABLE "catenor_public"."DecisionProjection"
  ADD CONSTRAINT "DecisionProjection_evidenceCommitment_format" CHECK ("evidenceCommitment" ~ '^0x[0-9a-f]{64}$'),
  ADD CONSTRAINT "DecisionProjection_decisionCommitment_format" CHECK ("decisionCommitment" ~ '^0x[0-9a-f]{64}$');
ALTER TABLE "catenor_public"."TrustAnchorAdmissionRecord"
  ADD CONSTRAINT "TrustAnchorAdmissionRecord_policyHash_format" CHECK ("policyHash" ~ '^0x[0-9a-f]{64}$'),
  ADD CONSTRAINT "TrustAnchorAdmissionRecord_evidenceCommitment_format" CHECK ("evidenceCommitment" ~ '^0x[0-9a-f]{64}$');
ALTER TABLE "catenor_public"."TrustDomainProjection"
  ADD CONSTRAINT "TrustDomainProjection_bootstrapConfigurationHash_format" CHECK ("bootstrapConfigurationHash" ~ '^0x[0-9a-f]{64}$');
ALTER TABLE "catenor_private"."DecisionRecord"
  ADD CONSTRAINT "DecisionRecord_evidenceCommitment_format" CHECK ("evidenceCommitment" ~ '^0x[0-9a-f]{64}$'),
  ADD CONSTRAINT "DecisionRecord_decisionCommitment_format" CHECK ("decisionCommitment" ~ '^0x[0-9a-f]{64}$'),
  ADD CONSTRAINT "DecisionRecord_policyHash_format" CHECK ("policyHash" ~ '^0x[0-9a-f]{64}$');
ALTER TABLE "catenor_private"."ConfidentialVerificationRun"
  ADD CONSTRAINT "ConfidentialVerificationRun_evidenceCommitment_format" CHECK ("evidenceCommitment" IS NULL OR "evidenceCommitment" ~ '^0x[0-9a-f]{64}$'),
  ADD CONSTRAINT "ConfidentialVerificationRun_bootstrapConfigHashEcho_format" CHECK ("bootstrapConfigurationHashEcho" IS NULL OR "bootstrapConfigurationHashEcho" ~ '^0x[0-9a-f]{64}$');
ALTER TABLE "catenor_private"."AuditEvent"
  ADD CONSTRAINT "AuditEvent_prevHash_format" CHECK ("prevHash" ~ '^0x[0-9a-f]{64}$'),
  ADD CONSTRAINT "AuditEvent_eventHash_format" CHECK ("eventHash" ~ '^0x[0-9a-f]{64}$');

-- ---------------------------------------------------------------------------------------------------
-- C2  did:catenor format: 16 random bytes as 32 lowercase hex  (PLAN §5.1, TV-S001-C01)
-- ---------------------------------------------------------------------------------------------------
ALTER TABLE "catenor_public"."DidDocumentProjection"
  ADD CONSTRAINT "DidDocumentProjection_did_format" CHECK ("did" ~ '^did:catenor:[0-9a-f]{32}$');
ALTER TABLE "catenor_public"."VerificationMethodProjection"
  ADD CONSTRAINT "VerificationMethodProjection_did_format" CHECK ("did" ~ '^did:catenor:[0-9a-f]{32}$');
ALTER TABLE "catenor_public"."DecisionProjection"
  ADD CONSTRAINT "DecisionProjection_subject_format" CHECK ("subject" ~ '^did:catenor:[0-9a-f]{32}$');
ALTER TABLE "catenor_public"."TrustAnchorAdmissionRecord"
  ADD CONSTRAINT "TrustAnchorAdmissionRecord_trustAnchor_format" CHECK ("trustAnchor" ~ '^did:catenor:[0-9a-f]{32}$');
ALTER TABLE "catenor_public"."TrustAnchorStatusProjection"
  ADD CONSTRAINT "TrustAnchorStatusProjection_did_format" CHECK ("did" ~ '^did:catenor:[0-9a-f]{32}$');
ALTER TABLE "catenor_public"."TrustDomainProjection"
  ADD CONSTRAINT "TrustDomainProjection_initialTrustAnchorDid_format" CHECK ("initialTrustAnchorDid" IS NULL OR "initialTrustAnchorDid" ~ '^did:catenor:[0-9a-f]{32}$');
ALTER TABLE "catenor_private"."Subject"
  ADD CONSTRAINT "Subject_did_format" CHECK ("did" ~ '^did:catenor:[0-9a-f]{32}$');
ALTER TABLE "catenor_private"."KeyPossessionChallenge"
  ADD CONSTRAINT "KeyPossessionChallenge_subject_format" CHECK ("subject" ~ '^did:catenor:[0-9a-f]{32}$');
ALTER TABLE "catenor_private"."DecisionRecord"
  ADD CONSTRAINT "DecisionRecord_subject_format" CHECK ("subject" ~ '^did:catenor:[0-9a-f]{32}$');

-- ---------------------------------------------------------------------------------------------------
-- C3  trust-domain id format [REF-IMPL]  (TRUST_DOMAIN_PATTERN in @catenor-one/authority)
-- ---------------------------------------------------------------------------------------------------
ALTER TABLE "catenor_public"."TrustDomainProjection"
  ADD CONSTRAINT "TrustDomainProjection_id_format" CHECK ("id" ~ '^trust-domain:[a-z0-9][a-z0-9-]*$');
ALTER TABLE "catenor_public"."TrustAnchorAdmissionRecord"
  ADD CONSTRAINT "TrustAnchorAdmissionRecord_trustDomain_format" CHECK ("trustDomain" ~ '^trust-domain:[a-z0-9][a-z0-9-]*$');
ALTER TABLE "catenor_public"."TrustAnchorStatusProjection"
  ADD CONSTRAINT "TrustAnchorStatusProjection_trustDomain_format" CHECK ("trustDomain" ~ '^trust-domain:[a-z0-9][a-z0-9-]*$');
ALTER TABLE "catenor_private"."AdmissionSession"
  ADD CONSTRAINT "AdmissionSession_trustDomain_format" CHECK ("trustDomain" ~ '^trust-domain:[a-z0-9][a-z0-9-]*$');
ALTER TABLE "catenor_private"."KeyPossessionChallenge"
  ADD CONSTRAINT "KeyPossessionChallenge_trustDomain_format" CHECK ("trustDomain" ~ '^trust-domain:[a-z0-9][a-z0-9-]*$');
ALTER TABLE "catenor_private"."AuditEvent"
  ADD CONSTRAINT "AuditEvent_trustDomain_format" CHECK ("trustDomain" ~ '^trust-domain:[a-z0-9][a-z0-9-]*$');

-- ---------------------------------------------------------------------------------------------------
-- C4  fixed values and bounds
-- ---------------------------------------------------------------------------------------------------
ALTER TABLE "catenor_public"."TrustAnchorAdmissionRecord"
  ADD CONSTRAINT "TrustAnchorAdmissionRecord_decision_value" CHECK ("decision" = 'ADMIT_TRUST_ANCHOR');
ALTER TABLE "catenor_private"."ConfidentialVerificationRun"
  ADD CONSTRAINT "ConfidentialVerificationRun_attempt_range" CHECK ("attempt" BETWEEN 1 AND 3);
ALTER TABLE "catenor_private"."KeyPossessionChallenge"
  ADD CONSTRAINT "KeyPossessionChallenge_nonce_format" CHECK ("nonce" ~ '^[A-Za-z0-9_-]{43}$'),
  ADD CONSTRAINT "KeyPossessionChallenge_operation_value" CHECK ("operation" = 'ADMIT_TRUST_ANCHOR');
ALTER TABLE "catenor_public"."VerificationMethodProjection"
  ADD CONSTRAINT "VerificationMethodProjection_id_under_did" CHECK (starts_with("id", "did" || '#'));

-- ---------------------------------------------------------------------------------------------------
-- C5  state consistency
-- ---------------------------------------------------------------------------------------------------
-- FALSE and MISSING never collapse (D4): SATISFIED ⇔ true, FALSE ⇔ false, MISSING ⇔ NULL.
ALTER TABLE "catenor_private"."DecisionTrace"
  ADD CONSTRAINT "DecisionTrace_status_matches_value" CHECK (
    ("status" = 'SATISFIED' AND "factValue" IS TRUE) OR
    ("status" = 'FALSE' AND "factValue" IS FALSE) OR
    ("status" = 'MISSING' AND "factValue" IS NULL)
  ),
  -- A SATISFIED / FALSE requirement names the fact's provenance; a MISSING one has none.
  ADD CONSTRAINT "DecisionTrace_provenance_matches_status" CHECK (
    ("status" IN ('SATISFIED', 'FALSE') AND "provenanceSource" IS NOT NULL AND "provenanceRef" IS NOT NULL) OR
    ("status" = 'MISSING' AND "provenanceSource" IS NULL AND "provenanceRef" IS NULL)
  );
-- errorReason exactly for ERROR outcomes.
ALTER TABLE "catenor_private"."DecisionRecord"
  ADD CONSTRAINT "DecisionRecord_errorReason_iff_error" CHECK (("decision" = 'ERROR') = ("errorReason" IS NOT NULL));
-- consumedAt exactly when CONSUMED.
ALTER TABLE "catenor_private"."KeyPossessionChallenge"
  ADD CONSTRAINT "KeyPossessionChallenge_consumedAt_iff_consumed" CHECK (("status" = 'CONSUMED') = ("consumedAt" IS NOT NULL));
-- An external subject reference exists exactly once attached.
ALTER TABLE "catenor_private"."ProviderBinding"
  ADD CONSTRAINT "ProviderBinding_externalSubjectId_iff_attached" CHECK (("status" = 'PENDING_ATTACHMENT') = ("externalSubjectId" IS NULL));
-- Facts and evidence commitment exist only on an accepted result — both present — and PENDING / ERROR /
-- TIMED_OUT / BINDING_MISMATCH runs carry neither (U8).
ALTER TABLE "catenor_private"."ConfidentialVerificationRun"
  ADD CONSTRAINT "ConfidentialVerificationRun_facts_iff_evidence" CHECK (
    ("status" = 'EVIDENCE_RECEIVED' AND "facts" IS NOT NULL AND "evidenceCommitment" IS NOT NULL) OR
    ("status" <> 'EVIDENCE_RECEIVED' AND "facts" IS NULL AND "evidenceCommitment" IS NULL)
  );

-- ---------------------------------------------------------------------------------------------------
-- T   field-level immutability (maintainer decision 2026-09-11). Each trigger raises only when its
--     protected column actually changes, so updates of other mutable columns (status, lifecycle, …)
--     are unaffected. Key rotation = new key → new Verification Method → new KeyManagementReference.
-- ---------------------------------------------------------------------------------------------------
CREATE FUNCTION "catenor_public"."reject_initial_root_rewrite"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'TrustDomainProjection.initialTrustAnchorDid is set once and is immutable'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
CREATE TRIGGER "TrustDomainProjection_initialTrustAnchorDid_set_once"
  BEFORE UPDATE ON "catenor_public"."TrustDomainProjection"
  FOR EACH ROW
  WHEN (OLD."initialTrustAnchorDid" IS NOT NULL
        AND NEW."initialTrustAnchorDid" IS DISTINCT FROM OLD."initialTrustAnchorDid")
  EXECUTE FUNCTION "catenor_public"."reject_initial_root_rewrite"();

CREATE FUNCTION "catenor_public"."reject_public_key_rewrite"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'VerificationMethodProjection.publicKeyMultibase is immutable; rotate by creating a new Verification Method'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
CREATE TRIGGER "VerificationMethodProjection_publicKeyMultibase_immutable"
  BEFORE UPDATE ON "catenor_public"."VerificationMethodProjection"
  FOR EACH ROW
  WHEN (NEW."publicKeyMultibase" IS DISTINCT FROM OLD."publicKeyMultibase")
  EXECUTE FUNCTION "catenor_public"."reject_public_key_rewrite"();

CREATE FUNCTION "catenor_private"."reject_signer_ref_rewrite"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'KeyManagementReference.signerRef is immutable; rotate by creating a new Verification Method and mapping'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
CREATE TRIGGER "KeyManagementReference_signerRef_immutable"
  BEFORE UPDATE ON "catenor_private"."KeyManagementReference"
  FOR EACH ROW
  WHEN (NEW."signerRef" IS DISTINCT FROM OLD."signerRef")
  EXECUTE FUNCTION "catenor_private"."reject_signer_ref_rewrite"();
