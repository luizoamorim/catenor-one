import { commit } from '@catenor-one/audit';
import {
  authorizesAssertion,
  findVerificationMethod,
  isEd25519Multikey,
  type DidDocument,
  type KeyReferenceStatus,
  type SubjectLifecycle,
} from '@catenor-one/identity';
import type { Decision } from '@catenor-one/policy';
import type { TrustAnchorAdmissionRecord, TrustAnchorStatus } from './admission-record.js';
import {
  bootstrapConfigurationHash,
  type BootstrapConfiguration,
} from './bootstrap-configuration.js';
import {
  verificationMethodCommitment,
  verifyEndorsement,
  type BootstrapEndorsement,
} from './endorsement.js';

export type CheckBasis = 'CRYPTOGRAPHIC' | 'STRUCTURAL' | 'OPERATIONAL' | 'OPERATIONAL_PROJECTION';

export interface VerificationCheck {
  readonly id: number;
  readonly name: string;
  readonly passed: boolean;
  readonly basis: CheckBasis;
  readonly reason?: string;
}

export type DidResolution =
  | { readonly status: 'RESOLVED'; readonly document: DidDocument }
  | { readonly status: 'NOT_FOUND' | 'DEACTIVATED' };

/** Everything the verifier reads: public API projections, the committed configuration and its pin. */
export interface TrustAnchorVerificationInput {
  readonly trustDomain: string;
  readonly candidate: string;
  readonly pinnedConfigurationHash: string;
  readonly config: BootstrapConfiguration;
  /** The published policy document named by the configuration. */
  readonly policy: unknown;
  readonly resolution: DidResolution;
  readonly record: TrustAnchorAdmissionRecord | undefined;
  readonly decision: Decision | undefined;
  readonly endorsement: BootstrapEndorsement | undefined;
  /** Operational status projection (S001 lifecycle status is not cryptographically proven). */
  readonly status: {
    readonly trustAnchorStatus: TrustAnchorStatus | undefined;
    readonly verificationMethodStatus: KeyReferenceStatus | undefined;
    readonly subjectLifecycle: SubjectLifecycle | undefined;
  };
}

export interface TrustAnchorVerificationResult {
  readonly TRUST_ANCHOR_VALID: boolean;
  /** Checks 1–10: Admission provenance and bootstrap endorsement. */
  readonly admissionProvenanceVerified: boolean;
  readonly lifecycleStatusSource: 'catenor-one-operational-projection';
  /** PLAN §26.1 wording, carried with every result. */
  readonly claim: string;
  readonly checks: readonly VerificationCheck[];
}

export const S001_VERIFICATION_CLAIM =
  'S001 cryptographically verifies Admission provenance and bootstrap endorsement, while current lifecycle status is read from the Catenor One operational status projection.';

const DID_DOCUMENT_KEYS = ['assertionMethod', 'id', 'verificationMethod'];

/** `TrustAnchorVerifier` — the 12 checks of PLAN §26.2 (SPEC §27). Pure; never throws for bad input. */
export function verifyTrustAnchor(
  input: TrustAnchorVerificationInput,
): TrustAnchorVerificationResult {
  const { config, record, decision, endorsement } = input;
  const checks: VerificationCheck[] = [];
  const check = (id: number, name: string, basis: CheckBasis, passed: boolean, reason?: string) =>
    checks.push(
      passed
        ? { id, name, passed, basis }
        : { id, name, passed, basis, reason: reason ?? 'failed' },
    );

  // 1 recognized Bootstrap Configuration (trust root = out-of-band pin)
  const configHash = safe(() => bootstrapConfigurationHash(config));
  check(
    1,
    'recognized Bootstrap Configuration',
    'CRYPTOGRAPHIC',
    configHash === input.pinnedConfigurationHash,
    'configuration hash does not match the pinned hash',
  );

  // 2 resolvable candidate DID
  const document = input.resolution.status === 'RESOLVED' ? input.resolution.document : undefined;
  check(
    2,
    'resolvable candidate DID',
    'OPERATIONAL',
    document !== undefined,
    `DID ${input.resolution.status}`,
  );

  // 3 valid DID Document
  const documentValid =
    document !== undefined &&
    document.id === input.candidate &&
    Object.keys(document).sort().join() === DID_DOCUMENT_KEYS.join() &&
    document.verificationMethod.every(
      (vm) =>
        vm.controller === input.candidate &&
        vm.type === 'Multikey' &&
        isEd25519Multikey(vm.publicKeyMultibase),
    );
  check(
    3,
    'valid DID Document',
    'STRUCTURAL',
    documentValid,
    'DID Document is not a valid minimized document',
  );

  // 4 valid assertion VM, bound by the endorsement (detects key replacement under the same id — TV-S001-J07)
  const vmId = record?.verificationMethod;
  const vm = document && vmId ? findVerificationMethod(document, vmId) : undefined;
  check(
    4,
    'valid assertion Verification Method',
    'CRYPTOGRAPHIC',
    vm !== undefined &&
      document !== undefined &&
      authorizesAssertion(document, vm.id) &&
      endorsement !== undefined &&
      endorsement.verificationMethod === vm.id &&
      verificationMethodCommitment(vm) === endorsement.verificationMethodCommitment,
    'Verification Method missing, not for assertion, or not the endorsed verificationMethodCommitment',
  );

  // 5 matching Admission Record
  check(
    5,
    'matching Admission Record',
    'OPERATIONAL',
    record !== undefined &&
      record.trustAnchor === input.candidate &&
      record.trustDomain === input.trustDomain,
    'no Admission Record for (trustDomain, DID)',
  );

  // 6 matching Trust Domain
  check(
    6,
    'matching Trust Domain',
    'CRYPTOGRAPHIC',
    record !== undefined &&
      endorsement !== undefined &&
      record.trustDomain === endorsement.trustDomain &&
      endorsement.trustDomain === config.trustDomain,
    'Trust Domain differs between record, endorsement and configuration',
  );

  // 7 identifiable policy / version
  const policyId = isRecord(input.policy) ? input.policy.id : undefined;
  check(
    7,
    'identifiable policy/version',
    'CRYPTOGRAPHIC',
    record !== undefined &&
      endorsement !== undefined &&
      record.admissionPolicy === endorsement.admissionPolicy &&
      endorsement.admissionPolicy === config.admissionPolicy &&
      policyId === config.admissionPolicy,
    'policy identifier differs or policy not resolvable',
  );

  // 8 matching policy hash
  const policyCommitment = safe(() => commit(input.policy));
  check(
    8,
    'matching policy hash',
    'CRYPTOGRAPHIC',
    record !== undefined &&
      endorsement !== undefined &&
      policyCommitment === record.policyHash &&
      record.policyHash === endorsement.policyHash &&
      endorsement.policyHash === config.admissionPolicyHash,
    'policy hash differs between published policy, record, endorsement and configuration',
  );

  // 9 successful Decision, committed by the endorsement
  check(
    9,
    'successful Decision',
    'CRYPTOGRAPHIC',
    decision !== undefined &&
      record !== undefined &&
      endorsement !== undefined &&
      decision.decision === 'ALLOW' &&
      decision.subject === input.candidate &&
      decision.policy === record.admissionPolicy &&
      decision.resource === record.trustDomain &&
      decision.evidenceCommitment === record.evidenceCommitment &&
      record.decisionRef === endorsement.decisionRef &&
      safe(() => commit(decision)) === endorsement.decisionCommitment,
    'Decision is not ALLOW or does not match the record and endorsement',
  );

  // 10 valid bootstrap endorsement; every endorsed field equals the record field
  let endorsementOk = false;
  let endorsementReason = 'missing bootstrap endorsement';
  if (
    endorsement !== undefined &&
    record !== undefined &&
    decision !== undefined &&
    vm !== undefined
  ) {
    const verification = verifyEndorsement(endorsement, {
      config,
      candidate: input.candidate,
      verificationMethod: vm,
      decision,
      decisionRef: record.decisionRef,
      policyHash: record.policyHash,
      evidenceCommitment: record.evidenceCommitment,
    });
    const fieldsMatch =
      endorsement.candidate === record.trustAnchor &&
      endorsement.trustDomain === record.trustDomain &&
      endorsement.admissionPolicy === record.admissionPolicy &&
      endorsement.policyHash === record.policyHash &&
      endorsement.verificationMethod === record.verificationMethod &&
      endorsement.evidenceCommitment === record.evidenceCommitment &&
      endorsement.decisionRef === record.decisionRef &&
      endorsement.id === record.bootstrapEndorsementRef &&
      endorsement.bootstrapConfigurationHash === input.pinnedConfigurationHash;
    endorsementOk = verification.valid && fieldsMatch;
    endorsementReason = verification.valid
      ? 'endorsed fields do not match the Admission Record'
      : verification.failures.join(', ');
  } else if (endorsement !== undefined) {
    endorsementReason = 'record, decision or Verification Method unavailable';
  }
  check(10, 'valid bootstrap endorsement', 'CRYPTOGRAPHIC', endorsementOk, endorsementReason);

  // 11 ACTIVE status (operational projection)
  check(
    11,
    'ACTIVE status',
    'OPERATIONAL_PROJECTION',
    input.status.trustAnchorStatus === 'ACTIVE',
    `status is ${input.status.trustAnchorStatus ?? 'absent'}`,
  );

  // 12 non-revoked verification state (operational projection)
  check(
    12,
    'non-revoked verification state',
    'OPERATIONAL_PROJECTION',
    input.status.verificationMethodStatus === 'ACTIVE' &&
      input.status.subjectLifecycle === 'ACTIVE',
    'Verification Method or Subject is not ACTIVE',
  );

  return {
    TRUST_ANCHOR_VALID: checks.every((c) => c.passed),
    admissionProvenanceVerified: checks.filter((c) => c.id <= 10).every((c) => c.passed),
    lifecycleStatusSource: 'catenor-one-operational-projection',
    claim: S001_VERIFICATION_CLAIM,
    checks,
  };
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
