// @catenor-one/identity — Canonical Subject, did:catenor, Verification Methods, Multikey, DID Document,
// key purposes (PLAN §3.2).
export {
  CATENOR_DID_PATTERN,
  CATENOR_DID_PREFIX,
  CATENOR_DID_RANDOM_BYTES,
  generateCatenorDid,
  isCatenorDid,
  parseCatenorDid,
  type CatenorDid,
} from './did.js';
export {
  SUBJECT_LIFECYCLES,
  SUBJECT_TYPES,
  createSubject,
  type Subject,
  type SubjectLifecycle,
  type SubjectType,
} from './subject.js';
export {
  ED25519_PUBLIC_KEY_LENGTH,
  decodeEd25519Multikey,
  encodeEd25519Multikey,
  isEd25519Multikey,
} from './multikey.js';
export {
  assertionKeyId,
  controllerOf,
  createVerificationMethod,
  verificationMethodId,
  type VerificationMethod,
  type VerificationMethodId,
} from './verification-method.js';
export {
  authorizesAssertion,
  createDidDocument,
  findVerificationMethod,
  type DidDocument,
} from './did-document.js';
export {
  KEY_PURPOSES,
  KEY_REFERENCE_STATUSES,
  KeyPurposeCollisionError,
  bindKeyPurpose,
  type KeyBinding,
  type KeyManagementReference,
  type KeyPurpose,
  type KeyReferenceStatus,
} from './key-management.js';
