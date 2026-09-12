// @catenor-one/authority — Trust Domain bootstrap, key possession, bootstrap endorsement, Trust Anchor
// Admission and verification (PLAN §3.5).
export {
  EVIDENCE_PROFILES,
  InvalidBootstrapConfigurationError,
  TRUST_DOMAIN_PATTERN,
  bootstrapConfigurationHash,
  parseBootstrapConfiguration,
  parseTrustDomainId,
  type AcceptedEvidence,
  type BootstrapConfiguration,
  type EvidenceProfile,
  type EvidenceSource,
  type TrustDomainId,
} from './bootstrap-configuration.js';
export {
  ADMIT_TRUST_ANCHOR,
  CHALLENGE_TTL_SECONDS,
  consumeChallenge,
  issueChallenge,
  verifyKeyPossession,
  type ChallengeRecord,
  type ChallengeStatus,
  type KeyPossessionChallenge,
  type KeyPossessionReason,
  type KeyPossessionResult,
  type VerifyKeyPossessionInput,
} from './key-possession.js';
export {
  EndorsementRefusedError,
  assembleEndorsement,
  buildEndorsementPayload,
  decisionCommitment,
  prepareEndorsementProof,
  verificationMethodCommitment,
  verifyEndorsement,
  type BootstrapEndorsement,
  type BootstrapEndorsementPayload,
  type BuildEndorsementInput,
  type EndorsementExpectation,
  type EndorsementFailure,
  type EndorsementVerification,
} from './endorsement.js';
export {
  TRUST_ANCHOR_STATUSES,
  createAdmissionRecord,
  type TrustAnchorAdmissionRecord,
  type TrustAnchorStatus,
} from './admission-record.js';
export {
  IllegalTransitionError,
  MAX_VERIFICATION_RUNS,
  TrustAnchorAdmission,
  type AdmissionHistoryEntry,
  type AdmissionPhase,
  type VerificationFailureCode,
} from './admission.js';
export {
  S001_VERIFICATION_CLAIM,
  verifyTrustAnchor,
  type CheckBasis,
  type DidResolution,
  type TrustAnchorVerificationInput,
  type TrustAnchorVerificationResult,
  type VerificationCheck,
} from './trust-anchor-verifier.js';
export {
  TOKENIZE_ASSET,
  EXECUTE_DISTRIBUTION,
  DEFINE_OFFERING_POLICY,
  CREATE_AGENT,
  CREATE_DISTRIBUTION,
  DELEGATE_DISTRIBUTION_AUTHORITY,
  SPONSOR_CAPABILITIES,
  DELEGABLE_ACTIONS,
  authorizeDelegatedCapability,
  authorizeWithCapability,
  createCapabilityGrant,
  prepareCapabilityGrantProof,
  type AuthorityChainEdge,
  type Capability,
  type CapabilityAuthorization,
  type DelegatedAuthorization,
  type CapabilityDenialReason,
  type CapabilityGrant,
  type CapabilityGrantPayload,
} from './capability.js';
export {
  RELATIONSHIP_CREDENTIAL,
  RELATIONSHIP_PREDICATES,
  createRelationshipCredential,
  prepareRelationshipProof,
  verifyRelationshipCredential,
  type RelationshipPredicate,
  type RelationshipVerification,
} from './relationship.js';
export {
  authorizeOfferingDefinition,
  createOfferingDefinition,
  prepareOfferingProof,
  type OfferingDefinition,
  type OfferingDefinitionPayload,
  type OfferingDenialReason,
} from './offering.js';
