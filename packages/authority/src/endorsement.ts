import { commit, type Commitment } from '@catenor-one/audit';
import {
  prepareProof,
  verifyProof,
  type DataIntegrityProof,
  type ProofOptions,
} from '@catenor-one/credentials';
import { decodeEd25519Multikey, type VerificationMethod } from '@catenor-one/identity';
import type { Decision } from '@catenor-one/policy';
import {
  bootstrapConfigurationHash,
  type BootstrapConfiguration,
} from './bootstrap-configuration.js';

/**
 * `verificationMethodCommitment` [REF-IMPL] (maintainer decision Q1, PLAN §16.2): a commitment to the
 * complete canonical Verification Method `{id, controller, type, publicKeyMultibase}` — not only the key.
 */
export function verificationMethodCommitment(vm: VerificationMethod): Commitment {
  return commit({
    id: vm.id,
    controller: vm.controller,
    type: vm.type,
    publicKeyMultibase: vm.publicKeyMultibase,
  });
}

/** `decisionCommitment = commit(Decision)` (PLAN §16.2). */
export function decisionCommitment(decision: Decision): Commitment {
  return commit(decision);
}

/** The endorsed fields — everything the bootstrap signature covers (PLAN §16.2, SPEC §8). */
export interface BootstrapEndorsementPayload {
  readonly type: 'CatenorOneBootstrapEndorsement';
  readonly id: string;
  readonly trustDomain: string;
  readonly bootstrapConfigurationHash: Commitment;
  readonly candidate: string;
  readonly verificationMethod: string;
  readonly verificationMethodCommitment: Commitment;
  readonly admissionPolicy: string;
  readonly policyHash: Commitment;
  readonly decisionRef: string;
  readonly decisionCommitment: Commitment;
  readonly evidenceCommitment: Commitment;
  readonly endorsedAt: string;
}

/** Bootstrap endorsement [REF-IMPL proof envelope]: the payload plus an eddsa-jcs-2022 proof. */
export interface BootstrapEndorsement extends BootstrapEndorsementPayload {
  readonly proof: DataIntegrityProof;
}

export class EndorsementRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EndorsementRefusedError';
  }
}

export interface BuildEndorsementInput {
  readonly config: BootstrapConfiguration;
  readonly decision: Decision;
  readonly decisionRef: string;
  /** The assertion Verification Method used for Admission, as resolved from public DID state. */
  readonly verificationMethod: VerificationMethod;
  readonly endorsementId: string;
  readonly endorsedAt: string;
}

/**
 * Builds the payload to endorse. Only an ALLOW Decision can be endorsed (AC-S001-045, TV-S001-G02);
 * the Decision must match the configuration and the candidate.
 */
export function buildEndorsementPayload(input: BuildEndorsementInput): BootstrapEndorsementPayload {
  const { config, decision, verificationMethod: vm } = input;
  if (decision.decision !== 'ALLOW') {
    throw new EndorsementRefusedError(`a ${decision.decision} decision cannot be endorsed`);
  }
  if (decision.policy !== config.admissionPolicy) {
    throw new EndorsementRefusedError('decision policy does not match the Bootstrap Configuration');
  }
  if (decision.resource !== config.trustDomain) {
    throw new EndorsementRefusedError('decision resource does not match the Trust Domain');
  }
  if (decision.subject !== vm.controller) {
    throw new EndorsementRefusedError(
      'verification method is not controlled by the decision subject',
    );
  }
  return {
    type: 'CatenorOneBootstrapEndorsement',
    id: input.endorsementId,
    trustDomain: config.trustDomain,
    bootstrapConfigurationHash: bootstrapConfigurationHash(config),
    candidate: decision.subject,
    verificationMethod: vm.id,
    verificationMethodCommitment: verificationMethodCommitment(vm),
    admissionPolicy: config.admissionPolicy,
    policyHash: config.admissionPolicyHash,
    decisionRef: input.decisionRef,
    decisionCommitment: decisionCommitment(decision),
    evidenceCommitment: decision.evidenceCommitment,
    endorsedAt: input.endorsedAt,
  };
}

/** Proof options for the bootstrap signature; the signer boundary signs the returned `hashData`. */
export function prepareEndorsementProof(
  payload: BootstrapEndorsementPayload,
  config: BootstrapConfiguration,
  created: string,
): { proofOptions: ProofOptions; hashData: Uint8Array } {
  return prepareProof(
    { ...payload },
    {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: config.bootstrapVerificationMethod,
      proofPurpose: 'assertionMethod',
      created,
    },
  );
}

export function assembleEndorsement(
  payload: BootstrapEndorsementPayload,
  proof: DataIntegrityProof,
): BootstrapEndorsement {
  return { ...payload, proof };
}

export type EndorsementFailure =
  | 'SIGNATURE_INVALID'
  | 'BOOTSTRAP_KEY_MISMATCH'
  | 'CONFIGURATION_HASH_MISMATCH'
  | 'TRUST_DOMAIN_MISMATCH'
  | 'POLICY_MISMATCH'
  | 'POLICY_HASH_MISMATCH'
  | 'CANDIDATE_MISMATCH'
  | 'VERIFICATION_METHOD_MISMATCH'
  | 'VERIFICATION_METHOD_COMMITMENT_MISMATCH'
  | 'DECISION_NOT_ALLOW'
  | 'DECISION_REF_MISMATCH'
  | 'DECISION_COMMITMENT_MISMATCH'
  | 'EVIDENCE_COMMITMENT_MISMATCH';

/** What the endorsement is checked against at activation or verification time. */
export interface EndorsementExpectation {
  readonly config: BootstrapConfiguration;
  readonly candidate: string;
  /** The Verification Method currently resolved for the candidate (detects key replacement). */
  readonly verificationMethod: VerificationMethod;
  readonly decision: Decision;
  readonly decisionRef: string;
  /** Policy hash recorded by the runtime Admission state (TV-S001-G04). */
  readonly policyHash: string;
  readonly evidenceCommitment: string;
}

export interface EndorsementVerification {
  readonly valid: boolean;
  readonly failures: readonly EndorsementFailure[];
}

/** Verifies the bootstrap signature and every endorsed field (PLAN §16.3; TV-S001-G01, G03–G06). */
export function verifyEndorsement(
  endorsement: BootstrapEndorsement,
  expected: EndorsementExpectation,
): EndorsementVerification {
  const failures: EndorsementFailure[] = [];
  const { config } = expected;
  const { proof, ...payload } = endorsement;

  if (proof?.verificationMethod !== config.bootstrapVerificationMethod) {
    failures.push('BOOTSTRAP_KEY_MISMATCH');
  } else {
    let signatureValid: boolean;
    try {
      signatureValid = verifyProof(
        { ...payload },
        proof,
        decodeEd25519Multikey(config.bootstrapPublicKeyMultibase),
      );
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) failures.push('SIGNATURE_INVALID');
  }

  if (endorsement.bootstrapConfigurationHash !== bootstrapConfigurationHash(config)) {
    failures.push('CONFIGURATION_HASH_MISMATCH');
  }
  if (endorsement.trustDomain !== config.trustDomain) failures.push('TRUST_DOMAIN_MISMATCH');
  if (endorsement.admissionPolicy !== config.admissionPolicy) failures.push('POLICY_MISMATCH');
  if (
    endorsement.policyHash !== config.admissionPolicyHash ||
    endorsement.policyHash !== expected.policyHash
  ) {
    failures.push('POLICY_HASH_MISMATCH');
  }
  if (endorsement.candidate !== expected.candidate) failures.push('CANDIDATE_MISMATCH');
  if (
    endorsement.verificationMethod !== expected.verificationMethod.id ||
    expected.verificationMethod.controller !== expected.candidate
  ) {
    failures.push('VERIFICATION_METHOD_MISMATCH');
  }
  if (
    endorsement.verificationMethodCommitment !==
    verificationMethodCommitment(expected.verificationMethod)
  ) {
    failures.push('VERIFICATION_METHOD_COMMITMENT_MISMATCH');
  }
  if (expected.decision.decision !== 'ALLOW') failures.push('DECISION_NOT_ALLOW');
  if (endorsement.decisionRef !== expected.decisionRef) failures.push('DECISION_REF_MISMATCH');
  if (endorsement.decisionCommitment !== decisionCommitment(expected.decision)) {
    failures.push('DECISION_COMMITMENT_MISMATCH');
  }
  if (
    endorsement.evidenceCommitment !== expected.evidenceCommitment ||
    endorsement.evidenceCommitment !== expected.decision.evidenceCommitment
  ) {
    failures.push('EVIDENCE_COMMITMENT_MISMATCH');
  }
  return { valid: failures.length === 0, failures };
}
