// Unit tests for the trust-anchor-admission semantics (PLAN §20.4, §20.7, §20.8, §23). Node test runner only —
// the code under test uses no Node APIs; node:crypto is used here to recompute results independently.
import { createHash, createHmac } from 'node:crypto';
import canonicalize from 'canonicalize';
import { describe, expect, it } from 'vitest';
import { deriveFacts } from '../../src/trust-anchor-admission/facts.js';
import { evaluateRun, runTrustAnchorAdmission, type TtaRuntime } from '../../src/trust-anchor-admission/index.js';
import { MOCK_SCENARIOS } from '../../src/trust-anchor-admission/mock-company.js';
import { normalizeApplicant } from '../../src/trust-anchor-admission/normalize.js';

const NOW = new Date('2026-09-11T12:00:00Z');
const context = {
  sessionRef: 'sref:1',
  runId: 'run:1',
  trustDomain: 'trust-domain:catenor-one-demo',
  subjectDid: 'did:catenor:8f0c92d7e5f04e40a41faee32e5e180b',
  companyApplicantId: 'mock:company-fixture:MOCK_COMPANY_ACTIVE_GREEN',
  representativeApplicantId: 'applicant-rep-synthetic-001',
  companyBindingRef: 'cbr-company',
  representativeBindingRef: 'cbr-representative',
  notAfter: '2026-09-11T12:10:00Z',
};
const accepted = {
  evidenceProfile: 'HYBRID_DEMO',
  evidenceSources: { company: 'SYNTHETIC_MOCK', representative: 'REAL_SUMSUB_SANDBOX' },
  companyLevelNames: ['MOCK_KYB_LEVEL'],
  representativeLevelNames: ['id-only'],
  authorityRoles: ['MOCK_AUTHORIZED_SIGNATORY'],
  activeRegistryStatuses: ['MOCK_ACTIVE'],
  evidenceMaxAgeDays: 180,
};
const config = (scenario = 'MOCK_COMPANY_ACTIVE_GREEN', extra: Record<string, unknown> = {}) => ({
  callbackUrl: 'http://127.0.0.1:9999/v1/internal/cre/identity-confidential/results',
  sumsubBaseUrl: 'https://api.sumsub.com',
  executionMode: 'SIMULATION',
  companyEvidence: { source: 'SYNTHETIC_MOCK', scenario, label: 'MOCK — not Sumsub KYB' },
  bootstrapConfigurationHash: `0x${'b'.repeat(64)}`,
  acceptedEvidence: accepted,
  ...extra,
});
const secrets = {
  sumsubAppToken: 'sbx-synthetic-not-a-token',
  sumsubSecretKey: 'synthetic-not-a-secret',
  callbackKey: new Uint8Array(32).fill(1),
  saltKey: new Uint8Array(32).fill(2),
};
/** Sanitized T0.8 `/one` shape of an individual applicant. */
const representative = (review: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id: 'applicant-rep-synthetic-001',
  externalUserId: 'cbr-representative',
  type: 'individual',
  review: { levelName: 'id-only', reprocessing: true, ...review },
  ...extra,
});
const GREEN = { reviewStatus: 'completed', reviewDate: '2026-09-10 12:00:00+0000', reviewResult: { reviewAnswer: 'GREEN' } };
const RED = {
  reviewStatus: 'completed',
  reviewDate: '2026-09-10 12:00:00+0000',
  reviewResult: { reviewAnswer: 'RED', reviewRejectType: 'FINAL', rejectLabels: ['SANCTIONS'] },
};

function runtime(repBody: unknown, status = 200) {
  const calls: { method: string; url: string; headers: Record<string, string>; body?: Uint8Array }[] = [];
  const rt: TtaRuntime = {
    now: () => NOW,
    httpGet(url, headers) {
      calls.push({ method: 'GET', url, headers });
      return { status, body: new TextEncoder().encode(typeof repBody === 'string' ? repBody : JSON.stringify(repBody)) };
    },
    httpPost(url, headers, body) {
      calls.push({ method: 'POST', url, headers, body });
      return { status: 200 };
    },
    log: () => undefined,
  };
  return { rt, calls };
}
const run = (repBody: unknown, cfg = config(), status = 200) =>
  evaluateRun({ runId: 'run:1', context, config: cfg, secrets, runtime: runtime(repBody, status).rt });

describe('normalization (PLAN §20.8)', () => {
  it('N1: completed GREEN without rejection fields → no labels', () => {
    expect(normalizeApplicant(representative(GREEN))).toMatchObject({ rejectLabels: [], reviewRejectType: null });
  });
  it('N2: absent rejection fields in any other state stay MISSING', () => {
    expect(normalizeApplicant(representative({ reviewStatus: 'pending' })).rejectLabels).toBeNull();
    expect(normalizeApplicant(representative({ reviewStatus: 'completed', reviewResult: { reviewAnswer: 'RED' } })).rejectLabels).toBeNull();
  });
  it('N4: reviewDate is parsed only in the Sumsub format; anything else is MISSING', () => {
    expect(normalizeApplicant(representative(GREEN)).reviewDate?.toISOString()).toBe('2026-09-10T12:00:00.000Z');
    expect(normalizeApplicant(representative({ ...GREEN, reviewDate: '2026-09-10T12:00:00Z' })).reviewDate).toBeNull();
    expect(normalizeApplicant(representative({ ...GREEN, reviewDate: '2026-02-31 00:00:00+0000' })).reviewDate).toBeNull();
  });
  it('N5: rejection labels and reject type become sanitized reason codes only', () => {
    expect(normalizeApplicant(representative(RED)).reasonCodes).toEqual(['SANCTIONS', 'FINAL']);
    expect(normalizeApplicant(representative({ ...RED, reviewResult: { reviewAnswer: 'RED', rejectLabels: ['bad label!'] } })).reasonCodes).toEqual([]);
  });
});

describe('fact derivation — Hybrid Demo Profile (MOCK company + REAL-shaped representative)', () => {
  it('MOCK_COMPANY_ACTIVE_GREEN + representative GREEN → six facts true, CONSISTENT', async () => {
    const r = await run(representative(GREEN));
    expect(r.status).toBe('OK');
    expect(Object.values(r.facts!)).toEqual([true, true, true, true, true, true]);
    expect(r.reconciliation).toEqual({ company: 'CONSISTENT', representative: 'CONSISTENT' });
    expect(r.evidenceSources).toEqual({ company: 'SYNTHETIC_MOCK', representative: 'REAL_SUMSUB_SANDBOX' });
    expect(r.mode).toBe('SIMULATION');
  });

  it.each([
    ['MOCK_COMPANY_RED', { ORGANIZATION_KYB_VERIFIED: false, ORGANIZATION_AML_CLEAR: false, REPRESENTATIVE_AUTHORITY_CONFIRMED: false }, 'MISMATCH'],
    ['MOCK_COMPANY_INACTIVE', { ORGANIZATION_STATUS_VALID: false }, 'CONSISTENT'],
    ['MOCK_COMPANY_STALE', { EVIDENCE_FRESH: false }, 'STALE'],
    ['MOCK_COMPANY_NOT_LINKED', { REPRESENTATIVE_AUTHORITY_CONFIRMED: false }, 'CONSISTENT'],
  ])('%s → %o', async (scenario, expected, companyReconciliation) => {
    const r = await run(representative(GREEN), config(scenario));
    expect(r.status).toBe('OK');
    expect(r.facts).toMatchObject(expected);
    expect(r.reconciliation?.company).toBe(companyReconciliation);
  });

  it('MOCK_COMPANY_RED keeps SANCTIONS as a reason code only (the rule is RED, not the label)', async () => {
    const r = await run(representative(GREEN), config('MOCK_COMPANY_RED'));
    expect(r.factReasons?.ORGANIZATION_AML_CLEAR).toEqual(['SANCTIONS', 'FINAL']);
  });

  it('MOCK_COMPANY_BINDING_MISMATCH → ERROR PROVIDER_BINDING_MISMATCH with no facts', async () => {
    const r = await run(representative(GREEN), config('MOCK_COMPANY_BINDING_MISMATCH'));
    expect(r).toMatchObject({ status: 'ERROR', code: 'PROVIDER_BINDING_MISMATCH' });
    expect(r.facts).toBeUndefined();
  });

  it('REAL representative forced RED (SANCTIONS, FINAL) → AUTHORIZED_REPRESENTATIVE_VERIFIED false (live DENY case, §20.6)', async () => {
    const r = await run(representative(RED));
    expect(r.facts).toMatchObject({ AUTHORIZED_REPRESENTATIVE_VERIFIED: false, REPRESENTATIVE_AUTHORITY_CONFIRMED: false });
    expect(r.factReasons?.AUTHORIZED_REPRESENTATIVE_VERIFIED).toEqual(['SANCTIONS', 'FINAL']);
    expect(r.reconciliation?.representative).toBe('MISMATCH');
  });

  it('representative still pending → false (present "not verified") and INCOMPLETE reconciliation; freshness MISSING', async () => {
    const r = await run(representative({ reviewStatus: 'pending' }));
    expect(r.facts).toMatchObject({ AUTHORIZED_REPRESENTATIVE_VERIFIED: false, EVIDENCE_FRESH: null });
    expect(r.reconciliation?.representative).toBe('INCOMPLETE');
  });

  it('representative applicant bound to another bindingRef → ERROR PROVIDER_BINDING_MISMATCH (TV-E11)', async () => {
    const r = await run(representative(GREEN, { externalUserId: 'someone-else' }));
    expect(r).toMatchObject({ status: 'ERROR', code: 'PROVIDER_BINDING_MISMATCH' });
  });

  it('N3: review.reprocessing has no effect on the facts', async () => {
    const a = await run(representative({ ...GREEN, reprocessing: true }));
    const b = await run(representative({ ...GREEN, reprocessing: false }));
    expect(a.facts).toEqual(b.facts);
  });

  it('D32 / N6: company completed GREEN WITH rejection labels → AML MISSING + INCONSISTENT_PROVIDER_STATE', () => {
    const company = normalizeApplicant({
      type: 'company',
      externalUserId: 'cbr-company',
      review: { levelName: 'MOCK_KYB_LEVEL', reviewStatus: 'completed', reviewDate: '2026-09-01 00:00:00+0000', reviewResult: { reviewAnswer: 'GREEN', rejectLabels: ['PEP'] } },
    });
    const { facts, factReasons } = deriveFacts({
      company,
      registryStatus: 'MOCK_ACTIVE',
      representative: normalizeApplicant(representative(GREEN)),
      context,
      accepted: accepted as never,
      now: NOW,
    });
    expect(facts.ORGANIZATION_AML_CLEAR).toBeNull();
    expect(factReasons.ORGANIZATION_AML_CLEAR).toEqual(['PEP', 'INCONSISTENT_PROVIDER_STATE']);
  });
});

describe('fail closed — ERROR, no facts', () => {
  it.each([
    ['Sumsub 404', () => run({}, config(), 404), 'SUMSUB_HTTP_404'],
    ['unparseable Sumsub body', () => run('not json'), 'SUMSUB_RESPONSE_UNPARSEABLE'],
    ['company source ≠ pinned configuration (TV-B04)', () => run(representative(GREEN), config('MOCK_COMPANY_ACTIVE_GREEN', { companyEvidence: { source: 'REAL_SUMSUB_SANDBOX', scenario: 'x', label: 'x' } })), 'EVIDENCE_SOURCE_MISMATCH'],
    ['unknown MOCK scenario', () => run(representative(GREEN), config('MOCK_UNKNOWN')), 'MOCK_COMPANY_REFERENCE_INVALID'],
  ])('%s → %s', async (_label, call, code) => {
    const r = await call();
    expect(r).toMatchObject({ status: 'ERROR', code });
    expect(r.facts).toBeUndefined();
    expect(r.evidenceCommitment).toBeUndefined();
  });
});

describe('Sumsub request signing, evidence commitment and callback authentication', () => {
  it('signs GET /resources/applicants/{id}/one per PLAN §20.1', async () => {
    const { rt, calls } = runtime(representative(GREEN));
    await evaluateRun({ runId: 'run:1', context, config: config(), secrets, runtime: rt });
    const get = calls[0]!;
    const path = '/resources/applicants/applicant-rep-synthetic-001/one';
    expect(get.url).toBe(`https://api.sumsub.com${path}`);
    const ts = get.headers['X-App-Access-Ts']!;
    expect(ts).toBe(String(Math.floor(NOW.getTime() / 1000)));
    expect(get.headers['X-App-Access-Sig']).toBe(
      createHmac('sha256', secrets.sumsubSecretKey).update(`${ts}GET${path}`).digest('hex'),
    );
  });

  it('evidenceCommitment = SHA-256(JCS(commitmentInput + salt)); the salt is re-derivable from the salt key', async () => {
    const r = await run(representative(GREEN));
    const salt = `0x${createHmac('sha256', Buffer.from(secrets.saltKey)).update('run:1').digest('hex')}`;
    const recomputed = `0x${createHash('sha256').update(canonicalize({ ...r.commitmentInput, salt })!).digest('hex')}`;
    expect(r.evidenceCommitment).toBe(recomputed);
    expect(r.commitmentInput).not.toHaveProperty('salt');
    expect(JSON.stringify(r.commitmentInput)).not.toContain('applicant-rep-synthetic-001');
  });

  it('delivers the envelope to the callback with an HMAC over timestamp + "." + body', async () => {
    const { rt, calls } = runtime(representative(GREEN));
    const out = await runTrustAnchorAdmission({ runId: 'run:1', context, config: config(), secrets, runtime: rt });
    expect(out).toEqual({ status: 'DELIVERED', code: 'OK' });
    const post = calls.find((c) => c.method === 'POST')!;
    const ts = post.headers['x-catenor-timestamp']!;
    expect(post.headers['x-catenor-signature']).toBe(
      createHmac('sha256', Buffer.from(secrets.callbackKey)).update(Buffer.concat([Buffer.from(`${ts}.`), Buffer.from(post.body!)])).digest('hex'),
    );
    const envelope = JSON.parse(new TextDecoder().decode(post.body));
    expect(envelope).toMatchObject({ v: 1, operation: 'TRUST_ANCHOR_ADMISSION', runId: 'run:1', status: 'OK' });
    expect(JSON.stringify(envelope)).not.toMatch(/applicant-rep-synthetic-001|cbr-representative|sbx-synthetic/);
  });

  it('covers every MOCK scenario', () => {
    expect(MOCK_SCENARIOS).toHaveLength(6);
  });
});
