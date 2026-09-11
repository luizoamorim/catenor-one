// trust-anchor-admission (identity-confidential) — shared types. Pure TypeScript: runs inside the CRE
// QuickJS/WASM runtime (no Node APIs, no crypto global, no atob/btoa — T0.7 R9).

export type EvidenceSource = 'SYNTHETIC_MOCK' | 'REAL_SUMSUB_SANDBOX';
export type EvidenceProfile = 'HYBRID_DEMO' | 'FULL_SUMSUB_SANDBOX';
export type ExecutionMode = 'SIMULATION' | 'DEPLOYED';

/** The six evidence facts a confidential run may derive (never the two key facts). */
export const EVIDENCE_FACTS = [
  'ORGANIZATION_KYB_VERIFIED',
  'ORGANIZATION_STATUS_VALID',
  'ORGANIZATION_AML_CLEAR',
  'AUTHORIZED_REPRESENTATIVE_VERIFIED',
  'REPRESENTATIVE_AUTHORITY_CONFIRMED',
  'EVIDENCE_FRESH',
] as const;
export type EvidenceFactName = (typeof EVIDENCE_FACTS)[number];

/** Three-valued fact: `null` = MISSING (never coerced to false). */
export type Tri = boolean | null;

export type ReconciliationResult = 'CONSISTENT' | 'MISMATCH' | 'STALE' | 'INCOMPLETE';

/** Sealed private context (PLAN §18), opened inside handlerInTee. */
export interface PrivateContext {
  readonly sessionRef: string;
  readonly runId: string;
  readonly trustDomain: string;
  readonly subjectDid: string;
  readonly companyApplicantId: string;
  readonly representativeApplicantId: string;
  readonly companyBindingRef: string;
  readonly representativeBindingRef: string;
  readonly notAfter: string;
}

/** Hash-pinned acceptance rules — identical to the Bootstrap Configuration's acceptedEvidence (PLAN §16.1). */
export interface AcceptedEvidence {
  readonly evidenceProfile: EvidenceProfile;
  readonly evidenceSources: { readonly company: EvidenceSource; readonly representative: EvidenceSource };
  readonly companyLevelNames: readonly string[];
  readonly representativeLevelNames: readonly string[];
  readonly authorityRoles: readonly string[];
  readonly activeRegistryStatuses: readonly string[];
  readonly evidenceMaxAgeDays: number;
}

/** Public workflow configuration (PLAN §17.6) — safe to publish. */
export interface WorkflowConfig {
  readonly callbackUrl: string;
  readonly sumsubBaseUrl: string;
  /** Labels every result: this run's own configuration, not a claim made by the API. */
  readonly executionMode: ExecutionMode;
  readonly companyEvidence: {
    readonly source: EvidenceSource;
    readonly scenario: string;
    readonly label: string;
  };
  readonly bootstrapConfigurationHash: string;
  readonly acceptedEvidence: AcceptedEvidence;
}

/** Result envelope posted to the Catenor API (apps/api ConfidentialVerificationResult). */
export interface ResultEnvelope {
  readonly v: 1;
  readonly operation: 'TRUST_ANCHOR_ADMISSION';
  readonly runId: string;
  readonly sessionRef: string;
  readonly mode: ExecutionMode;
  readonly status: 'OK' | 'ERROR';
  readonly code?: string;
  readonly bootstrapConfigurationHash: string;
  readonly evidenceProfile: EvidenceProfile;
  readonly evidenceSources: AcceptedEvidence['evidenceSources'];
  readonly facts?: Record<EvidenceFactName, Tri>;
  readonly factReasons?: Partial<Record<EvidenceFactName, string[]>>;
  readonly reconciliation?: { company: ReconciliationResult; representative: ReconciliationResult };
  readonly evidenceCommitment?: string;
  /** commitmentInput minus the salt (PLAN §23). */
  readonly commitmentInput?: Record<string, unknown>;
}

export class TtaError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'TtaError';
  }
}
