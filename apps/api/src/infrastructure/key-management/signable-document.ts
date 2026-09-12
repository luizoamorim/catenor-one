// Clean-room demo [REF-IMPL]: the structured documents a Catenor signer may sign besides grants and key-possession
// proofs. The signer boundary builds the exact eddsa-jcs-2022 hashData here from the structured document — never
// from caller-provided bytes — with the proof purpose fixed per kind (assertionMethod for issuer statements,
// authentication for a holder's presentation).
import { prepareOfferingProof } from '@catenor-one/authority';
import {
  prepareCredentialProof,
  preparePresentationProof,
  prepareStatusStatementProof,
  type ProofOptions,
} from '@catenor-one/credentials';
import type { SignableDocument } from '../../modules/trust-anchor-admission/application/admission.ports.js';

export function prepareSignableDocument(
  document: SignableDocument,
  verificationMethod: string,
  created: string,
): { proofOptions: ProofOptions; hashData: Uint8Array } {
  switch (document.kind) {
    case 'CREDENTIAL':
      return prepareCredentialProof(document.credential, verificationMethod, created);
    case 'STATUS_STATEMENT':
      return prepareStatusStatementProof(document.statement, verificationMethod, created);
    case 'OFFERING':
      return prepareOfferingProof(document.offering, verificationMethod, created);
    case 'PRESENTATION':
      return preparePresentationProof(document.presentation, {
        verificationMethod,
        created,
        challenge: document.challenge,
        domain: document.domain,
      });
    default:
      throw new TypeError('signer boundary: unsupported document kind');
  }
}
