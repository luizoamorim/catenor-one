// S001 non-persistence ports (PLAN §5). Signers take STRUCTURED input only — never arbitrary bytes; the
// signer boundary builds the canonical message itself (PLAN §13.4, D33).
import type {
  BootstrapConfiguration,
  BootstrapEndorsement,
  BootstrapEndorsementPayload,
  CapabilityGrant,
  CapabilityGrantPayload,
  KeyPossessionChallenge,
  OfferingDefinitionPayload,
} from '@catenor-one/authority';
import type {
  Credential,
  CredentialStatusStatement,
  DataIntegrityProof,
  Presentation,
  ProofOptions,
} from '@catenor-one/credentials';
import type { CatenorDid } from '@catenor-one/identity';
import type { FactName } from '@catenor-one/policy';
import type { EvidenceSourceLabel } from './persistence.ports.js';

/** Where a result or signature really came from — shown to judges, never blurred. */
export type IntegrationMode = 'DEPLOYED' | 'SIMULATION' | 'FAKE';

/**
 * Clean-room demo [REF-IMPL]: structured documents a Subject's key may sign. Issuer statements (credential, status
 * statement, offering) use `assertionMethod`; a holder's presentation uses `authentication`.
 */
export type SignableDocument =
  | { readonly kind: 'CREDENTIAL'; readonly credential: Credential }
  | { readonly kind: 'STATUS_STATEMENT'; readonly statement: CredentialStatusStatement }
  | { readonly kind: 'OFFERING'; readonly offering: OfferingDefinitionPayload }
  | {
      readonly kind: 'PRESENTATION';
      readonly presentation: Presentation;
      readonly challenge: string;
      readonly domain: string;
    };

export interface AssertionSigner {
  /** Adapter name stored with the key reference ("privy"; "fake" only outside production). */
  readonly adapter: string;
  /**
   * CREDENTIAL_ASSERTION: an issuer's assertion key. AUTHENTICATION (clean-room demo): a holder key for Verifiable
   * Presentation proofs — a separate key, never the Subject's financial account.
   */
  createKey(input: {
    readonly subject: CatenorDid;
    readonly purpose: 'CREDENTIAL_ASSERTION' | 'AUTHENTICATION';
  }): Promise<{ readonly signerRef: string; readonly publicKeyMultibase: string }>;
  /** Signs a key-possession proof for `challenge` (eddsa-jcs-2022 hashData built inside the signer). */
  signKeyPossessionProof(
    signerRef: string,
    input: {
      readonly challenge: KeyPossessionChallenge;
      readonly proofOptions: Omit<ProofOptions, 'type' | 'cryptosuite'>;
    },
  ): Promise<DataIntegrityProof>;
  /**
   * Signs a scoped capability grant issued by this key's Subject (Part B, [REF-IMPL]) — an assertion under
   * `assertionMethod`, never a financial action. The eddsa-jcs-2022 hashData is built inside the signer.
   */
  signCapabilityGrant(
    signerRef: string,
    input: {
      readonly grant: CapabilityGrantPayload;
      readonly verificationMethod: string;
      readonly created: string;
    },
  ): Promise<CapabilityGrant>;
  /** Signs one structured document (the signer boundary builds its hashData); returns the proof to attach. */
  signDocument(
    signerRef: string,
    input: {
      readonly document: SignableDocument;
      readonly verificationMethod: string;
      readonly created: string;
    },
  ): Promise<DataIntegrityProof>;
}

export interface BootstrapEndorsementSigner {
  readonly adapter: string;
  publicKeyMultibase(): Promise<string>;
  signEndorsement(input: {
    readonly payload: BootstrapEndorsementPayload;
    readonly config: BootstrapConfiguration;
    readonly created: string;
  }): Promise<BootstrapEndorsement>;
}

/** Private context handed to the confidential workflow (sealed by the adapter; PLAN §17.4 step 3). */
export interface PrivateVerificationContext {
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

export interface ConfidentialEvidenceVerifier {
  readonly mode: IntegrationMode;
  /** Workflow identifier recorded with the run (e.g. the deployed CRE workflow ID). */
  readonly workflowId: string;
  request(input: {
    readonly operation: 'TRUST_ANCHOR_ADMISSION';
    readonly runId: string;
    readonly context: PrivateVerificationContext;
  }): Promise<{ readonly executionId: string }>;
}

/** The six evidence facts a confidential run may produce (the two key facts never come from it). */
export type EvidenceFactName = Exclude<
  FactName,
  'ASSERTION_KEY_POSSESSION_VALID' | 'ASSERTION_KEY_PURPOSE_VALID'
>;

/** Explanatory reconciliation of one provider observation (Delivery plan §"Minimal reconciliation"). */
export type ReconciliationResult = 'CONSISTENT' | 'MISMATCH' | 'STALE' | 'INCOMPLETE';

/** Result envelope of a confidential run (PLAN §17.4 step 11). Facts: `null` = MISSING. */
export interface ConfidentialVerificationResult {
  readonly v: 1;
  readonly operation: 'TRUST_ANCHOR_ADMISSION';
  readonly runId: string;
  readonly sessionRef: string;
  readonly mode: IntegrationMode;
  readonly status: 'OK' | 'ERROR';
  readonly code?: string;
  readonly bootstrapConfigurationHash: string;
  readonly evidenceProfile: 'HYBRID_DEMO' | 'FULL_SUMSUB_SANDBOX';
  readonly evidenceSources: {
    readonly company: EvidenceSourceLabel;
    readonly representative: EvidenceSourceLabel;
  };
  readonly facts?: Readonly<Record<EvidenceFactName, boolean | null>>;
  /** Sanitized private reason codes per fact (e.g. INCONSISTENT_PROVIDER_STATE, SANCTIONS). */
  readonly factReasons?: Readonly<Partial<Record<EvidenceFactName, readonly string[]>>>;
  readonly reconciliation?: Readonly<{
    company: ReconciliationResult;
    representative: ReconciliationResult;
  }>;
  readonly evidenceCommitment?: string;
  /** commitmentInput minus the salt — digests and metadata only, never provider content. */
  readonly commitmentInput?: unknown;
}

export interface BootstrapConfigurationSource {
  /** The pinned Bootstrap Configuration and its hash (fails if it does not match the pin). */
  load(): { readonly config: BootstrapConfiguration; readonly hash: string };
}

export interface AdmissionPolicySource {
  /** The packaged admission policy document (its hash is checked against the configuration). */
  load(): unknown;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  id(prefix: string): string;
  randomBytes(length: number): Uint8Array;
}
