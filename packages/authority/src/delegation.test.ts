// Clean-room demo authority chain [REF-IMPL]: Trust Anchor → Sponsor (relationship + five capabilities) → Agent
// (relationship + delegated EXECUTE_DISTRIBUTION). Relationship ≠ Capability; delegability is explicit.
import { attachProofValue } from '@catenor-one/credentials';
import {
  assertionKeyId,
  createDidDocument,
  createVerificationMethod,
  parseCatenorDid,
} from '@catenor-one/identity';
import { ed25519 } from '@noble/curves/ed25519.js';
import { describe, expect, it } from 'vitest';
import {
  CREATE_AGENT,
  CREATE_DISTRIBUTION,
  DEFINE_OFFERING_POLICY,
  DELEGATE_DISTRIBUTION_AUTHORITY,
  EXECUTE_DISTRIBUTION,
  SPONSOR_CAPABILITIES,
  TOKENIZE_ASSET,
  authorizeDelegatedCapability,
  createCapabilityGrant,
  prepareCapabilityGrantProof,
  type CapabilityGrant,
} from './capability.js';
import {
  authorizeOfferingDefinition,
  createOfferingDefinition,
  prepareOfferingProof,
} from './offering.js';
import {
  RELATIONSHIP_PREDICATES,
  createRelationshipCredential,
  prepareRelationshipProof,
  verifyRelationshipCredential,
} from './relationship.js';
import { TRUST_DOMAIN, happyScenario, newKey } from './scenario.test-fixtures.js';

const root = happyScenario(); // ACTIVE Trust Anchor
const SPONSOR = parseCatenorDid('did:catenor:5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e');
const AGENT = parseCatenorDid('did:catenor:a9e9a9e9a9e9a9e9a9e9a9e9a9e9a9e9');
const RESOURCE = 'spv:catenor-demo-001';
const NOW = new Date('2026-09-12T12:00:00Z');
const sponsorKey = newKey();
const sponsorVm = createVerificationMethod(
  assertionKeyId(SPONSOR, 1),
  SPONSOR,
  sponsorKey.multikey,
);
const sponsorDocument = createDidDocument(SPONSOR, [sponsorVm], [sponsorVm.id]);

function signGrant(
  issuer: { did: string; vm: string; secret: Uint8Array },
  over: Partial<Parameters<typeof createCapabilityGrant>[0]>,
): CapabilityGrant {
  const payload = createCapabilityGrant({
    id: `capability-grant:${over.action ?? 'x'}:${over.subject ?? ''}`,
    issuer: issuer.did,
    subject: SPONSOR,
    action: TOKENIZE_ASSET,
    resource: RESOURCE,
    validUntil: '2026-09-20T00:00:00Z',
    issuedAt: '2026-09-12T00:00:00Z',
    ...over,
  });
  const { proofOptions, hashData } = prepareCapabilityGrantProof(
    payload,
    issuer.vm,
    payload.issuedAt,
  );
  return {
    ...payload,
    proof: attachProofValue(proofOptions, ed25519.sign(hashData, issuer.secret)),
  };
}

const TA: { did: string; vm: string; secret: Uint8Array } = {
  did: root.vm.controller,
  vm: root.vm.id,
  secret: root.assertionKey.secretKey,
};
const SP = { did: SPONSOR as string, vm: sponsorVm.id as string, secret: sponsorKey.secretKey };
const sponsorGrants = SPONSOR_CAPABILITIES.map((action) => signGrant(TA, { action }));
const delegation = (over: Partial<Parameters<typeof createCapabilityGrant>[0]> = {}) =>
  signGrant(SP, {
    subject: AGENT,
    action: EXECUTE_DISTRIBUTION,
    validUntil: '2026-09-19T00:00:00Z',
    issuedAt: '2026-09-12T01:00:00Z',
    ...over,
  });

function authorize(over: Partial<Parameters<typeof authorizeDelegatedCapability>[0]> = {}) {
  return authorizeDelegatedCapability({
    grant: delegation(),
    delegatorDocument: sponsorDocument,
    parentGrants: sponsorGrants,
    rootDocument: root.document,
    rootIsActiveTrustAnchor: true,
    request: { requester: AGENT, action: EXECUTE_DISTRIBUTION, resource: RESOURCE },
    now: NOW,
    ...over,
  });
}

describe('delegated authority: Trust Anchor → Sponsor → Agent [REF-IMPL]', () => {
  it('ALLOW with the verified three-edge chain', () => {
    const r = authorize();
    expect(r.decision).toBe('ALLOW');
    expect(r.chain?.map((e) => `${e.issuer === TA.did ? 'TA' : 'SPONSOR'}:${e.action}`)).toEqual([
      `TA:${CREATE_DISTRIBUTION}`,
      `TA:${DELEGATE_DISTRIBUTION_AUTHORITY}`,
      `SPONSOR:${EXECUTE_DISTRIBUTION}`,
    ]);
  });

  it('without the explicit DELEGATE_DISTRIBUTION_AUTHORITY grant → DENY DELEGATION_NOT_PERMITTED', () => {
    const r = authorize({
      parentGrants: sponsorGrants.filter(
        (g) => g.capability.action !== DELEGATE_DISTRIBUTION_AUTHORITY,
      ),
    });
    expect(r).toEqual({ decision: 'DENY', reasons: ['DELEGATION_NOT_PERMITTED'] });
  });

  it('without CREATE_DISTRIBUTION the Sponsor cannot delegate what it lacks → DELEGATOR_LACKS_AUTHORITY', () => {
    const r = authorize({
      parentGrants: sponsorGrants.filter((g) => g.capability.action !== CREATE_DISTRIBUTION),
    });
    expect(r.reasons).toEqual(['DELEGATOR_LACKS_AUTHORITY']);
  });

  it('a non-delegable action (TOKENIZE_ASSET) → ACTION_NOT_DELEGABLE', () => {
    const r = authorize({
      grant: delegation({ action: TOKENIZE_ASSET }),
      request: { requester: AGENT, action: TOKENIZE_ASSET, resource: RESOURCE },
    });
    expect(r.reasons).toEqual(['ACTION_NOT_DELEGABLE']);
  });

  it('a delegation that outlives the Sponsor authority → DELEGATION_EXCEEDS_DELEGATOR', () => {
    const r = authorize({ grant: delegation({ validUntil: '2026-09-25T00:00:00Z' }) });
    expect(r.reasons).toEqual(['DELEGATION_EXCEEDS_DELEGATOR']);
  });

  it('parent grants from an issuer that is not an ACTIVE Trust Anchor do not count', () => {
    const r = authorize({ rootIsActiveTrustAnchor: false });
    expect(r.reasons).toEqual(['DELEGATOR_LACKS_AUTHORITY', 'DELEGATION_NOT_PERMITTED']);
  });

  it('another requester, resource or signer is refused', () => {
    expect(
      authorize({
        request: { requester: SPONSOR, action: EXECUTE_DISTRIBUTION, resource: RESOURCE },
      }).reasons,
    ).toContain('SUBJECT_MISMATCH');
    expect(
      authorize({
        request: {
          requester: AGENT,
          action: EXECUTE_DISTRIBUTION,
          resource: 'spv:catenor-demo-002',
        },
      }).reasons,
    ).toContain('RESOURCE_MISMATCH');
    const forged = signGrant(
      { ...SP, secret: newKey().secretKey },
      { subject: AGENT, action: EXECUTE_DISTRIBUTION, issuedAt: '2026-09-12T01:00:00Z' },
    );
    expect(authorize({ grant: forged }).reasons).toContain('SIGNATURE_INVALID');
  });
});

describe('Relationship Credentials never carry authority', () => {
  const issueRelationship = (
    issuer: typeof TA,
    subject: string,
    predicate: (typeof RELATIONSHIP_PREDICATES)[keyof typeof RELATIONSHIP_PREDICATES],
    object: string,
  ) => {
    const credential = createRelationshipCredential({
      id: 'urn:uuid:rel-1',
      issuer: issuer.did,
      subject,
      predicate,
      object,
      validFrom: '2026-09-12T00:00:00Z',
      validUntil: '2026-09-20T00:00:00Z',
      statusId: 'urn:catenor-one:status:rel-1',
    });
    const { proofOptions, hashData } = prepareRelationshipProof(
      credential,
      issuer.vm,
      '2026-09-12T00:00:00Z',
    );
    return {
      ...credential,
      proof: attachProofValue(proofOptions, ed25519.sign(hashData, issuer.secret)),
    };
  };

  it('Trust Anchor: Sponsor AUTHORIZED_SPONSOR_IN the Trust Domain verifies', () => {
    const vc = issueRelationship(
      TA,
      SPONSOR,
      RELATIONSHIP_PREDICATES.AUTHORIZED_SPONSOR_IN,
      TRUST_DOMAIN,
    );
    expect(
      verifyRelationshipCredential({
        credential: vc,
        issuerDocument: root.document,
        expected: { subject: SPONSOR, predicate: 'AUTHORIZED_SPONSOR_IN', object: TRUST_DOMAIN },
        now: NOW,
      }),
    ).toEqual({ valid: true, reasons: [] });
  });

  it('Sponsor: Agent AGENT_OF Sponsor verifies — and is not a grant', () => {
    const vc = issueRelationship(SP, AGENT, RELATIONSHIP_PREDICATES.AGENT_OF, SPONSOR);
    expect(
      verifyRelationshipCredential({
        credential: vc,
        issuerDocument: sponsorDocument,
        expected: { subject: AGENT, predicate: 'AGENT_OF', object: SPONSOR },
        now: NOW,
      }).valid,
    ).toBe(true);
    // A relationship presented where a capability is required is refused.
    const r = authorize({ grant: vc as unknown as CapabilityGrant });
    expect(r.decision).toBe('DENY');
    expect(r.reasons).toEqual(['CAPABILITY_MALFORMED']);
  });

  it('a relationship signed by someone else or about another subject fails', () => {
    const vc = issueRelationship(SP, AGENT, RELATIONSHIP_PREDICATES.AGENT_OF, SPONSOR);
    expect(
      verifyRelationshipCredential({
        credential: vc,
        issuerDocument: root.document,
        expected: { subject: AGENT, predicate: 'AGENT_OF', object: SPONSOR },
        now: NOW,
      }).reasons,
    ).toContain('ISSUER_KEY_NOT_ASSERTION_METHOD');
    expect(
      verifyRelationshipCredential({
        credential: vc,
        issuerDocument: sponsorDocument,
        expected: { subject: SPONSOR, predicate: 'AGENT_OF', object: SPONSOR },
        now: NOW,
      }).reasons,
    ).toEqual(['UNEXPECTED_RELATIONSHIP']);
  });
});

describe('Offering definition under DEFINE_OFFERING_POLICY', () => {
  const offering = (secret = SP.secret) => {
    const payload = createOfferingDefinition({
      id: 'offering:catenor-demo-001',
      issuer: SPONSOR,
      issuedAt: '2026-09-12T02:00:00Z',
      resource: RESOURCE,
      asset: {
        name: 'Catenor One Demo SPV 001',
        description: 'synthetic real-estate SPV equity interests',
        totalUnits: 1000,
      },
      eligibility: {
        policy: 'policy:offering-eligibility:v1',
        policyHash: `0x${'a'.repeat(64)}`,
        credentialType: 'CatenorInvestorEligibilityCredential',
      },
      validUntil: '2026-09-19T00:00:00Z',
    });
    const { proofOptions, hashData } = prepareOfferingProof(payload, SP.vm, payload.issuedAt);
    return { ...payload, proof: attachProofValue(proofOptions, ed25519.sign(hashData, secret)) };
  };
  const grantOf = (action: string) => sponsorGrants.find((g) => g.capability.action === action);

  it('Sponsor-signed + DEFINE_OFFERING_POLICY from the ACTIVE Trust Anchor → ALLOW', () => {
    expect(
      authorizeOfferingDefinition({
        offering: offering(),
        sponsorDocument,
        sponsorGrant: grantOf(DEFINE_OFFERING_POLICY),
        rootDocument: root.document,
        rootIsActiveTrustAnchor: true,
        now: NOW,
      }),
    ).toEqual({ decision: 'ALLOW', reasons: [] });
  });

  it('presenting another capability (CREATE_AGENT) or a forged signature → DENY', () => {
    expect(
      authorizeOfferingDefinition({
        offering: offering(),
        sponsorDocument,
        sponsorGrant: grantOf(CREATE_AGENT),
        rootDocument: root.document,
        rootIsActiveTrustAnchor: true,
        now: NOW,
      }).reasons,
    ).toEqual(['ACTION_MISMATCH']);
    expect(
      authorizeOfferingDefinition({
        offering: offering(newKey().secretKey),
        sponsorDocument,
        sponsorGrant: grantOf(DEFINE_OFFERING_POLICY),
        rootDocument: root.document,
        rootIsActiveTrustAnchor: true,
        now: NOW,
      }).reasons,
    ).toEqual(['OFFERING_SIGNATURE_INVALID']);
  });
});
