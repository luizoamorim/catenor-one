// Clean-room demo [REF-IMPL]: keys and signed documents for Subjects other than the S001 candidate — the Sponsor's
// Credential Assertion Key, an investor's authentication (holder) key. Same signer and custody pattern as S001: the
// key lives behind the Catenor signer boundary (Privy Ed25519 wallet); only the public key reaches the DID Document;
// the private `signerRef` is operational metadata. Credential Assertion Key ≠ Financial Execution Key: these keys
// never sign a transaction.
import {
  assertionKeyId,
  authenticationKeyId,
  createDidDocument,
  createVerificationMethod,
  type CatenorDid,
  type DidDocument,
  type VerificationMethod,
} from '@catenor-one/identity';
import type { DataIntegrityProof } from '@catenor-one/credentials';
import type {
  AssertionSigner,
  Clock,
  SignableDocument,
} from '../../trust-anchor-admission/application/admission.ports.js';
import type {
  PersistencePorts,
  UnitOfWork,
} from '../../trust-anchor-admission/application/persistence.ports.js';

export type SubjectKeyPurpose = 'CREDENTIAL_ASSERTION' | 'AUTHENTICATION';

export interface SubjectKeyDeps {
  readonly uow: UnitOfWork;
  readonly clock: Clock;
  readonly assertionSigner: AssertionSigner;
}

export const rfc3339 = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Creates the Subject's first key of `purpose` and publishes the minimized DID Document with it. */
export async function provisionSubjectKey(
  deps: SubjectKeyDeps,
  input: {
    readonly did: CatenorDid;
    readonly subjectId: string;
    readonly purpose: SubjectKeyPurpose;
  },
): Promise<{ verificationMethod: VerificationMethod; document: DidDocument }> {
  const key = await deps.assertionSigner.createKey({ subject: input.did, purpose: input.purpose });
  const vm = createVerificationMethod(
    input.purpose === 'CREDENTIAL_ASSERTION'
      ? assertionKeyId(input.did, 1)
      : authenticationKeyId(input.did, 1),
    input.did,
    key.publicKeyMultibase,
  );
  const document =
    input.purpose === 'CREDENTIAL_ASSERTION'
      ? createDidDocument(input.did, [vm], [vm.id])
      : createDidDocument(input.did, [vm], [], [vm.id]);
  await deps.uow.run(async (p) => {
    await p.didState.publishAssertionKey({
      document,
      lifecycle: 'ACTIVE',
      verificationMethod: vm,
      subjectId: input.subjectId,
      keyReference: {
        subject: input.did,
        verificationMethod: vm.id,
        signerRef: key.signerRef,
        purpose: input.purpose,
        status: 'ACTIVE',
      },
      adapter: deps.assertionSigner.adapter,
    });
  });
  return { verificationMethod: vm, document };
}

/** The Subject's ACTIVE key of `purpose` (from its published DID Document and private key reference). */
export async function subjectKey(
  p: PersistencePorts,
  did: string,
  purpose: SubjectKeyPurpose,
): Promise<{ vmId: string; signerRef: string; publicKeyMultibase: string }> {
  const resolved = await p.didState.resolve(did);
  const vmId =
    purpose === 'CREDENTIAL_ASSERTION'
      ? resolved?.document.assertionMethod[0]
      : resolved?.document.authentication?.[0];
  const keyRef = vmId ? await p.didState.findKeyReference(vmId) : undefined;
  const vm = vmId ? resolved?.document.verificationMethod.find((v) => v.id === vmId) : undefined;
  if (!vmId || !vm || keyRef?.purpose !== purpose || keyRef.status !== 'ACTIVE') {
    throw new Error(`${did} has no ACTIVE ${purpose} key`);
  }
  return { vmId, signerRef: keyRef.signerRef, publicKeyMultibase: vm.publicKeyMultibase };
}

/** Signs one structured document with the Subject's key of the purpose the document requires. */
export async function signAs(
  deps: SubjectKeyDeps,
  did: string,
  document: SignableDocument,
): Promise<DataIntegrityProof> {
  const purpose = document.kind === 'PRESENTATION' ? 'AUTHENTICATION' : 'CREDENTIAL_ASSERTION';
  const key = await deps.uow.run((p) => subjectKey(p, did, purpose));
  return deps.assertionSigner.signDocument(key.signerRef, {
    document,
    verificationMethod: key.vmId,
    created: rfc3339(deps.clock.now()),
  });
}
