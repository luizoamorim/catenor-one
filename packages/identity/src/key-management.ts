import type { CatenorDid } from './did.js';
import type { VerificationMethodId } from './verification-method.js';

export const KEY_PURPOSES = [
  'CREDENTIAL_ASSERTION',
  'AUTHENTICATION',
  'DELEGATION',
  'RECOVERY',
  'FINANCIAL_EXECUTION',
] as const;
export type KeyPurpose = (typeof KEY_PURPOSES)[number];

export const KEY_REFERENCE_STATUSES = ['ACTIVE', 'REVOKED'] as const;
export type KeyReferenceStatus = (typeof KEY_REFERENCE_STATUSES)[number];

/**
 * Reference to a key held by a secure signer (PLAN §3.2). Never contains key material: `signerRef` is
 * private operational metadata (e.g. a signer wallet id), not a secret.
 */
export interface KeyManagementReference {
  readonly subject: CatenorDid;
  readonly verificationMethod: VerificationMethodId;
  readonly signerRef: string;
  readonly purpose: KeyPurpose;
  readonly status: KeyReferenceStatus;
}

/** A reference together with the public key of its verification method. */
export interface KeyBinding {
  readonly reference: KeyManagementReference;
  readonly publicKeyMultibase: string;
}

export class KeyPurposeCollisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyPurposeCollisionError';
  }
}

/** Purpose pairs that must never share key material (Credential Assertion Key ≠ Financial Execution Key). */
const SEPARATED_PURPOSES: readonly (readonly [KeyPurpose, KeyPurpose])[] = [
  ['CREDENTIAL_ASSERTION', 'FINANCIAL_EXECUTION'],
];

function separated(a: KeyPurpose, b: KeyPurpose): boolean {
  return SEPARATED_PURPOSES.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

/**
 * Rejects binding a key — the same public key or the same signer — for a purpose that must stay separated
 * from a purpose it is already bound to: a public key bound as CREDENTIAL_ASSERTION can never also be bound
 * as FINANCIAL_EXECUTION, and vice versa (PLAN §3.2, AC-013). Returns the extended list.
 */
export function bindKeyPurpose(
  existing: readonly KeyBinding[],
  candidate: KeyBinding,
): KeyBinding[] {
  for (const binding of existing) {
    const sameKey =
      binding.publicKeyMultibase === candidate.publicKeyMultibase ||
      binding.reference.signerRef === candidate.reference.signerRef;
    if (sameKey && separated(binding.reference.purpose, candidate.reference.purpose)) {
      throw new KeyPurposeCollisionError(
        `key already bound as ${binding.reference.purpose} cannot also be bound as ${candidate.reference.purpose}`,
      );
    }
  }
  return [...existing, candidate];
}
