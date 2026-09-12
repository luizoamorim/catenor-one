// Clean-room demo chain on real PostgreSQL, end to end, with no sponsor call:
//   Trust Anchor → Sponsor (relationship + five capabilities) → SPV + offering → investors (VC, VP) → offering
//   eligibility → investment authorization → Agent (relationship + delegated capability) → Investor B RED →
//   CONFIDENTIAL distribution (A PAY 6, B HOLD 4) → approved payouts; a revoked credential then HOLDs A too.
// Test doubles (labeled): FAKE Ed25519 signers; a synthetic Sumsub; wallet provisioners. The confidential operations
// are the REAL workflow code (workflows/identity-confidential) behind the REAL channel: API sealContext → workflow
// openSealedContext → operation → workflow callback headers → API authenticateCallback → service. Only the CRE runtime
// itself is replaced by an in-process call — the live path runs in scripts/demo (CRE simulation).
import { verifyChain } from '@catenor-one/audit';
import {
  bootstrapConfigurationHash,
  parseBootstrapConfiguration,
  SPONSOR_CAPABILITIES,
  EXECUTE_DISTRIBUTION,
  TOKENIZE_ASSET,
} from '@catenor-one/authority';
import {
  DISTRIBUTION_ELIGIBILITY_V2_POLICY,
  INVESTOR_ELIGIBILITY_CREDENTIAL,
  OFFERING_ELIGIBILITY_POLICY,
  policyHash,
} from '@catenor-one/policy';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authenticateCallback,
  deriveChannelKeys,
  sealContext,
  type SealableContext,
} from '../../infrastructure/confidential-compute/cre-channel.js';
import { FakeConfidentialVerifier } from '../../infrastructure/confidential-compute/fake-confidential-verifier.js';
import {
  FakeAssertionSigner,
  FakeBootstrapEndorsementSigner,
} from '../../infrastructure/key-management/fake-signers.js';
import type { PrismaClient } from '../../infrastructure/persistence/prisma/generated/client.js';
import {
  prisma,
  startPostgres,
} from '../../infrastructure/persistence/prisma/postgres.test-fixtures.js';
import {
  PrismaUnitOfWork,
  createPrismaClient,
} from '../../infrastructure/persistence/prisma/prisma-persistence.js';
import {
  nodeIds,
  packagedAdmissionPolicy,
  pinnedBootstrapConfiguration,
} from '../../infrastructure/runtime/runtime-adapters.js';
import {
  SponsorActionRefused,
  SponsorAuthorizationService,
} from '../sponsor-authorization/application/sponsor-authorization.service.js';
import { TrustAnchorAdmissionService } from '../trust-anchor-admission/application/trust-anchor-admission.service.js';
import {
  InvestorCredentialsService,
  InvestorFlowRefused,
  type CredentialOperationResult,
} from './application/investor-credentials.service.js';

const TD = 'trust-domain:catenor-one-demo';
const RESOURCE = 'spv:catenor-demo-001';
const HBAR = 10n ** 18n;
const TOKEN = 'ab'.repeat(32); // synthetic channel token (test only)
const ADDRESS = {
  A: '0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78',
  B: '0x72f94a15A815853B488BCf225ec3cb67eC5ba444',
};
let now = new Date('2026-09-12T10:00:00Z');
const clock = { now: () => now };

let container: StartedPostgreSqlContainer;
let client: PrismaClient;
let admission: TrustAnchorAdmissionService;
let sponsorSvc: SponsorAuthorizationService;
let investors: InvestorCredentialsService;
let trustAnchor: string;
let bootstrapHash: string;
/** Synthetic Sumsub: applicantId → bindingRef + current review. */
const sumsub = new Map<string, { bindingRef: string; answer: 'GREEN' | 'RED' }>();
const sumsubCalls: string[] = [];
const callbacks: { accepted: boolean; reason?: string }[] = [];

// The workflow sources are loaded dynamically so they stay under the workflow's own TypeScript settings.
interface TtaRuntime {
  now(): Date;
  httpGet(url: string, headers: Record<string, string>): { status: number; body: Uint8Array };
  httpPost(url: string, headers: Record<string, string>, body: Uint8Array): { status: number };
  log(event: string, fields?: Record<string, string | number | boolean>): void;
}
type OperationArgs = {
  runId: string;
  context: Record<string, unknown>;
  config: Record<string, unknown>;
  secrets: {
    sumsubAppToken: string;
    sumsubSecretKey: string;
    callbackKey: Uint8Array;
    saltKey: Uint8Array;
  };
  runtime: TtaRuntime;
};
const workflow = (path: string) =>
  import(new URL(`../../../../../workflows/identity-confidential/${path}`, import.meta.url).href);
const { deriveKeys } = (await workflow('shared/keys.ts')) as {
  deriveKeys(token: string): {
    contextKey: Uint8Array;
    callbackKey: Uint8Array;
    commitmentSaltKey: Uint8Array;
  };
};
const { openSealedContext } = (await workflow('shared/sealed-context.ts')) as {
  openSealedContext(payload: unknown, key: Uint8Array, now: Date): Record<string, unknown>;
};
const { runCredentialOperation } = (await workflow('src/investor-credentials/operations.ts')) as {
  runCredentialOperation(op: string, args: OperationArgs): unknown;
};
const { runInvestorEligibility } = (await workflow('src/investor-eligibility/index.ts')) as {
  runInvestorEligibility(args: OperationArgs): unknown;
};

const apiKeys = deriveChannelKeys(TOKEN);
const teeKeys = deriveKeys(TOKEN);

function sumsubResponse(url: string) {
  sumsubCalls.push(url);
  const id = decodeURIComponent(/applicants\/([^/]+)\/one/.exec(url)?.[1] ?? '');
  const a = sumsub.get(id);
  if (!a) return { status: 404, body: new Uint8Array() };
  const review =
    a.answer === 'GREEN'
      ? { reviewAnswer: 'GREEN' }
      : { reviewAnswer: 'RED', reviewRejectType: 'FINAL', rejectLabels: ['SANCTIONS'] };
  const body = {
    id,
    externalUserId: a.bindingRef,
    type: 'individual',
    review: {
      levelName: 'id-only',
      reviewStatus: 'completed',
      reviewDate: '2026-09-11 12:00:00+0000',
      reviewResult: review,
    },
  };
  return { status: 200, body: new TextEncoder().encode(JSON.stringify(body)) };
}

/** The in-process stand-in for the CRE runtime: real sealing, real operation code, real callback authentication. */
function teeVerifier(config: () => Promise<Record<string, unknown>>) {
  return {
    mode: 'SIMULATION' as const,
    workflowId: 'IN-PROCESS (integration test)',
    async request(input: { operation: string; runId: string; context: SealableContext }) {
      const payload = sealContext(apiKeys, input.operation, input.context);
      const context = openSealedContext(payload, teeKeys.contextKey, now);
      const runtime: TtaRuntime = {
        now: () => now,
        httpGet: (url: string) => sumsubResponse(url),
        httpPost: (_url: string, headers: Record<string, string>, body: Uint8Array) => {
          const verdict = authenticateCallback(
            apiKeys,
            {
              timestamp: headers['x-catenor-timestamp'],
              signature: headers['x-catenor-signature'],
            },
            body,
            now,
          );
          callbacks.push(
            verdict.ok ? { accepted: true } : { accepted: false, reason: verdict.reason },
          );
          if (verdict.ok) {
            void investors.recordResult(verdict.result as unknown as CredentialOperationResult);
          }
          return { status: verdict.ok ? 200 : 401 };
        },
        log: () => {},
      };
      const args = {
        runId: input.runId,
        context,
        config: await config(),
        secrets: {
          sumsubAppToken: 'sbx-synthetic',
          sumsubSecretKey: 'synthetic',
          callbackKey: teeKeys.callbackKey,
          saltKey: teeKeys.commitmentSaltKey,
        },
        runtime,
      };
      // Asynchronous, like a real callback.
      setTimeout(() => {
        if (input.operation === 'INVESTOR_ELIGIBILITY') runInvestorEligibility(args);
        else runCredentialOperation(input.operation, args);
      }, 1);
      return { executionId: `IN-PROCESS:${input.runId}` };
    },
  };
}

beforeAll(async () => {
  container = await startPostgres();
  const deploy = await prisma(container.getConnectionUri(), ['migrate', 'deploy']);
  if (deploy.code !== 0) throw new Error(deploy.output);
  client = createPrismaClient(container.getConnectionUri());
  const uow = new PrismaUnitOfWork(client);
  const signer = new FakeAssertionSigner();
  const bootstrapSigner = new FakeBootstrapEndorsementSigner();
  const raw = {
    type: 'CatenorTrustDomainBootstrapConfiguration',
    profile: 'catenor-one/bootstrap-configuration/v1',
    trustDomain: TD,
    admissionPolicy: 'policy:trust-anchor-admission:v1',
    admissionPolicyHash: policyHash(packagedAdmissionPolicy.load()),
    bootstrapVerificationMethod: 'bootstrap-verification-method:1',
    bootstrapPublicKeyMultibase: await bootstrapSigner.publicKeyMultibase(),
    commitmentProfile: { canonicalization: 'RFC8785', hash: 'SHA-256', encoding: '0x-hex' },
    acceptedEvidence: {
      profileNote:
        '[REF-IMPL] Catenor One reference/demo evidence-acceptance rules; not a Catenor Protocol rule',
      provider: 'sumsub',
      environment: 'sandbox',
      evidenceProfile: 'HYBRID_DEMO',
      evidenceSources: { company: 'SYNTHETIC_MOCK', representative: 'REAL_SUMSUB_SANDBOX' },
      companyLevelNames: ['MOCK_KYB_LEVEL'],
      representativeLevelNames: ['id-only'],
      authorityRoles: ['MOCK_AUTHORIZED_SIGNATORY'],
      activeRegistryStatuses: ['MOCK_ACTIVE'],
      evidenceMaxAgeDays: 180,
    },
  };
  bootstrapHash = bootstrapConfigurationHash(parseBootstrapConfiguration(raw));
  const configuration = pinnedBootstrapConfiguration(raw, bootstrapHash);
  const fakeVerifier = new FakeConfidentialVerifier(configuration.load());
  const common = { uow, clock, ids: nodeIds, trustDomain: TD };
  admission = new TrustAnchorAdmissionService({
    ...common,
    configuration,
    policy: packagedAdmissionPolicy,
    assertionSigner: signer,
    bootstrapSigner,
    verifier: fakeVerifier,
  });
  const started = await admission.startInitialAdmission({ operatorRef: 'operator-ref:test' });
  await admission.attachProviderReferences(started.sessionRef, {
    companyApplicantId: 'mock:company-fixture:MOCK_COMPANY_ACTIVE_GREEN',
    representativeApplicantId: 'sandbox-applicant-fixture',
  });
  await admission.provisionAssertionKey(started.sessionRef);
  await admission.issueKeyPossessionChallenge(started.sessionRef);
  await admission.proveKeyPossessionWithSecureSigner(started.sessionRef);
  const { runId } = await admission.requestConfidentialVerification(started.sessionRef);
  await admission.recordConfidentialVerificationResult(fakeVerifier.resultFor(runId, 'GREEN'));
  await admission.evaluateAdmission(started.sessionRef);
  await admission.endorseAndActivate(started.sessionRef);
  trustAnchor = started.did;

  const verifyTrustAnchor = (did: string) => admission.verifyTrustAnchor(did);
  sponsorSvc = new SponsorAuthorizationService({
    ...common,
    assertionSigner: signer,
    verifyTrustAnchor,
    spvProvisioner: {
      adapter: 'test-double',
      provision: async () => ({
        walletRef: 'test-spv-wallet',
        address: '0x6c6AD33BA7FB4DA58A1b7412706f8ECB10Ba9C93',
        policyRef: 'test-spv-policy',
        controls: ['test control'],
      }),
    },
    agentProvisioner: {
      adapter: 'test-double',
      provision: async () => ({
        walletRef: 'test-agent-wallet',
        address: '0x5037705014596A9050A51Bc131c9B55Cf98fFC51',
        policyRef: 'test-agent-policy',
        controls: ['test control'],
      }),
    },
  });
  const workflowConfig = async () => ({
    callbackUrl: 'http://in-process/v1/internal/cre/identity-confidential/results',
    sumsubBaseUrl: 'https://api.sumsub.com',
    executionMode: 'SIMULATION',
    bootstrapConfigurationHash: bootstrapHash,
    investorEvidence: { levelNames: ['id-only'], evidenceMaxAgeDays: 180 },
    credentialRules: {
      credentialType: INVESTOR_ELIGIBILITY_CREDENTIAL,
      acceptedIssuers: await investors.acceptedIssuers(trustAnchor),
      maxStatusAgeSeconds: 600,
      policies: {
        offering: OFFERING_ELIGIBILITY_POLICY,
        distribution: DISTRIBUTION_ELIGIBILITY_V2_POLICY,
      },
    },
  });
  investors = new InvestorCredentialsService({
    ...common,
    assertionSigner: signer,
    verifyTrustAnchor,
    verifier: teeVerifier(workflowConfig),
    sponsor: sponsorSvc,
    resultTimeoutMs: 10_000,
  });
}, 240_000);

afterAll(async () => {
  await client?.$disconnect();
  await container?.stop();
});

async function newInvestor(address: string) {
  const r = await investors.registerInvestor({ account: address });
  const applicantId = `applicant-${r.did.slice(-8)}`;
  sumsub.set(applicantId, { bindingRef: r.bindingRef, answer: 'GREEN' });
  await investors.attachApplicant(r.did, applicantId);
  return { ...r, applicantId };
}

describe('clean-room chain [REF-IMPL] — Trust Anchor → Sponsor → investors → Agent → confidential distribution', () => {
  const validUntil = '2026-10-12T10:00:00Z';
  let sponsor: string;
  let offeringId: string;
  let a: Awaited<ReturnType<typeof newInvestor>>;
  let b: Awaited<ReturnType<typeof newInvestor>>;
  let agent: string;

  it('Trust Anchor authorizes the Sponsor: relationship (grants nothing) + five capabilities (ALLOW)', async () => {
    sponsor = (await sponsorSvc.registerSponsor()).did;
    // Before authorization the Sponsor can do nothing.
    expect(
      (await sponsorSvc.authorizeSponsorAction(sponsor, TOKENIZE_ASSET, RESOURCE)).reasons,
    ).toEqual(['CAPABILITY_MISSING']);
    const { grants } = await sponsorSvc.authorizeSponsor({
      trustAnchor,
      sponsor,
      resource: RESOURCE,
      validUntil,
    });
    expect(grants.map((g) => g.capability.action)).toEqual([...SPONSOR_CAPABILITIES]);
    for (const action of SPONSOR_CAPABILITIES) {
      expect((await sponsorSvc.authorizeSponsorAction(sponsor, action, RESOURCE)).decision).toBe(
        'ALLOW',
      );
    }
    const rel = await sponsorSvc.verifyRelationship({
      subject: sponsor,
      predicate: 'AUTHORIZED_SPONSOR_IN',
      object: TD,
    });
    expect(rel.verification).toEqual({ valid: true, reasons: [] });
  });

  it('Sponsor creates the SPV (TOKENIZE_ASSET) and signs the offering (DEFINE_OFFERING_POLICY)', async () => {
    const spv = await sponsorSvc.createSpv({ sponsor, resource: RESOURCE, validUntil });
    expect(spv.relationship.credentialSubject.relationship).toEqual({
      type: 'SPONSORED_BY',
      object: sponsor,
    });
    const offering = await sponsorSvc.defineOffering({
      sponsor,
      resource: RESOURCE,
      name: 'Catenor One Demo SPV 001',
      totalUnits: 1000,
      validUntil,
    });
    offeringId = offering.id;
    expect(await sponsorSvc.verifyOffering(offering)).toEqual({ decision: 'ALLOW', reasons: [] });
    // Another organization without the capability cannot define an offering for this SPV.
    const other = (await sponsorSvc.registerSponsor()).did;
    await expect(
      sponsorSvc.defineOffering({
        sponsor: other,
        resource: RESOURCE,
        name: 'x',
        totalUnits: 1,
        validUntil,
      }),
    ).rejects.toThrow('DEFINE_OFFERING_POLICY denied');
  });

  it('provider evidence → confidential check → Trust Anchor-issued VCs (no PII)', async () => {
    a = await newInvestor(ADDRESS.A);
    b = await newInvestor(ADDRESS.B);
    for (const inv of [a, b]) {
      const { credential, run } = await investors.issueInvestorCredential({
        trustAnchor,
        investor: inv.did,
      });
      expect(run.status).toBe('OK');
      expect(credential.issuer).toBe(trustAnchor);
      expect(credential.credentialSubject).toMatchObject({
        id: inv.did,
        investorIdentityVerified: true,
      });
      expect(JSON.stringify(credential)).not.toContain(inv.applicantId);
    }
  });

  it('offering eligibility in the TEE: VP + current evidence → both ALLOW (600 / 400)', async () => {
    const { records } = await investors.evaluateOffering({
      sponsor,
      offeringId,
      subscriptions: [
        { investor: a.did, units: 600n },
        { investor: b.did, units: 400n },
      ],
    });
    expect(records.map((r) => [r.decision.decision, r.units])).toEqual([
      ['ALLOW', '600'],
      ['ALLOW', '400'],
    ]);
    expect(Object.values(records[0]!.outcome.presentationChecks).every(Boolean)).toBe(true);
    expect(callbacks.every((c) => c.accepted)).toBe(true);
  });

  it('investment: the ALLOW Decision authorizes exactly its units, once (no generic mint)', async () => {
    const auth = await investors.authorizeInvestment({ sponsor, offeringId, investor: a.did });
    expect([auth.units, auth.tokenHolder]).toEqual([600n, ADDRESS.A]);
    await investors.recordInvestmentExecuted({
      investor: a.did,
      offeringId,
      decisionRef: auth.record.id,
      units: auth.units,
      asset: '0x0000000000000000000000000000000000000001',
      transactionId: '0xtest',
    });
    await expect(
      investors.authorizeInvestment({ sponsor, offeringId, investor: a.did }),
    ).rejects.toThrow('already used');
  });

  it('Agent: created ≠ authorized; relationship ≠ capability; only the delegated grant authorizes', async () => {
    agent = (
      await sponsorSvc.createAgent({
        sponsor,
        resource: RESOURCE,
        investors: [a.did, b.did],
        maxPayoutWeibar: 20n * HBAR,
      })
    ).did;
    const noGrant = await investors.computeConfidentialDistribution({
      agent,
      resource: RESOURCE,
      asset: 'x',
      revenueEventId: 'none',
      investors: [a.did, b.did],
      holdings: new Map(),
      holdingsSource: 'test',
    });
    expect(noGrant).toEqual({ decision: 'DENY', reasons: ['CAPABILITY_MISSING'] });
    await sponsorSvc.establishAgentRelationship({ sponsor, agent, validUntil });
    const relationshipOnly = await investors.computeConfidentialDistribution({
      agent,
      resource: RESOURCE,
      asset: 'x',
      revenueEventId: 'none',
      investors: [a.did, b.did],
      holdings: new Map(),
      holdingsSource: 'test',
    });
    expect(relationshipOnly.decision).toBe('DENY');
    await expect(
      sponsorSvc.delegateToAgent({
        sponsor,
        agent,
        action: TOKENIZE_ASSET,
        resource: RESOURCE,
        validUntil: '2026-10-01T00:00:00Z',
      }),
    ).rejects.toBeInstanceOf(SponsorActionRefused);
    const { authorization } = await sponsorSvc.delegateToAgent({
      sponsor,
      agent,
      action: EXECUTE_DISTRIBUTION,
      resource: RESOURCE,
      validUntil: '2026-10-01T00:00:00Z',
    });
    expect(authorization.chain?.map((e) => e.action)).toEqual([
      'CREATE_DISTRIBUTION',
      'DELEGATE_DISTRIBUTION_AUTHORITY',
      'EXECUTE_DISTRIBUTION',
    ]);
  });

  it('Investor B turns RED → the TEE computes A PAY 6 / B HOLD 4; B’s credential is still valid', async () => {
    sumsub.set(b.applicantId, { ...sumsub.get(b.applicantId)!, answer: 'RED' });
    const { revenueEventId } = await investors.recordRevenue({
      spv: sponsor,
      resource: RESOURCE,
      amountWeibar: 10n * HBAR,
      source: 'test',
    });
    const result = await investors.computeConfidentialDistribution({
      agent,
      resource: RESOURCE,
      asset: '0x0000000000000000000000000000000000000001',
      revenueEventId,
      investors: [a.did, b.did],
      holdings: new Map([
        [a.did, 600n],
        [b.did, 400n],
      ]),
      holdingsSource: 'test',
    });
    if (result.decision !== 'ALLOW') throw new Error('unexpected DENY');
    const [pa, pb] = result.plan.holders;
    expect([pa!.controlled, pa!.shareWeibar]).toEqual(['PAY', (6n * HBAR).toString()]);
    expect([pb!.controlled, pb!.shareWeibar]).toEqual(['HOLD', (4n * HBAR).toString()]);
    expect(Object.values(pb!.presentationChecks).every(Boolean)).toBe(true);
    expect(pb!.reconciliation.credentialVsCurrent).toBe('MISMATCH');
    const payA = await investors.approvedPayout(result.plan, a.did);
    const payB = await investors.approvedPayout(result.plan, b.did);
    expect([payA.controlled, payA.approvedWeibar, payA.boundAccount]).toEqual([
      'PAY',
      6n * HBAR,
      ADDRESS.A,
    ]);
    expect([payB.controlled, payB.approvedWeibar]).toEqual(['HOLD', 0n]);
    // The plan is recorded privately and re-loadable by a later process (stage 83).
    expect((await investors.findPlan(agent, result.plan.id))?.payWeibar).toBe(
      (6n * HBAR).toString(),
    );
  });

  it('a REVOKED credential status fails STATUS_ACTIVE inside the TEE → A is HELD too', async () => {
    const stored = await investors.credentialOf(a.did);
    await new PrismaUnitOfWork(client).run((p) =>
      p.documents.setDocumentStatus(stored!.id, 'REVOKED'),
    );
    now = new Date(now.getTime() + 1000);
    const { revenueEventId } = await investors.recordRevenue({
      spv: sponsor,
      resource: RESOURCE,
      amountWeibar: 10n * HBAR,
      source: 'test',
    });
    const result = await investors.computeConfidentialDistribution({
      agent,
      resource: RESOURCE,
      asset: '0x0000000000000000000000000000000000000001',
      revenueEventId,
      investors: [a.did, b.did],
      holdings: new Map([
        [a.did, 600n],
        [b.did, 400n],
      ]),
      holdingsSource: 'test',
    });
    if (result.decision !== 'ALLOW') throw new Error('unexpected DENY');
    const pa = result.plan.holders[0]!;
    expect(pa.controlled).toBe('HOLD');
    expect(pa.reasonCodes).toContain('FAILED_STATUS_ACTIVE');
  });

  it('an investor without an ALLOW offering Decision cannot be issued units', async () => {
    const c = await newInvestor('0x1111111111111111111111111111111111111111');
    await expect(
      investors.authorizeInvestment({ sponsor, offeringId, investor: c.did }),
    ).rejects.toBeInstanceOf(InvestorFlowRefused);
  });

  it('the audit hash chain is valid and records the whole chain', async () => {
    const timeline = await new PrismaUnitOfWork(client).run((p) => p.audit.timeline(TD));
    expect(verifyChain(TD, timeline)).toEqual({ valid: true });
    const types = new Set(timeline.map((e) => e.type));
    for (const t of [
      'RELATIONSHIP_ESTABLISHED',
      'OFFERING_DEFINED',
      'CREDENTIAL_ISSUED',
      'OFFERING_ELIGIBILITY_EVALUATED',
      'INVESTMENT_AUTHORIZED',
      'INVESTMENT_EXECUTED',
      'REVENUE_RECEIVED',
      'DISTRIBUTION_PLAN_CREATED',
    ] as const) {
      expect(types.has(t)).toBe(true);
    }
    // Two Sumsub GETs per confidential run on at most two investors; nothing else was called.
    expect(
      sumsubCalls.every((u) => u.startsWith('https://api.sumsub.com/resources/applicants/')),
    ).toBe(true);
  });
});
