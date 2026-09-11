import { attachProofValue } from '@catenor-one/credentials';
import { ed25519 } from '@noble/curves/ed25519.js';
import { describe, expect, it } from 'vitest';
import {
  TOKENIZE_ASSET,
  authorizeWithCapability,
  createCapabilityGrant,
  prepareCapabilityGrantProof,
  type CapabilityGrant,
} from './capability.js';
import { OTHER_DID, happyScenario, newKey } from './scenario.test-fixtures.js';

const s = happyScenario(); // the admitted Trust Anchor (issuer) with its assertion key
const ORG_B = OTHER_DID;
const RESOURCE = 'spv:catenor-demo-001';
const NOW = new Date('2026-09-12T12:00:00Z');

function grant(
  overrides: Partial<Parameters<typeof createCapabilityGrant>[0]> = {},
  key = s.assertionKey.secretKey,
): CapabilityGrant {
  const payload = createCapabilityGrant({
    id: 'capability-grant:1',
    issuer: s.vm.controller,
    subject: ORG_B,
    action: TOKENIZE_ASSET,
    resource: RESOURCE,
    validUntil: '2026-09-14T00:00:00Z',
    issuedAt: '2026-09-12T00:00:00Z',
    ...overrides,
  });
  const { proofOptions, hashData } = prepareCapabilityGrantProof(
    payload,
    s.vm.id,
    '2026-09-12T00:00:01Z',
  );
  return { ...payload, proof: attachProofValue(proofOptions, ed25519.sign(hashData, key)) };
}

const authorize = (g: CapabilityGrant | undefined, overrides: Record<string, unknown> = {}) =>
  authorizeWithCapability({
    grant: g,
    issuerDocument: s.document,
    issuerIsActiveTrustAnchor: true,
    request: { requester: ORG_B, action: TOKENIZE_ASSET, resource: RESOURCE },
    now: NOW,
    ...overrides,
  });

describe('scoped capability grant — authorization [REF-IMPL demo vocabulary]', () => {
  it('the inner capability is exactly the protocol working shape {subject, action, resource, constraints}', () => {
    expect(Object.keys(grant().capability).sort()).toEqual([
      'action',
      'constraints',
      'resource',
      'subject',
    ]);
  });

  it('valid grant from an ACTIVE Trust Anchor, requested by its subject → ALLOW', () => {
    expect(authorize(grant())).toEqual({ decision: 'ALLOW', reasons: [] });
  });

  it.each([
    ['missing capability', () => authorize(undefined), ['CAPABILITY_MISSING']],
    [
      'issuer not (or no longer) an ACTIVE Trust Anchor',
      () => authorize(grant(), { issuerIsActiveTrustAnchor: false }),
      ['ISSUER_NOT_ACTIVE_TRUST_ANCHOR'],
    ],
    [
      'signed by another key',
      () => authorize(grant({}, newKey().secretKey)),
      ['SIGNATURE_INVALID'],
    ],
    [
      'tampered after signing',
      () =>
        authorize(
          { ...grant(), capability: { ...grant().capability, resource: 'asset:other:002' } },
          { request: { requester: ORG_B, action: TOKENIZE_ASSET, resource: 'asset:other:002' } },
        ),
      ['SIGNATURE_INVALID'],
    ],
    [
      'requested by another subject',
      () =>
        authorize(grant(), {
          request: {
            requester:
              s.vm.controller === ORG_B ? 'x' : 'did:catenor:0000000000000000000000000000000c',
            action: TOKENIZE_ASSET,
            resource: RESOURCE,
          },
        }),
      ['SUBJECT_MISMATCH'],
    ],
    [
      'another action',
      () =>
        authorize(grant(), {
          request: { requester: ORG_B, action: 'TRANSFER_ASSET', resource: RESOURCE },
        }),
      ['ACTION_MISMATCH'],
    ],
    [
      'another resource',
      () =>
        authorize(grant(), {
          request: {
            requester: ORG_B,
            action: TOKENIZE_ASSET,
            resource: 'spv:catenor-demo-002',
          },
        }),
      ['RESOURCE_MISMATCH'],
    ],
    ['expired', () => authorize(grant(), { now: new Date('2026-09-15T00:00:00Z') }), ['EXPIRED']],
    [
      'issuer DID Document does not list the key under assertionMethod',
      () => authorize(grant(), { issuerDocument: { ...s.document, assertionMethod: [] } }),
      ['ISSUER_KEY_NOT_ASSERTION_METHOD'],
    ],
  ])('%s → DENY', (_label, run, reasons) => {
    expect(run()).toEqual({ decision: 'DENY', reasons });
  });

  it('refuses to create a self-grant or an already-expired grant', () => {
    expect(() => grant({ subject: s.vm.controller })).toThrow('distinct subject');
    expect(() => grant({ validUntil: '2026-09-11T00:00:00Z' })).toThrow('after issuedAt');
  });
});
