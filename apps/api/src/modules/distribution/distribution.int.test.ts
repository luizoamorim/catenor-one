// Final demo distribution path on real PostgreSQL: ACTIVE Trust Anchor (S001 service) → investors with PRIVATE
// bindings → CREATE DISTRIBUTION AGENT (AGENT subject, execution wallet via the provisioner port, EXECUTE_DISTRIBUTION
// grant) → eligibility-gated plan. Signers, the S001 verifier, the Privy provisioner, the holdings reader and the
// investor verifier are labeled test doubles; the live Privy / CRE / Hedera paths run in `pnpm demo:s001 --distribution`.
import { verifyChain } from '@catenor-one/audit';
import { bootstrapConfigurationHash, parseBootstrapConfiguration } from '@catenor-one/authority';
import { policyHash } from '@catenor-one/policy';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
import { CapabilityGrantRefused } from '../capability-grants/application/grant-capability.js';
import { TrustAnchorAdmissionService } from '../trust-anchor-admission/application/trust-anchor-admission.service.js';
import {
  DistributionService,
  type InvestorEligibilityResult,
  type InvestorVerificationContext,
} from './application/distribution.service.js';

const TD = 'trust-domain:catenor-one-demo';
const RESOURCE = 'spv:catenor-demo-001';
const ASSET = '0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418';
const HBAR = 10n ** 18n;
const ADDRESS = {
  A: '0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78',
  B: '0x72f94a15A815853B488BCf225ec3cb67eC5ba444',
  C: '0x1111111111111111111111111111111111111111',
};
const AGENT_WALLET = '0x5037705014596A9050A51Bc131c9B55Cf98fFC51';

let container: StartedPostgreSqlContainer;
let client: PrismaClient;
const now = new Date('2026-09-12T10:00:00Z');
const clock = { now: () => now };
let admission: TrustAnchorAdmissionService;
let distribution: DistributionService;
let trustAnchor: string;

const provisions: { recipients: readonly string[]; maxPayoutWeibar: bigint }[] = [];
const holdings: Record<string, bigint> = { [ADDRESS.A]: 600n, [ADDRESS.B]: 400n, [ADDRESS.C]: 0n };
/** applicantId → the investor's current provider state as the TEE would report it. */
const providerState: Record<string, 'GREEN' | 'RED' | 'ERROR'> = {};
const verifierRequests: InvestorVerificationContext[] = [];

function teeResult(context: InvestorVerificationContext): InvestorEligibilityResult {
  const state = providerState[context.applicantId];
  const base = {
    v: 1 as const,
    operation: 'INVESTOR_ELIGIBILITY' as const,
    runId: context.runId,
    sessionRef: context.sessionRef,
    mode: 'SIMULATION' as const,
  };
  if (state === 'ERROR') return { ...base, status: 'ERROR', code: 'SUMSUB_HTTP_503' };
  const green = state === 'GREEN';
  return {
    ...base,
    status: 'OK',
    facts: { INVESTOR_IDENTITY_VERIFIED: green, INVESTOR_AML_CLEAR: green, EVIDENCE_FRESH: true },
    ...(green ? {} : { factReasons: { INVESTOR_AML_CLEAR: ['SANCTIONS', 'FINAL'] } }),
    reconciliation: { investor: green ? 'CONSISTENT' : 'MISMATCH' },
    evidenceCommitment: `0x${(green ? 'a' : 'b').repeat(64)}`,
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
  const configuration = pinnedBootstrapConfiguration(
    raw,
    bootstrapConfigurationHash(parseBootstrapConfiguration(raw)),
  );
  const verifier = new FakeConfidentialVerifier(configuration.load());
  admission = new TrustAnchorAdmissionService({
    uow,
    clock,
    ids: nodeIds,
    configuration,
    policy: packagedAdmissionPolicy,
    assertionSigner: signer,
    bootstrapSigner,
    verifier,
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
  await admission.recordConfidentialVerificationResult(verifier.resultFor(runId, 'GREEN'));
  await admission.evaluateAdmission(started.sessionRef);
  await admission.endorseAndActivate(started.sessionRef);
  trustAnchor = started.did;

  distribution = new DistributionService({
    uow,
    clock,
    ids: nodeIds,
    trustDomain: TD,
    assertionSigner: signer,
    verifyTrustAnchor: (did) => admission.verifyTrustAnchor(did),
    provisioner: {
      adapter: 'test-double',
      async provision(input) {
        provisions.push(input);
        return {
          walletRef: 'test-agent-wallet',
          address: AGENT_WALLET,
          policyRef: 'test-agent-policy',
          controls: ['test control'],
        };
      },
    },
    holdings: { balanceOf: async (_asset, holder) => holdings[holder] ?? 0n },
    verifier: {
      mode: 'SIMULATION',
      workflowId: 'test-double',
      async request({ context }) {
        verifierRequests.push(context);
        // Delivered asynchronously through the same result path as the authenticated CRE callback.
        setTimeout(() => void distribution.recordInvestorEligibilityResult(teeResult(context)), 5);
        return { executionId: `TEST:${context.runId}` };
      },
    },
    resultTimeoutMs: 5_000,
  });
}, 240_000);

afterAll(async () => {
  await client?.$disconnect();
  await container?.stop();
});

async function investor(address: string, state: 'GREEN' | 'RED' | 'ERROR') {
  const { did } = await distribution.registerInvestor({ account: address });
  const applicantId = `applicant-${did.slice(-6)}`;
  providerState[applicantId] = state;
  await distribution.attachInvestorApplicant(did, applicantId);
  return did;
}

describe('Distribution Agent + eligibility-gated plan (final demo, [REF-IMPL])', () => {
  let a: string;
  let b: string;
  let agent: Awaited<ReturnType<DistributionService['createDistributionAgent']>>;
  const validUntil = '2026-09-13T10:00:00Z';

  it('CREATE DISTRIBUTION AGENT: AGENT subject, private execution-account binding, narrow wallet, scoped grant', async () => {
    a = await investor(ADDRESS.A, 'GREEN');
    b = await investor(ADDRESS.B, 'RED');
    agent = await distribution.createDistributionAgent({
      issuer: trustAnchor,
      resource: RESOURCE,
      investors: [a, b],
      maxPayoutWeibar: 20n * HBAR,
      validUntil,
    });
    expect(agent.did).toMatch(/^did:catenor:[0-9a-f]{32}$/);
    const subject = await client.subject.findUnique({ where: { did: agent.did } });
    expect(subject?.type).toBe('AGENT');
    const binding = await client.accountBinding.findFirst({ where: { subjectId: subject!.id } });
    expect(binding).toMatchObject({
      purpose: 'AGENT_EXECUTION',
      account: `eip155:296:${AGENT_WALLET}`,
    });
    // The wallet policy may only pay this SPV asset's investors, up to the cap.
    expect(provisions).toEqual([
      { ...provisions[0], recipients: [ADDRESS.A, ADDRESS.B], maxPayoutWeibar: 20n * HBAR },
    ]);
    expect(agent.grant.capability).toEqual({
      subject: agent.did,
      action: 'EXECUTE_DISTRIBUTION',
      resource: RESOURCE,
      constraints: { validUntil },
    });
    expect(agent.grant.issuer).toBe(trustAnchor);
  });

  it('only an ACTIVE Trust Anchor can grant EXECUTE_DISTRIBUTION', async () => {
    await expect(
      distribution.createDistributionAgent({
        issuer: a,
        resource: RESOURCE,
        investors: [a, b],
        maxPayoutWeibar: 20n * HBAR,
        validUntil,
      }),
    ).rejects.toBeInstanceOf(CapabilityGrantRefused);
  });

  it('A holds and is currently eligible → PAY; B holds 400 but is currently RED → HOLD (ownership ≠ eligibility)', async () => {
    const plan = await distribution.planDistribution({
      agent: agent.did,
      grant: agent.grant,
      resource: RESOURCE,
      asset: ASSET,
      revenueWeibar: 10n * HBAR,
      investors: [a, b],
    });
    expect(plan.decision).toBe('ALLOW');
    if (plan.decision !== 'ALLOW') return;
    expect(plan.blind).toEqual([
      { investor: a, proposedWeibar: 6n * HBAR },
      { investor: b, proposedWeibar: 4n * HBAR },
    ]);
    const [holderA, holderB] = plan.holders;
    expect(holderA).toMatchObject({ units: 600n, controlled: 'PAY' });
    expect(holderA!.eligibility.outcome).toBe('ALLOW');
    expect(holderB).toMatchObject({ units: 400n, controlled: 'HOLD' });
    expect(holderB!.eligibility.failed).toEqual([
      'INVESTOR_IDENTITY_VERIFIED',
      'INVESTOR_AML_CLEAR',
    ]);
    expect(plan.payWeibar).toBe(6n * HBAR);
    expect(plan.heldWeibar).toBe(4n * HBAR);
    // The confidential check received each investor's private refs, sealed — never the receiving account.
    expect(JSON.stringify(verifierRequests)).not.toContain(ADDRESS.A);
  });

  it('a requester other than the Agent is DENIED before any confidential check', async () => {
    const before = verifierRequests.length;
    const plan = await distribution.planDistribution({
      agent: a,
      grant: agent.grant,
      resource: RESOURCE,
      asset: ASSET,
      revenueWeibar: 10n * HBAR,
      investors: [a, b],
    });
    expect(plan).toEqual({ decision: 'DENY', reasons: ['SUBJECT_MISMATCH'] });
    expect(verifierRequests.length).toBe(before);
  });

  it('a failed confidential check leaves the facts MISSING → DENY/HOLD; a non-holder is HOLD even if eligible', async () => {
    const c = await investor(ADDRESS.C, 'GREEN');
    const e = await investor(ADDRESS.A, 'ERROR');
    const plan = await distribution.planDistribution({
      agent: agent.did,
      grant: agent.grant,
      resource: RESOURCE,
      asset: ASSET,
      revenueWeibar: 10n * HBAR,
      investors: [c, e],
    });
    if (plan.decision !== 'ALLOW') throw new Error('expected an authorized plan');
    const [holderC, holderE] = plan.holders;
    expect(holderC).toMatchObject({ controlled: 'HOLD' });
    expect(holderC!.eligibility.failed).toEqual(['HOLDS_ASSET']);
    expect(holderE!.confidentialRun).toMatchObject({ status: 'ERROR', code: 'SUMSUB_HTTP_503' });
    expect(
      holderE!.eligibility.trace.filter((t) => t.status === 'MISSING').map((t) => t.requirement),
    ).toEqual(['INVESTOR_IDENTITY_VERIFIED', 'INVESTOR_AML_CLEAR', 'EVIDENCE_FRESH']);
    expect(holderE).toMatchObject({ controlled: 'HOLD' });
  });

  it('audit chain is valid and never carries receiving accounts (Account Bindings stay private)', async () => {
    const timeline = await new PrismaUnitOfWork(client).run((p) => p.audit.timeline(TD));
    expect(verifyChain(TD, timeline).valid).toBe(true);
    const types = timeline.map((e) => e.type);
    for (const t of [
      'ACCOUNT_BINDING_CREATED',
      'AGENT_EXECUTION_WALLET_PROVISIONED',
      'DISTRIBUTION_REQUEST_DENIED',
      'DISTRIBUTION_ELIGIBILITY_EVALUATED',
      'DISTRIBUTION_PLAN_CREATED',
    ]) {
      expect(types).toContain(t);
    }
    const details = JSON.stringify(timeline.map((e) => e.details ?? {}));
    expect(details).not.toContain(ADDRESS.A);
    expect(details).not.toContain(ADDRESS.B);
    expect(details).toContain('"executed":false');
  });
});
