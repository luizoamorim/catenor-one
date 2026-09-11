// S001 persistence ports (PLAN §4, §10; TASKS T3.3 — minimum set for the demo path). Defined by the
// application layer; implemented in infrastructure (Prisma). Only what the S001 vertical path uses.
import type { AuditEvent, ChainedAuditEvent } from '@catenor-one/audit';
import type {
  AdmissionPhase,
  BootstrapEndorsement,
  ChallengeRecord,
  TrustAnchorAdmissionRecord,
  TrustAnchorStatus,
} from '@catenor-one/authority';
import type {
  DidDocument,
  KeyManagementReference,
  SubjectLifecycle,
  SubjectType,
  VerificationMethod,
} from '@catenor-one/identity';
import type {
  Decision,
  FactInput,
  FactName,
  FactSource,
  RequirementStatus,
} from '@catenor-one/policy';

// ---- SubjectRegistry --------------------------------------------------------------------------------

export type ProviderBindingRole = 'COMPANY' | 'REPRESENTATIVE';
export type ProviderBindingStatus =
  'PENDING_ATTACHMENT' | 'ATTACHED_UNVERIFIED' | 'BINDING_VERIFIED' | 'BINDING_MISMATCH';

export interface StoredSubject {
  readonly id: string;
  readonly did: string;
  readonly type: SubjectType;
  readonly lifecycle: SubjectLifecycle;
}

/** Private provider binding (PLAN §4.2): bindingRef exists before any external subject reference. */
export interface ProviderBinding {
  readonly id: string;
  readonly subjectId: string;
  readonly provider: string;
  readonly role: ProviderBindingRole;
  readonly bindingRef: string;
  readonly externalSubjectId?: string;
  readonly status: ProviderBindingStatus;
}

export interface SubjectRegistry {
  createSubject(subject: StoredSubject): Promise<void>;
  findSubjectByDid(did: string): Promise<StoredSubject | undefined>;
  findSubjectById(id: string): Promise<StoredSubject | undefined>;
  createProviderBindings(
    bindings: readonly Omit<ProviderBinding, 'externalSubjectId' | 'status'>[],
  ): Promise<void>;
  listProviderBindings(subjectId: string): Promise<ProviderBinding[]>;
  /** Attaches (or re-attaches) the external reference; the binding becomes ATTACHED_UNVERIFIED. */
  attachProviderReference(
    subjectId: string,
    role: ProviderBindingRole,
    externalSubjectId: string,
  ): Promise<void>;
  /** Records the confidential binding-gate outcome. */
  setProviderBindingStatus(
    subjectId: string,
    role: ProviderBindingRole,
    status: 'BINDING_VERIFIED' | 'BINDING_MISMATCH',
  ): Promise<void>;
}

// ---- DidStateRegistry -------------------------------------------------------------------------------

export interface DidStateRegistry {
  /** Publishes the (regenerated) DID Document, its assertion Verification Method and the private key ref. */
  publishAssertionKey(input: {
    readonly document: DidDocument;
    readonly lifecycle: SubjectLifecycle;
    readonly verificationMethod: VerificationMethod;
    readonly subjectId: string;
    readonly keyReference: KeyManagementReference;
    /** Signer adapter name (e.g. "privy"; "fake" only outside production). */
    readonly adapter: string;
  }): Promise<void>;
  resolve(
    did: string,
  ): Promise<{ readonly document: DidDocument; readonly lifecycle: SubjectLifecycle } | undefined>;
  findKeyReference(verificationMethodId: string): Promise<KeyManagementReference | undefined>;
  verificationMethodStatus(verificationMethodId: string): Promise<'ACTIVE' | 'REVOKED' | undefined>;
}

// ---- AdmissionRepository ----------------------------------------------------------------------------

export interface AdmissionSession {
  readonly id: string;
  readonly sessionRef: string;
  readonly trustDomain: string;
  readonly subjectId: string;
  /** HMAC-SHA256(OPERATOR_REF_KEY, privyUserId); never the operator email. */
  readonly operatorRef: string;
  readonly state: AdmissionPhase;
  readonly providerRefsAttached: boolean;
  readonly assertionVerificationMethod?: string;
  /** undefined = not established (FALSE vs MISSING stay distinct). */
  readonly keyPossessionValid?: boolean;
  readonly keyPurposeValid?: boolean;
  readonly keyPossessionReasons: readonly string[];
}

export type AdmissionSessionUpdate = Partial<
  Pick<
    AdmissionSession,
    | 'state'
    | 'providerRefsAttached'
    | 'assertionVerificationMethod'
    | 'keyPossessionValid'
    | 'keyPurposeValid'
    | 'keyPossessionReasons'
  >
>;

export type EvidenceSourceLabel = 'SYNTHETIC_MOCK' | 'REAL_SUMSUB_SANDBOX';

export interface VerificationRun {
  readonly runId: string;
  readonly sessionId: string;
  /** 1..MAX_VERIFICATION_RUNS. */
  readonly attempt: number;
  readonly operation: string;
  readonly creWorkflowId: string;
  readonly deadlineAt: Date;
  readonly evidenceSources: {
    readonly company: EvidenceSourceLabel;
    readonly representative: EvidenceSourceLabel;
  };
}

export interface VerificationRunResult {
  readonly status: 'EVIDENCE_RECEIVED' | 'ERROR' | 'TIMED_OUT' | 'BINDING_MISMATCH';
  readonly code?: string;
  /** Only with EVIDENCE_RECEIVED. */
  readonly facts?: readonly FactInput[];
  readonly evidenceCommitment?: string;
  /** observedAt, response digests, provider-reference digests — never salt or content. */
  readonly commitmentInputs?: unknown;
  readonly bootstrapConfigurationHashEcho?: string;
  readonly resultAuth?: unknown;
}

export interface StoredVerificationRun extends VerificationRun {
  readonly status: 'PENDING' | VerificationRunResult['status'];
  readonly code?: string;
  readonly facts?: readonly FactInput[];
  readonly evidenceCommitment?: string;
  readonly commitmentInputs?: unknown;
}

export interface DecisionTraceEntry {
  readonly claim: FactName;
  readonly status: RequirementStatus;
  /** Absent when MISSING. */
  readonly factValue?: boolean;
  readonly provenance?: { readonly source: FactSource; readonly ref: string };
  readonly reasons: readonly string[];
}

export interface AdmissionRepository {
  createSession(session: AdmissionSession): Promise<void>;
  loadSession(sessionRef: string): Promise<AdmissionSession | undefined>;
  updateSession(id: string, update: AdmissionSessionUpdate): Promise<void>;

  issueChallenge(sessionId: string, record: ChallengeRecord): Promise<void>;
  loadChallenge(challengeId: string): Promise<ChallengeRecord | undefined>;
  /** Atomic single-use consume (ISSUED → CONSUMED); false when already consumed (TV-S001-D04). */
  consumeChallenge(challengeId: string, consumedAt: Date): Promise<boolean>;

  createVerificationRun(run: VerificationRun): Promise<void>;
  loadVerificationRun(runId: string): Promise<StoredVerificationRun | undefined>;
  /** Runs of one session in attempt order. */
  listVerificationRuns(sessionId: string): Promise<StoredVerificationRun[]>;
  /** Accepts exactly one result per run (PENDING → result); false for late/duplicate results. */
  recordVerificationResult(runId: string, result: VerificationRunResult): Promise<boolean>;

  /** Private Decision + trace; an ALLOW Decision is also published (DecisionProjection). */
  recordDecision(input: {
    readonly sessionId: string;
    readonly decisionRef: string;
    readonly decision: Decision;
    readonly decisionCommitment: string;
    readonly policyHash: string;
    readonly errorReason?: string;
    readonly trace: readonly DecisionTraceEntry[];
  }): Promise<void>;
  /** The session's Decision (private record), if any. */
  loadDecision(sessionId: string): Promise<StoredDecision | undefined>;
  /** A published (ALLOW) Decision — the public projection used by Trust Anchor verification. */
  loadPublishedDecision(decisionRef: string): Promise<Decision | undefined>;
  saveEndorsement(endorsement: BootstrapEndorsement): Promise<void>;
  loadEndorsement(id: string): Promise<BootstrapEndorsement | undefined>;
  saveAdmissionRecord(id: string, record: TrustAnchorAdmissionRecord): Promise<void>;
  loadAdmissionRecord(
    trustDomain: string,
    trustAnchor: string,
  ): Promise<TrustAnchorAdmissionRecord | undefined>;
}

export interface StoredDecision {
  readonly decisionRef: string;
  readonly decision: Decision;
  readonly decisionCommitment: string;
  readonly policyHash: string;
  readonly errorReason?: string;
  readonly trace: readonly DecisionTraceEntry[];
}

// ---- TrustAnchorRegistry ----------------------------------------------------------------------------

export interface TrustAnchorRegistry {
  /** Idempotent; refuses a different configuration hash for an existing Trust Domain. */
  registerTrustDomain(id: string, bootstrapConfigurationHash: string): Promise<void>;
  /** Sets the single initial root (from NULL only) and its ACTIVE status; requires the Admission Record. */
  establishInitialTrustAnchor(
    trustDomain: string,
    did: string,
    at: Date,
  ): Promise<'ESTABLISHED' | 'INITIAL_TRUST_ANCHOR_EXISTS'>;
  /** The Trust Domain's initial root, if established. */
  initialTrustAnchor(trustDomain: string): Promise<string | undefined>;
  status(
    trustDomain: string,
    did: string,
  ): Promise<{ readonly status: TrustAnchorStatus; readonly changedAt: Date } | undefined>;
}

// ---- AuditLog ---------------------------------------------------------------------------------------

export interface AuditLog {
  /** Appends to the Trust Domain's hash chain (linked to the current head, serialized per domain). */
  append(trustDomain: string, event: AuditEvent): Promise<ChainedAuditEvent>;
  timeline(trustDomain: string): Promise<ChainedAuditEvent[]>;
}

// ---- UnitOfWork -------------------------------------------------------------------------------------

export interface PersistencePorts {
  readonly subjects: SubjectRegistry;
  readonly didState: DidStateRegistry;
  readonly admissions: AdmissionRepository;
  readonly trustAnchors: TrustAnchorRegistry;
  readonly audit: AuditLog;
}

export interface UnitOfWork {
  /** Runs `work` in one database transaction: everything commits or nothing does. */
  run<T>(work: (ports: PersistencePorts) => Promise<T>): Promise<T>;
}
