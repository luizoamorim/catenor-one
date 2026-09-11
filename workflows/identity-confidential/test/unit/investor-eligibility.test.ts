// Unit tests for the investor-eligibility operation (final demo [REF-IMPL]). node:crypto is used only to recompute
// the commitment independently; the code under test uses no Node APIs.
import { createHash, createHmac } from 'node:crypto';
import canonicalize from 'canonicalize';
import { describe, expect, it } from 'vitest';
import {
  evaluateInvestor,
  runInvestorEligibility,
} from '../../src/investor-eligibility/index.js';
import type { TtaRuntime } from '../../src/trust-anchor-admission/index.js';

const NOW = new Date('2026-09-11T12:00:00Z');
const context = {
  sessionRef: 'distribution-check:1',
  runId: 'run:inv:1',
  trustDomain: 'trust-domain:catenor-one-demo',
  subjectDid: 'did:catenor:0a1b2c3d4e5f60718293a4b5c6d7e8f9',
  applicantId: 'applicant-investor-synthetic-001',
  bindingRef: 'cbr-investor-a',
  notAfter: '2026-09-11T12:10:00Z',
};
const config = (extra: Record<string, unknown> = {}) => ({
  callbackUrl: 'http://127.0.0.1:9999/v1/internal/cre/identity-confidential/results',
  sumsubBaseUrl: 'https://api.sumsub.com',
  executionMode: 'SIMULATION',
  bootstrapConfigurationHash: `0x${'b'.repeat(64)}`,
  investorEvidence: { levelNames: ['id-only'], evidenceMaxAgeDays: 180 },
  ...extra,
});
const secrets = {
  sumsubAppToken: 'sbx-synthetic-not-a-token',
  sumsubSecretKey: 'synthetic-not-a-secret',
  callbackKey: new Uint8Array(32).fill(1),
  saltKey: new Uint8Array(32).fill(2),
};
const applicant = (review: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id: 'applicant-investor-synthetic-001',
  externalUserId: 'cbr-investor-a',
  type: 'individual',
  review: { levelName: 'id-only', ...review },
  ...extra,
});
const GREEN = {
  reviewStatus: 'completed',
  reviewDate: '2026-09-10 12:00:00+0000',
  reviewResult: { reviewAnswer: 'GREEN' },
};
const RED = {
  reviewStatus: 'completed',
  reviewDate: '2026-09-10 12:00:00+0000',
  reviewResult: { reviewAnswer: 'RED', reviewRejectType: 'FINAL', rejectLabels: ['SANCTIONS'] },
};

function runtime(body: unknown, status = 200) {
  const calls: { gets: string[]; posts: { url: string; body: string }[] } = { gets: [], posts: [] };
  const rt: TtaRuntime = {
    now: () => NOW,
    httpGet: (url) => {
      calls.gets.push(url);
      return { status, body: new TextEncoder().encode(JSON.stringify(body)) };
    },
    httpPost: (url, _headers, b) => {
      calls.posts.push({ url, body: new TextDecoder().decode(b) });
      return { status: 200 };
    },
    log: () => {},
  };
  return { rt, calls };
}
const evaluate = (body: unknown, cfg = config(), status = 200) => {
  const { rt, calls } = runtime(body, status);
  return {
    envelope: evaluateInvestor({ runId: context.runId, context, config: cfg, secrets, runtime: rt }),
    calls,
  };
};

describe('investor-eligibility (identity-confidential, [REF-IMPL])', () => {
  it('GREEN, fresh, bound applicant → all three facts TRUE, CONSISTENT, one Sumsub GET', () => {
    const { envelope, calls } = evaluate(applicant(GREEN));
    expect(envelope.status).toBe('OK');
    expect(envelope.facts).toEqual({
      INVESTOR_IDENTITY_VERIFIED: true,
      INVESTOR_AML_CLEAR: true,
      EVIDENCE_FRESH: true,
    });
    expect(envelope.reconciliation).toEqual({ investor: 'CONSISTENT' });
    expect(calls.gets).toEqual([
      'https://api.sumsub.com/resources/applicants/applicant-investor-synthetic-001/one',
    ]);
  });

  it('RED (SANCTIONS, FINAL) → identity and AML FALSE with reason codes, MISMATCH', () => {
    const { envelope } = evaluate(applicant(RED));
    expect(envelope.facts).toEqual({
      INVESTOR_IDENTITY_VERIFIED: false,
      INVESTOR_AML_CLEAR: false,
      EVIDENCE_FRESH: true,
    });
    expect(envelope.factReasons?.INVESTOR_AML_CLEAR).toEqual(['SANCTIONS', 'FINAL']);
    expect(envelope.reconciliation).toEqual({ investor: 'MISMATCH' });
  });

  it('stale review → EVIDENCE_FRESH FALSE, STALE', () => {
    const { envelope } = evaluate(applicant({ ...GREEN, reviewDate: '2025-01-01 00:00:00+0000' }));
    expect(envelope.facts?.EVIDENCE_FRESH).toBe(false);
    expect(envelope.reconciliation).toEqual({ investor: 'STALE' });
  });

  it('pending review → identity FALSE, freshness MISSING (null), INCOMPLETE', () => {
    const { envelope } = evaluate(applicant({ reviewStatus: 'pending' }));
    expect(envelope.facts?.INVESTOR_IDENTITY_VERIFIED).toBe(false);
    expect(envelope.facts?.EVIDENCE_FRESH).toBeNull();
    expect(envelope.reconciliation).toEqual({ investor: 'INCOMPLETE' });
  });

  it.each([
    ['another externalUserId', applicant(GREEN, { externalUserId: 'cbr-someone-else' })],
    ['a company applicant', applicant(GREEN, { type: 'company' })],
  ])('binding gate: %s → ERROR PROVIDER_BINDING_MISMATCH, no facts', (_n, body) => {
    const { envelope } = evaluate(body);
    expect(envelope).toMatchObject({ status: 'ERROR', code: 'PROVIDER_BINDING_MISMATCH' });
    expect(envelope.facts).toBeUndefined();
  });

  it('missing investorEvidence config or HTTP failure → fail closed', () => {
    const noRules = config();
    delete (noRules as Record<string, unknown>).investorEvidence;
    expect(evaluate(applicant(GREEN), noRules).envelope).toMatchObject({
      status: 'ERROR',
      code: 'CONFIG_INVALID',
    });
    expect(evaluate({}, config(), 404).envelope).toMatchObject({
      status: 'ERROR',
      code: 'SUMSUB_HTTP_404',
    });
  });

  it('commitment = SHA-256(JCS(commitmentInput + salt)), salt = HMAC(saltKey, runId); no raw response or IDs', () => {
    const { envelope } = evaluate(applicant(RED));
    const salt = `0x${createHmac('sha256', Buffer.from(secrets.saltKey)).update(context.runId).digest('hex')}`;
    const recomputed = `0x${createHash('sha256')
      .update(canonicalize({ ...envelope.commitmentInput, salt })!)
      .digest('hex')}`;
    expect(envelope.evidenceCommitment).toBe(recomputed);
    const text = JSON.stringify(envelope);
    expect(text).not.toContain(context.applicantId);
    expect(text).not.toContain(context.bindingRef);
    expect(text).not.toContain('SANCTIONS"]}'); // only sanitized reason codes, never the raw review object
  });

  it('run: posts exactly one authenticated callback and returns only {status, code}', () => {
    const { rt, calls } = runtime(applicant(GREEN));
    const result = runInvestorEligibility({
      runId: context.runId,
      context,
      config: config(),
      secrets,
      runtime: rt,
    });
    expect(result).toEqual({ status: 'DELIVERED', code: 'OK' });
    expect(calls.posts).toHaveLength(1);
    expect(JSON.parse(calls.posts[0]!.body)).toMatchObject({
      operation: 'INVESTOR_ELIGIBILITY',
      status: 'OK',
      mode: 'SIMULATION',
    });
  });
});
