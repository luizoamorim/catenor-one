// @catenor-one/credentials — W3C Data Integrity eddsa-jcs-2022 hashing and verification (PLAN §3.3).
export {
  DATA_INTEGRITY_PROOF,
  ED25519_SIGNATURE_LENGTH,
  EDDSA_JCS_2022,
  HASH_DATA_LENGTH,
  ProofConfigurationError,
  attachProofValue,
  canonicalProofConfiguration,
  decodeProofValue,
  hashData,
  prepareProof,
  transformDocument,
  verifyProof,
  verifySecuredDocument,
  type DataIntegrityProof,
  type ProofOptions,
} from './eddsa-jcs-2022.js';
