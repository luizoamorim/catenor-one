import type { CatenorDid } from './did.js';
import type { VerificationMethod, VerificationMethodId } from './verification-method.js';

/**
 * Minimized public DID Document (PLAN §3.2, TV-S001-C03): `{id, verificationMethod[], assertionMethod[]}`
 * only. It never contains provider references, emails, PII, private keys or financial Account Bindings.
 * Final demo [REF-IMPL]: a holder (e.g. an investor) may also list `authentication` keys for Verifiable Presentation
 * holder proofs; the field is absent unless used, so S001 documents are unchanged.
 */
export interface DidDocument {
  readonly id: CatenorDid;
  readonly verificationMethod: readonly VerificationMethod[];
  readonly assertionMethod: readonly VerificationMethodId[];
  readonly authentication?: readonly VerificationMethodId[];
}

export function createDidDocument(
  id: CatenorDid,
  verificationMethod: readonly VerificationMethod[],
  assertionMethod: readonly VerificationMethodId[],
  authentication: readonly VerificationMethodId[] = [],
): DidDocument {
  const ids = new Set<string>();
  for (const vm of verificationMethod) {
    if (vm.controller !== id || !vm.id.startsWith(`${id}#`)) {
      throw new TypeError('every verification method must be controlled by the document DID');
    }
    if (ids.has(vm.id)) throw new TypeError(`duplicate verification method id: ${vm.id}`);
    ids.add(vm.id);
  }
  if (new Set(assertionMethod).size !== assertionMethod.length) {
    throw new TypeError('duplicate assertionMethod reference');
  }
  for (const ref of assertionMethod) {
    if (!ids.has(ref)) throw new TypeError(`assertionMethod references unknown key: ${ref}`);
  }
  if (new Set(authentication).size !== authentication.length) {
    throw new TypeError('duplicate authentication reference');
  }
  for (const ref of authentication) {
    if (!ids.has(ref)) throw new TypeError(`authentication references unknown key: ${ref}`);
  }
  return {
    id,
    verificationMethod: verificationMethod.map((vm) => ({ ...vm })),
    assertionMethod: [...assertionMethod],
    ...(authentication.length > 0 ? { authentication: [...authentication] } : {}),
  };
}

export function findVerificationMethod(
  doc: DidDocument,
  id: string,
): VerificationMethod | undefined {
  return doc.verificationMethod.find((vm) => vm.id === id);
}

/** True only if `vmId` is a verification method of `doc` listed under `assertionMethod`. */
export function authorizesAssertion(doc: DidDocument, vmId: string): boolean {
  return (
    findVerificationMethod(doc, vmId) !== undefined &&
    (doc.assertionMethod as readonly string[]).includes(vmId)
  );
}

/** True only if `vmId` is a verification method of `doc` listed under `authentication` (holder proofs). */
export function authorizesAuthentication(doc: DidDocument, vmId: string): boolean {
  return (
    findVerificationMethod(doc, vmId) !== undefined &&
    ((doc.authentication ?? []) as readonly string[]).includes(vmId)
  );
}
