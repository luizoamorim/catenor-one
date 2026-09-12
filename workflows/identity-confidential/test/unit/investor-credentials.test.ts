// Clean-room demo operations (OFFERING_ELIGIBILITY, CONFIDENTIAL_DISTRIBUTION) and the in-TEE presentation verifier.
// Credentials are built and signed with the Catenor One domain packages (the API side), then verified by the workflow
// port — so these tests are also the parity check between the two implementations. Throwaway random keys only.
import { createHash, createHmac } from 'node:crypto';
import {
  attachProofValue,
  createCredential,
  createPresentation,
  createStatusStatement,
  prepareCredentialProof,
  preparePresentationProof,
  prepareStatusStatementProof,
  verifyPresentation as domainVerify,
  type CredentialStatus,
  type VerifiableCredential,
} from '@catenor-one/credentials';
import { encodeEd25519Multikey } from '@catenor-one/identity';
import {
  DISTRIBUTION_ELIGIBILITY_V2_POLICY,
  DISTRIBUTION_ELIGIBILITY_V2_POLICY_HASH,
  INVESTOR_ELIGIBILITY_CREDENTIAL,
  OFFERING_ELIGIBILITY_POLICY,
  OFFERING_ELIGIBILITY_POLICY_HASH,
} from '@catenor-one/policy';
import { ed25519 } from '@noble/curves/ed25519.js';
import canonicalize from 'canonicalize';
import { describe, expect, it } from 'vitest';
import { documentHash, verifyPresentation } from '../../src/credentials/verify-presentation.js';
import {
  computeDistribution,
  evaluateOffering,
  runCredentialOperation,
} from '../../src/investor-credentials/operations.js';
import type { TtaRuntime } from '../../src/trust-anchor-admission/index.js';

const NOW = new Date('2026-09-11T12:00:00Z');
const TA = 'did:catenor:11111111111111111111111111111111';
const TA_VM = `${TA}#assertion-key-1`;
const taSecret = ed25519.utils.randomSecretKey();
const mk = (s: Uint8Array) => encodeEd25519Multikey(ed25519.getPublicKey(s));
const investors = {
  A: {
    did: 'did:catenor:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    secret: ed25519.utils.randomSecretKey(),
    applicantId: 'applicant-synthetic-a',
    bindingRef: 'cbr-a',
  },
  B: {
    did: 'did:catenor:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    secret: ed25519.utils.randomSecretKey(),
    applicantId: 'applicant-synthetic-b',
    bindingRef: 'cbr-b',
  },
};
type Label = keyof typeof investors;
const vmOf = (l: Label) => `${investors[l].did}#authentication-key-1`;

function credential(l: Label): VerifiableCredential {
  const c = createCredential({
    id: `urn:uuid:00000000-0000-4000-8000-00000000000${l === 'A' ? 1 : 2}`,
    type: INVESTOR_ELIGIBILITY_CREDENTIAL,
    issuer: TA,
    validFrom: '2026-09-11T10:00:00Z',
    validUntil: '2026-12-11T10:00:00Z',
    credentialSubject: {
      id: investors[l].did,
      investorIdentityVerified: true,
      investorAmlClear: true,
      evidenceCommitment: `0x${'c'.repeat(64)}`,
    },
    statusId: `urn:catenor-one:status:${l}`,
  });
  const { proofOptions, hashData } = prepareCredentialProof(c, TA_VM, '2026-09-11T10:00:00Z');
  return { ...c, proof: attachProofValue(proofOptions, ed25519.sign(hashData, taSecret)) };
}

function presentation(l: Label, challenge: string, domain: string, vc = credential(l)) {
  const p = createPresentation({ holder: investors[l].did, credentials: [vc] });
  const { proofOptions, hashData } = preparePresentationProof(p, {
    verificationMethod: vmOf(l),
    created: '2026-09-11T11:59:00Z',
    challenge,
    domain,
  });
  return { ...p, proof: attachProofValue(proofOptions, ed25519.sign(hashData, investors[l].secret)) };
}

function status(vc: VerifiableCredential, value: CredentialStatus = 'ACTIVE') {
  const s = createStatusStatement({ credential: vc, status: value, checkedAt: '2026-09-11T11:58:00Z' });
  const { proofOptions, hashData } = prepareStatusStatementProof(s, TA_VM, s.checkedAt);
  return { ...s, proof: attachProofValue(proofOptions, ed25519.sign(hashData, taSecret)) };
}

const acceptedIssuers = [
  {
    did: TA,
    verificationMethod: TA_VM,
    publicKeyMultibase: mk(taSecret),
    credentialTypes: [INVESTOR_ELIGIBILITY_CREDENTIAL],
  },
];
const config = {
  callbackUrl: 'http://127.0.0.1:9999/v1/internal/cre/identity-confidential/results',
  sumsubBaseUrl: 'https://api.sumsub.com',
  executionMode: 'SIMULATION',
  bootstrapConfigurationHash: `0x${'b'.repeat(64)}`,
  investorEvidence: { levelNames: ['id-only'], evidenceMaxAgeDays: 180 },
  credentialRules: {
    credentialType: INVESTOR_ELIGIBILITY_CREDENTIAL,
    acceptedIssuers,
    maxStatusAgeSeconds: 600,
    policies: { offering: OFFERING_ELIGIBILITY_POLICY, distribution: DISTRIBUTION_ELIGIBILITY_V2_POLICY },
  },
};
const secrets = {
  sumsubAppToken: 'sbx-synthetic-not-a-token',
  sumsubSecretKey: 'synthetic-not-a-secret',
  callbackKey: new Uint8Array(32).fill(1),
  saltKey: new Uint8Array(32).fill(2),
};
const review = (answer: 'GREEN' | 'RED') => ({
  reviewStatus: 'completed',
  reviewDate: '2026-09-10 12:00:00+0000',
  reviewResult:
    answer === 'GREEN'
      ? { reviewAnswer: 'GREEN' }
      : { reviewAnswer: 'RED', reviewRejectType: 'FINAL', rejectLabels: ['SANCTIONS'] },
});

/** Synthetic Sumsub: applicant id → current review (or an HTTP status). */
function runtime(current: Partial<Record<Label, 'GREEN' | 'RED' | number>>) {
  const calls = { gets: [] as string[], posts: [] as string[] };
  const rt: TtaRuntime = {
    now: () => NOW,
    httpGet: (url) => {
      calls.gets.push(url);
      const label = (Object.keys(investors) as Label[]).find((l) => url.includes(investors[l].applicantId));
      const answer = label ? current[label] : undefined;
      if (label === undefined || answer === undefined) return { status: 404, body: new Uint8Array() };
      if (typeof answer === 'number') return { status: answer, body: new Uint8Array() };
      const body = {
        id: investors[label].applicantId,
        externalUserId: investors[label].bindingRef,
        type: 'individual',
        review: { levelName: 'id-only', ...review(answer) },
      };
      return { status: 200, body: new TextEncoder().encode(JSON.stringify(body)) };
    },
    httpPost: (_url, _h, b) => {
      calls.posts.push(new TextDecoder().decode(b));
      return { status: 200 };
    },
    log: () => {},
  };
  return { rt, calls };
}

const holder = (l: Label, challenge: string, domain: string, extra: Record<string, unknown> = {}) => {
  const vc = credential(l);
  return {
    investor: investors[l].did,
    presentation: presentation(l, challenge, domain, vc),
    holderKey: { verificationMethod: vmOf(l), publicKeyMultibase: mk(investors[l].secret) },
    status: status(vc),
    applicantId: investors[l].applicantId,
    bindingRef: investors[l].bindingRef,
    ...extra,
  };
};

const base = { sessionRef: 'session:1', runId: 'run:1', trustDomain: 'trust-domain:catenor-one-demo', notAfter: '2026-09-11T12:10:00Z' };
const OFFERING = 'offering:catenor-demo-001';
const offeringContext = (subs = [
  { ...holder('A', 'nonce-a', OFFERING), units: '600', challenge: 'nonce-a' },
  { ...holder('B', 'nonce-b', OFFERING), units: '400', challenge: 'nonce-b' },
]) => ({
  ...base,
  offering: { id: OFFERING, policy: { id: OFFERING_ELIGIBILITY_POLICY.id, hash: OFFERING_ELIGIBILITY_POLICY_HASH } },
  subscriptions: subs,
});
const DIST_DOMAIN = 'distribution:spv:catenor-demo-001';
const distributionContext = () => ({
  ...base,
  distribution: {
    resource: 'spv:catenor-demo-001',
    asset: '0x0000000000000000000000000000000000000001',
    revenueEventId: 'revenue-event:1',
    revenueWeibar: (10n * 10n ** 18n).toString(),
    policy: { id: DISTRIBUTION_ELIGIBILITY_V2_POLICY.id, hash: DISTRIBUTION_ELIGIBILITY_V2_POLICY_HASH },
    challenge: 'plan-nonce',
    domain: DIST_DOMAIN,
  },
  holders: [
    { ...holder('A', 'plan-nonce', DIST_DOMAIN), units: '600' },
    { ...holder('B', 'plan-nonce', DIST_DOMAIN), units: '400' },
  ],
});

describe('in-TEE presentation verifier = domain verifier (parity)', () => {
  const vc = credential('A');
  const variants: [string, Record<string, unknown>][] = [
    ['valid', {}],
    ['another challenge', { challenge: 'other' }],
    ['issuer not accepted', { acceptedIssuers: [] }],
    ['revoked', { status: status(vc, 'REVOKED') }],
    ['no status', { status: undefined }],
    ['expired', { now: new Date('2027-06-01T00:00:00Z') }],
    ['malformed', { presentation: { type: ['VerifiablePresentation'] } }],
    ['forged VC', { presentation: presentation('A', 'n', 'd', { ...vc, credentialSubject: { ...vc.credentialSubject, investorAmlClear: false } }) }],
  ];
  it.each(variants)('%s → identical check results', (_name, over) => {
    const input = {
      presentation: presentation('A', 'n', 'd', vc),
      holderKey: { verificationMethod: vmOf('A'), publicKeyMultibase: mk(investors.A.secret) },
      challenge: 'n',
      domain: 'd',
      credentialType: INVESTOR_ELIGIBILITY_CREDENTIAL,
      acceptedIssuers,
      status: status(vc),
      maxStatusAgeSeconds: 600,
      now: NOW,
      ...over,
    };
    const tee = verifyPresentation(input as Parameters<typeof verifyPresentation>[0]);
    const domain = domainVerify(input as Parameters<typeof domainVerify>[0]);
    expect(tee.checks).toEqual(domain.checks);
    expect(tee.valid).toBe(domain.valid);
  });

  it('the in-TEE policy hash equals the domain policyHash', () => {
    expect(documentHash(OFFERING_ELIGIBILITY_POLICY)).toBe(OFFERING_ELIGIBILITY_POLICY_HASH);
    expect(documentHash(DISTRIBUTION_ELIGIBILITY_V2_POLICY)).toBe(DISTRIBUTION_ELIGIBILITY_V2_POLICY_HASH);
  });
});

describe('OFFERING_ELIGIBILITY', () => {
  it('both investors valid (VP + GREEN) → both ALLOW, all seven checks TRUE, CONSISTENT', () => {
    const { rt, calls } = runtime({ A: 'GREEN', B: 'GREEN' });
    const e = evaluateOffering({ runId: 'run:1', context: offeringContext(), config, secrets, runtime: rt });
    expect(e.status).toBe('OK');
    const results = (e.facts as { results: { decision: string; presentationChecks: Record<string, boolean>; reconciliation: { credentialVsCurrent: string } }[] }).results;
    expect(results.map((r) => r.decision)).toEqual(['ALLOW', 'ALLOW']);
    expect(results.every((r) => Object.values(r.presentationChecks).every(Boolean))).toBe(true);
    expect(results.every((r) => r.reconciliation.credentialVsCurrent === 'CONSISTENT')).toBe(true);
    expect(calls.gets).toHaveLength(2);
  });

  it('a replayed presentation (challenge of another request) → DENY with FAILED_HOLDER_PROOF_VALID', () => {
    const { rt } = runtime({ A: 'GREEN' });
    const e = evaluateOffering({
      runId: 'run:1',
      context: offeringContext([{ ...holder('A', 'old-nonce', OFFERING), units: '600', challenge: 'nonce-a' }]),
      config,
      secrets,
      runtime: rt,
    });
    const r = (e.facts as { results: { decision: string; reasonCodes: string[] }[] }).results[0]!;
    expect(r.decision).toBe('DENY');
    expect(r.reasonCodes).toContain('FAILED_HOLDER_PROOF_VALID');
  });

  it('a policy other than the one the offering pins → ERROR POLICY_PIN_MISMATCH, no Sumsub call', () => {
    const { rt, calls } = runtime({ A: 'GREEN', B: 'GREEN' });
    const ctx = { ...offeringContext(), offering: { id: OFFERING, policy: { id: OFFERING_ELIGIBILITY_POLICY.id, hash: `0x${'0'.repeat(64)}` } } };
    const e = evaluateOffering({ runId: 'run:1', context: ctx, config, secrets, runtime: rt });
    expect(e).toMatchObject({ status: 'ERROR', code: 'POLICY_PIN_MISMATCH' });
    expect(calls.gets).toHaveLength(0);
  });
});

describe('CONFIDENTIAL_DISTRIBUTION — the plan is computed inside the TEE', () => {
  it('revenue 10 HBAR, A 600 / B 400, B now RED → A PAY 6 HBAR, B HOLD 4 HBAR', () => {
    const { rt } = runtime({ A: 'GREEN', B: 'RED' });
    const e = computeDistribution({ runId: 'run:1', context: distributionContext(), config, secrets, runtime: rt });
    expect(e.status).toBe('OK');
    const f = e.facts as {
      holders: { investor: string; shareWeibar: string; decision: string; controlled: string; presentationChecks: Record<string, boolean>; reconciliation: { credentialVsCurrent: string }; trace: { requirement: string; status: string }[] }[];
      payWeibar: string;
      heldWeibar: string;
      undistributedWeibar: string;
    };
    const [a, b] = f.holders;
    expect([a!.controlled, a!.shareWeibar]).toEqual(['PAY', (6n * 10n ** 18n).toString()]);
    expect([b!.controlled, b!.shareWeibar]).toEqual(['HOLD', (4n * 10n ** 18n).toString()]);
    // B's credential is still cryptographically valid: signature validity ≠ current eligibility.
    expect(Object.values(b!.presentationChecks).every(Boolean)).toBe(true);
    expect(b!.reconciliation.credentialVsCurrent).toBe('MISMATCH');
    expect(b!.trace.filter((t) => t.status === 'FALSE').map((t) => t.requirement)).toEqual([
      'INVESTOR_IDENTITY_VERIFIED',
      'INVESTOR_AML_CLEAR',
    ]);
    expect([f.payWeibar, f.heldWeibar, f.undistributedWeibar]).toEqual([
      (6n * 10n ** 18n).toString(),
      (4n * 10n ** 18n).toString(),
      '0',
    ]);
  });

  it('a provider error for one holder → that holder HOLD (MISSING, never TRUE); the other is still computed', () => {
    const { rt } = runtime({ A: 'GREEN', B: 500 });
    const e = computeDistribution({ runId: 'run:1', context: distributionContext(), config, secrets, runtime: rt });
    const [a, b] = (e.facts as { holders: { controlled: string; reasonCodes: string[]; trace: { status: string }[] }[] }).holders;
    expect(a!.controlled).toBe('PAY');
    expect(b!.controlled).toBe('HOLD');
    expect(b!.reasonCodes).toContain('SUMSUB_HTTP_500');
    expect(b!.trace.some((t) => t.status === 'MISSING')).toBe(true);
  });

  it('only the minimized conclusion leaves: no presentation, credential, proof, applicant id or bindingRef', () => {
    const { rt, calls } = runtime({ A: 'GREEN', B: 'RED' });
    const result = runCredentialOperation('CONFIDENTIAL_DISTRIBUTION', {
      runId: 'run:1',
      context: distributionContext(),
      config,
      secrets,
      runtime: rt,
    });
    expect(result).toEqual({ status: 'DELIVERED', code: 'OK' });
    expect(calls.gets).toHaveLength(2);
    expect(calls.posts).toHaveLength(1);
    const body = calls.posts[0]!;
    for (const secret of ['applicant-synthetic', 'cbr-a', 'cbr-b', 'proofValue', 'urn:uuid:', 'verifiableCredential', 'SANCTIONS_LIST_RAW']) {
      expect(body).not.toContain(secret);
    }
    expect(body.length).toBeLessThan(10_000); // the CRE HTTP request-size limit
    // The evidence commitment is recomputable from the delivered commitmentInput and the re-derived salt.
    const env = JSON.parse(body) as { evidenceCommitment: string; commitmentInput: Record<string, unknown>; runId: string };
    const salt = `0x${createHmac('sha256', Buffer.from(secrets.saltKey)).update(env.runId).digest('hex')}`;
    const recomputed = `0x${createHash('sha256').update(canonicalize({ ...env.commitmentInput, salt })!).digest('hex')}`;
    expect(recomputed).toBe(env.evidenceCommitment);
  });

  it('holdings summing to zero → ERROR NO_HOLDINGS', () => {
    const { rt } = runtime({ A: 'GREEN', B: 'GREEN' });
    const ctx = distributionContext();
    ctx.holders = ctx.holders.map((h) => ({ ...h, units: '0' }));
    expect(computeDistribution({ runId: 'run:1', context: ctx, config, secrets, runtime: rt })).toMatchObject({
      status: 'ERROR',
      code: 'NO_HOLDINGS',
    });
  });
});
