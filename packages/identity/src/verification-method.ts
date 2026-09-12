import { isCatenorDid, type CatenorDid } from './did.js';
import { isEd25519Multikey } from './multikey.js';

/** `<did>#<fragment>`, e.g. `did:catenor:…#assertion-key-1`. */
export type VerificationMethodId = string & { readonly __brand: 'VerificationMethodId' };

const FRAGMENT_PATTERN = /^[a-z][a-z0-9-]*$/;

export function verificationMethodId(did: CatenorDid, fragment: string): VerificationMethodId {
  if (!isCatenorDid(did)) {
    throw new TypeError('verification method controller must be a did:catenor');
  }
  if (!FRAGMENT_PATTERN.test(fragment)) {
    throw new TypeError('verification method fragment must match [a-z][a-z0-9-]*');
  }
  return `${did}#${fragment}` as VerificationMethodId;
}

/** `<did>#assertion-key-<n>` (PLAN §3.2). */
export function assertionKeyId(did: CatenorDid, n: number): VerificationMethodId {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError('assertion key index must be a positive integer');
  }
  return verificationMethodId(did, `assertion-key-${n}`);
}

/** `<did>#authentication-key-<n>` — a holder key for Verifiable Presentation proofs (final demo [REF-IMPL]). */
export function authenticationKeyId(did: CatenorDid, n: number): VerificationMethodId {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError('authentication key index must be a positive integer');
  }
  return verificationMethodId(did, `authentication-key-${n}`);
}

/** The DID part of a verification method id. */
export function controllerOf(id: string): string {
  const hash = id.indexOf('#');
  return hash === -1 ? id : id.slice(0, hash);
}

/** Protocol-shaped verification method: `{id, controller, type: "Multikey", publicKeyMultibase}`. */
export interface VerificationMethod {
  readonly id: VerificationMethodId;
  readonly controller: CatenorDid;
  readonly type: 'Multikey';
  readonly publicKeyMultibase: string;
}

export function createVerificationMethod(
  id: VerificationMethodId,
  controller: CatenorDid,
  publicKeyMultibase: string,
): VerificationMethod {
  if (controllerOf(id) !== controller) {
    throw new TypeError('verification method id must be a fragment of its controller DID');
  }
  if (!isEd25519Multikey(publicKeyMultibase)) {
    throw new TypeError('publicKeyMultibase must be an Ed25519 Multikey');
  }
  return { id, controller, type: 'Multikey', publicKeyMultibase };
}
