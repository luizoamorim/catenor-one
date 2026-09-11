import type { Commitment } from '@catenor-one/audit';
import type { BootstrapEndorsement } from './endorsement.js';

export const TRUST_ANCHOR_STATUSES = ['ACTIVE', 'SUSPENDED', 'REVOKED', 'DEACTIVATED'] as const;
export type TrustAnchorStatus = (typeof TRUST_ANCHOR_STATUSES)[number];

/**
 * Trust Anchor Admission Record (SPEC §21). `trustDomain` and `bootstrapEndorsementRef` are Catenor One
 * [REF-IMPL] extensions of the protocol draft shape (D14); no other fields are added.
 */
export interface TrustAnchorAdmissionRecord {
  readonly type: 'CatenorTrustAnchorAdmissionRecord';
  readonly trustDomain: string;
  readonly trustAnchor: string;
  readonly admissionPolicy: string;
  readonly policyHash: Commitment;
  readonly decision: 'ADMIT_TRUST_ANCHOR';
  readonly verificationMethod: string;
  readonly evidenceCommitment: Commitment;
  readonly createdAt: string;
  readonly decisionRef: string;
  readonly bootstrapEndorsementRef: string;
}

/**
 * Derives the record from a verified endorsement: every record field equals its endorsed counterpart,
 * so later tampering is detectable by the Trust Anchor verifier (TV-S001-J02, J03).
 * Callers must have verified the endorsement first ({@link TrustAnchorAdmission.admit} enforces this).
 */
export function createAdmissionRecord(
  endorsement: BootstrapEndorsement,
  createdAt: string,
): TrustAnchorAdmissionRecord {
  return {
    type: 'CatenorTrustAnchorAdmissionRecord',
    trustDomain: endorsement.trustDomain,
    trustAnchor: endorsement.candidate,
    admissionPolicy: endorsement.admissionPolicy,
    policyHash: endorsement.policyHash,
    decision: 'ADMIT_TRUST_ANCHOR',
    verificationMethod: endorsement.verificationMethod,
    evidenceCommitment: endorsement.evidenceCommitment,
    createdAt,
    decisionRef: endorsement.decisionRef,
    bootstrapEndorsementRef: endorsement.id,
  };
}
