import { commit } from '@catenor-one/audit';
import { validateProtocolObject } from '@catenor-one/test-vectors';
import { describe, expect, it } from 'vitest';
import { createDecision, type Decision } from './decision.js';

const base: Decision = {
  policy: 'policy:trust-anchor-admission:v1',
  subject: 'did:catenor:8f0c92d7e5f04e40a41faee32e5e180b',
  action: 'ADMIT_TRUST_ANCHOR',
  resource: 'trust-domain:catenor-one-demo',
  decision: 'ALLOW',
  evaluatedAt: '2026-09-09T22:10:00Z',
  evidenceCommitment: commit({ fixture: 'evidence' }),
};

describe('Decision (exact protocol shape)', () => {
  it.each(['ALLOW', 'DENY', 'ERROR'] as const)(
    '%s decision validates against the pinned protocol decision.schema.json',
    (decision) => {
      expect(validateProtocolObject('decision', createDecision({ ...base, decision }))).toEqual({
        valid: true,
        errors: [],
      });
    },
  );

  it('carries exactly the seven protocol fields, even if extra fields are passed', () => {
    const decision = createDecision({ ...base, extra: 'x' } as Decision);
    expect(Object.keys(decision).sort()).toEqual([
      'action',
      'decision',
      'evaluatedAt',
      'evidenceCommitment',
      'policy',
      'resource',
      'subject',
    ]);
  });

  it.each([
    ['non-catenor subject', { subject: 'did:web:example.com' }],
    ['non RFC 3339 evaluatedAt', { evaluatedAt: '09/09/2026' }],
    ['non-commitment evidence', { evidenceCommitment: '0xabc' }],
    ['empty resource', { resource: '' }],
    ['unsupported outcome', { decision: 'MAYBE' }],
  ])('rejects %s', (_label, override) => {
    expect(() => createDecision({ ...base, ...override } as Decision)).toThrow(TypeError);
  });
});
