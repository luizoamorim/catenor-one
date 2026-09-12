import { encodeEd25519Multikey } from '@catenor-one/identity';
import { ed25519 } from '@noble/curves/ed25519.js';
import { describe, expect, it } from 'vitest';
import { attachProofValue } from './eddsa-jcs-2022.js';
import {
  CATENOR_ONE_STATUS_STATEMENT,
  createCredential,
  createPresentation,
  createStatusStatement,
  prepareCredentialProof,
  preparePresentationProof,
  prepareStatusStatementProof,
  verifyPresentation,
  type CredentialStatus,
  type VerifiableCredential,
  type VerifiablePresentation,
} from './verifiable-credentials.js';

const ISSUER = 'did:catenor:11111111111111111111111111111111';
const HOLDER = 'did:catenor:22222222222222222222222222222222';
const ISSUER_VM = `${ISSUER}#assertion-key-1`;
const HOLDER_VM = `${HOLDER}#authentication-key-1`;
const TYPE = 'CatenorInvestorEligibilityCredential';
const NOW = new Date('2026-09-11T12:00:00Z');
const issuerSecret = ed25519.utils.randomSecretKey();
const holderSecret = ed25519.utils.randomSecretKey();
const multikey = (secret: Uint8Array) => encodeEd25519Multikey(ed25519.getPublicKey(secret));

function issue(subject = HOLDER, validUntil = '2026-12-11T12:00:00Z'): VerifiableCredential {
  const credential = createCredential({
    id: 'urn:uuid:4f1b6a2e-0000-4000-8000-000000000001',
    type: TYPE,
    issuer: ISSUER,
    validFrom: '2026-09-11T11:00:00Z',
    validUntil,
    credentialSubject: { id: subject, investorIdentityVerified: true, investorAmlClear: true },
    statusId: 'urn:catenor-one:status:1',
  });
  const { proofOptions, hashData } = prepareCredentialProof(
    credential,
    ISSUER_VM,
    '2026-09-11T11:00:00Z',
  );
  return {
    ...credential,
    proof: attachProofValue(proofOptions, ed25519.sign(hashData, issuerSecret)),
  };
}

function present(vc: VerifiableCredential, challenge = 'nonce-1', domain = 'offering:1') {
  const presentation = createPresentation({ holder: HOLDER, credentials: [vc] });
  const { proofOptions, hashData } = preparePresentationProof(presentation, {
    verificationMethod: HOLDER_VM,
    created: '2026-09-11T11:59:00Z',
    challenge,
    domain,
  });
  return {
    ...presentation,
    proof: attachProofValue(proofOptions, ed25519.sign(hashData, holderSecret)),
  } satisfies VerifiablePresentation;
}

function status(vc: VerifiableCredential, value: CredentialStatus = 'ACTIVE', at = NOW) {
  const statement = createStatusStatement({
    credential: vc,
    status: value,
    checkedAt: at.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  });
  const { proofOptions, hashData } = prepareStatusStatementProof(
    statement,
    ISSUER_VM,
    statement.checkedAt,
  );
  return {
    ...statement,
    proof: attachProofValue(proofOptions, ed25519.sign(hashData, issuerSecret)),
  };
}

const accepted = [
  {
    did: ISSUER,
    verificationMethod: ISSUER_VM,
    publicKeyMultibase: multikey(issuerSecret),
    credentialTypes: [TYPE],
  },
];

function verify(over: Partial<Parameters<typeof verifyPresentation>[0]> = {}) {
  const vc = issue();
  return verifyPresentation({
    presentation: present(vc),
    holderKey: { verificationMethod: HOLDER_VM, publicKeyMultibase: multikey(holderSecret) },
    challenge: 'nonce-1',
    domain: 'offering:1',
    credentialType: TYPE,
    acceptedIssuers: accepted,
    status: status(vc),
    maxStatusAgeSeconds: 600,
    now: NOW,
    ...over,
  });
}

describe('W3C VC / VP with eddsa-jcs-2022 — every check by name', () => {
  it('a correct presentation passes all seven checks', () => {
    const v = verify();
    expect(v.valid).toBe(true);
    expect(v.failed).toEqual([]);
    expect(v.credential?.credentialSubject.id).toBe(HOLDER);
  });

  it.each([
    ['another challenge (replay)', { challenge: 'nonce-2' }, 'HOLDER_PROOF_VALID'],
    ['another domain', { domain: 'offering:2' }, 'HOLDER_PROOF_VALID'],
    [
      'another holder key',
      {
        holderKey: {
          verificationMethod: HOLDER_VM,
          publicKeyMultibase: multikey(ed25519.utils.randomSecretKey()),
        },
      },
      'HOLDER_PROOF_VALID',
    ],
    ['an issuer outside the Trust Domain rules', { acceptedIssuers: [] }, 'ISSUER_AUTHORIZED'],
    [
      'an issuer not authorized for this type',
      { acceptedIssuers: [{ ...accepted[0]!, credentialTypes: ['OtherCredential'] }] },
      'ISSUER_AUTHORIZED',
    ],
    [
      'a time after validUntil',
      { now: new Date('2027-01-01T00:00:00Z') },
      'WITHIN_VALIDITY_WINDOW',
    ],
    ['no status statement (UNKNOWN is not ACTIVE)', { status: undefined }, 'STATUS_ACTIVE'],
    ['a stale status statement', { maxStatusAgeSeconds: -1 }, 'STATUS_ACTIVE'],
  ])('%s fails %s', (_name, over, check) => {
    const v = verify(over);
    expect(v.valid).toBe(false);
    expect(v.failed).toContain(check);
  });

  it('a REVOKED or SUSPENDED status fails STATUS_ACTIVE (signature validity ≠ current status)', () => {
    for (const value of ['REVOKED', 'SUSPENDED'] as const) {
      const vc = issue();
      const v = verify({ presentation: present(vc), status: status(vc, value) });
      expect(v.failed).toEqual(['STATUS_ACTIVE']);
    }
  });

  it('a status statement for another credential fails STATUS_ACTIVE', () => {
    const vc = issue();
    const other = status(vc);
    const v = verify({
      presentation: present(vc),
      status: { ...other, credentialId: 'urn:uuid:other', type: CATENOR_ONE_STATUS_STATEMENT },
    });
    expect(v.failed).toContain('STATUS_ACTIVE');
  });

  it('a tampered claim breaks the issuer signature and the holder proof', () => {
    const vc = issue();
    const vp = present(vc);
    const tampered = {
      ...vp,
      verifiableCredential: [
        { ...vc, credentialSubject: { ...vc.credentialSubject, investorAmlClear: false } },
      ],
    };
    const v = verify({ presentation: tampered, status: status(vc) });
    expect(v.failed).toEqual(
      expect.arrayContaining(['HOLDER_PROOF_VALID', 'CREDENTIAL_SIGNATURE_VALID']),
    );
  });

  it('a credential about someone else fails SUBJECT_IS_HOLDER', () => {
    const vc = issue('did:catenor:33333333333333333333333333333333');
    const v = verify({ presentation: present(vc), status: status(vc) });
    expect(v.failed).toEqual(['SUBJECT_IS_HOLDER']);
  });

  it('malformed input fails closed without throwing', () => {
    for (const presentation of [undefined, null, 42, {}, { type: ['VerifiablePresentation'] }]) {
      const v = verify({ presentation });
      expect(v.valid).toBe(false);
      expect(v.failed[0]).toBe('PRESENTATION_WELL_FORMED');
    }
  });

  it('the builders refuse a proof by a key of another Subject', () => {
    const vc = issue();
    expect(() => prepareCredentialProof(vc, HOLDER_VM, '2026-09-11T11:00:00Z')).toThrow();
    const presentation = createPresentation({ holder: HOLDER, credentials: [vc] });
    expect(() =>
      preparePresentationProof(presentation, {
        verificationMethod: ISSUER_VM,
        created: '2026-09-11T11:00:00Z',
        challenge: 'c',
        domain: 'd',
      }),
    ).toThrow();
  });
});
