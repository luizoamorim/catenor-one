// Catenor One — ETHOnline demo run: S001 Trust Anchor Admission (+ Part B when configured). Operator-initiated
// (the Privy-verified bootstrap gate, AC-001–003, is NOT implemented — never present this as production access
// control). Every step is labeled by what really ran:
//
//   REAL        Privy development app signers · Sumsub SANDBOX representative (synthetic applicant) · PostgreSQL
//   SIMULATION  Chainlink CRE confidential workflow via `cre workflow simulate` (deployment gated by B1)
//   MOCK        company / KYB evidence (SYNTHETIC MOCK fixture — Sumsub company KYB is not entitled, B11)
//
// Part B (after an ALLOW, only when apps/api/.env has the PRIVY_SPV_* values): the ACTIVE Trust Anchor grants Org B
// the [REF-IMPL] TOKENIZE_ASSET capability on spv:catenor-demo-001 (REAL Privy signature); DENY requests leave the SPV
// wallet nonce unchanged (no transaction); the exact deployEquity for Org B's grant is prepared READ-ONLY. Only with
// --hedera-live (explicit maintainer authorization) does Org B's valid request → exactly ONE REAL Hedera ATS testnet
// `deployEquity`, signed by the Privy-managed SPV wallet under its Privy policy (≈ 9 HBAR). No raw operator key.
//
// Part C (final demo, --distribution; needs PRIVY_AGENT_OWNER_PUBLIC_KEY / PRIVY_AGENT_RUNTIME_QUORUM_ID): pre-seeded
// investors (REAL Sumsub sandbox, A GREEN / B RED) → CREATE DISTRIBUTION AGENT (live Privy wallet + narrow policy,
// EXECUTE_DISTRIBUTION grant) → blind DRY RUN vs controlled plan (CRE SIMULATION per holder). Nothing is paid.
//
// Run: pnpm demo:s001 [--representative GREEN|RED] [--hedera-live] [--distribution]
// Needs: Docker (or DATABASE_URL), the CRE CLI + `bun install` in the workflow, apps/api/.env with the Privy values,
// workflows/.env with SUMSUB_APP_TOKEN_VAR / SUMSUB_SECRET_KEY_VAR (sandbox) and CATENOR_INTERNAL_API_TOKEN_VAR.
// Secret values are read by this process only and never printed. Output: artifacts/demo/s001-run-<time>.json
// (sanitized: no applicant IDs, bindingRefs, wallet IDs or keys).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { verifyChain } from '@catenor-one/audit';
import { bootstrapConfigurationHash, parseBootstrapConfiguration } from '@catenor-one/authority';
import { policyHash } from '@catenor-one/policy';
import { PrivyClient } from '@privy-io/node';
import { JsonRpcProvider, formatEther, getAddress, keccak256 } from 'ethers';
import { startCallbackReceiver } from '../../src/infrastructure/confidential-compute/cre-callback-receiver.js';
import { deriveChannelKeys } from '../../src/infrastructure/confidential-compute/cre-channel.js';
import { CreSimulationConfidentialVerifier } from '../../src/infrastructure/confidential-compute/cre-simulation-verifier.js';
import { PrivySpvAtsExecutor } from '../../src/infrastructure/execution/privy-spv-ats-executor.js';
import { SumsubSandboxOperator } from '../../src/infrastructure/identity-providers/sumsub-sandbox.js';
import { selectSigners } from '../../src/infrastructure/key-management/signer-selection.js';
import {
  PrismaUnitOfWork,
  createPrismaClient,
} from '../../src/infrastructure/persistence/prisma/prisma-persistence.js';
import {
  nodeIds,
  packagedAdmissionPolicy,
  pinnedBootstrapConfiguration,
  systemClock,
} from '../../src/infrastructure/runtime/runtime-adapters.js';
import { AssetTokenizationService } from '../../src/modules/asset-tokenization/application/asset-tokenization.service.js';
import {
  DistributionService,
  type InvestorEligibilityResult,
} from '../../src/modules/distribution/application/distribution.service.js';
import { HEDERA_TESTNET } from '../../src/infrastructure/execution/hedera-ats-executor.js';
import { HederaAtsHoldingsReader } from '../../src/infrastructure/execution/hedera-ats-holdings.js';
import {
  PayoutRefused,
  PrivyAgentPayoutExecutor,
} from '../../src/infrastructure/execution/privy-agent-payout-executor.js';
import {
  privyEvmSigningApi,
  type PrivyEvmSigningApi,
} from '../../src/infrastructure/execution/privy-spv-ats-executor.js';
import { PrivyDistributionAgentProvisioner } from '../../src/infrastructure/key-management/privy-distribution-agent.js';
import { DEMO_INVESTORS, REHEARSAL_EQUITY } from './final-demo-config.js';
import { TrustAnchorAdmissionService } from '../../src/modules/trust-anchor-admission/application/trust-anchor-admission.service.js';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const WORKFLOWS = `${ROOT}workflows/`;
const API_ENV = `${ROOT}apps/api/.env`;
const WORKFLOW_ENV = `${WORKFLOWS}.env`;
const TD = 'trust-domain:catenor-one-demo';
const representativeAnswer = process.argv.includes('RED') ? 'RED' : 'GREEN';
const hederaLive = process.argv.includes('--hedera-live');
const runDistribution = process.argv.includes('--distribution');
// Broadcasts the Agent payouts of PAY holders (maintainer-authorized only); without it the payout is dry-signed.
const agentPayoutLive = process.argv.includes('--agent-payout-live');
// Explicit, maintainer-authorized payout gas limit (default 30,000); e.g. --payout-gas-limit=700000.
const payoutGasLimit = Number(
  (process.argv.find((arg) => arg.startsWith('--payout-gas-limit=')) ?? '=30000').split('=')[1],
);
const RESOURCE = 'spv:catenor-demo-001';
const HBAR = 10n ** 18n; // Hedera JSON-RPC weibar

const steps: { step: string; label: 'REAL' | 'SIMULATION' | 'MOCK' | 'LOCAL'; result: unknown }[] =
  [];
const say = (step: string, label: (typeof steps)[number]['label'], result: unknown) => {
  steps.push({ step, label, result });
  console.log(
    `[${label.padEnd(10)}] ${step}: ${typeof result === 'string' ? result : JSON.stringify(result)}`,
  );
};

function envValue(file: string, name: string): string {
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  return line
    ? line
        .slice(name.length + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
    : '';
}

function blocked(message: string): never {
  console.error(`BLOCKED: ${message}`);
  process.exit(2);
}

if (!existsSync(WORKFLOW_ENV)) {
  blocked('workflows/.env is missing (Sumsub sandbox values — maintainer action)');
}
if (existsSync(API_ENV)) process.loadEnvFile(API_ENV);
const signers = selectSigners();
if (signers.kind !== 'PRIVY') blocked('Privy signer values are missing from apps/api/.env (T0.4)');
const sumsub = {
  appToken: envValue(WORKFLOW_ENV, 'SUMSUB_APP_TOKEN_VAR'),
  secretKey: envValue(WORKFLOW_ENV, 'SUMSUB_SECRET_KEY_VAR'),
};
const channelToken = envValue(WORKFLOW_ENV, 'CATENOR_INTERNAL_API_TOKEN_VAR');
if (!sumsub.appToken || !sumsub.secretKey || !channelToken) {
  blocked(
    'workflows/.env needs SUMSUB_APP_TOKEN_VAR, SUMSUB_SECRET_KEY_VAR and CATENOR_INTERNAL_API_TOKEN_VAR',
  );
}
const operator = new SumsubSandboxOperator(sumsub); // refuses non-sandbox tokens
// Part B runs only when the Privy SPV wallet is configured; it broadcasts only with --hedera-live.
const hedera = PrivySpvAtsExecutor.fromEnv(
  new PrivyClient({
    appId: process.env['PRIVY_APP_ID'] ?? '',
    appSecret: process.env['PRIVY_APP_SECRET'] ?? '',
  }),
);

// Database: DATABASE_URL, or a throwaway Testcontainers PostgreSQL with the migrations deployed.
let databaseUrl = process.env['DATABASE_URL'] ?? '';
let stopDatabase = async () => {};
if (!databaseUrl) {
  const { startPostgres, prisma } =
    await import('../../src/infrastructure/persistence/prisma/postgres.test-fixtures.js');
  const container = await startPostgres();
  databaseUrl = container.getConnectionUri();
  const deploy = await prisma(databaseUrl, ['migrate', 'deploy']);
  if (deploy.code !== 0) blocked('prisma migrate deploy failed');
  stopDatabase = async () => void (await container.stop());
  say('database', 'LOCAL', 'throwaway PostgreSQL (Testcontainers), migrations deployed');
}
const client = createPrismaClient(databaseUrl);
const keys = deriveChannelKeys(channelToken);

const raw = {
  type: 'CatenorTrustDomainBootstrapConfiguration',
  profile: 'catenor-one/bootstrap-configuration/v1',
  trustDomain: TD,
  admissionPolicy: 'policy:trust-anchor-admission:v1',
  admissionPolicyHash: policyHash(packagedAdmissionPolicy.load()),
  bootstrapVerificationMethod: 'bootstrap-verification-method:1',
  bootstrapPublicKeyMultibase: await signers.bootstrapSigner.publicKeyMultibase(),
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
const hash = bootstrapConfigurationHash(parseBootstrapConfiguration(raw));
const configuration = pinnedBootstrapConfiguration(raw, hash);
say('bootstrap configuration', 'LOCAL', { hash, evidenceProfile: 'HYBRID_DEMO' });

const deliveries: { accepted: boolean; reason?: string; runId?: string }[] = [];
// The receiver is created before the service it delivers to (the verifier needs the receiver URL).
const wiring: { service?: TrustAnchorAdmissionService; distribution?: DistributionService } = {};
const receiver = await startCallbackReceiver({
  port: 8787,
  keys,
  now: () => new Date(),
  // One authenticated callback path for both identity-confidential operations; routed by the signed envelope.
  deliver: (result) =>
    (result as { operation: string }).operation === 'INVESTOR_ELIGIBILITY'
      ? wiring.distribution!.recordInvestorEligibilityResult(
          result as unknown as InvestorEligibilityResult,
        )
      : wiring.service!.recordConfidentialVerificationResult(result),
  onEvent: (e) => deliveries.push(e),
});
const verifier = new CreSimulationConfidentialVerifier({
  keys,
  projectRoot: WORKFLOWS,
  workflowFolder: 'identity-confidential',
  target: 'staging-settings',
  envFile: WORKFLOW_ENV,
  limitsFile: `${WORKFLOWS}identity-confidential/test/limits.production-like.json`,
  creBinary: process.env['CRE_BIN'] ?? `${homedir()}/.cre/bin/cre`,
  workflowConfig: {
    callbackUrl: receiver.url,
    sumsubBaseUrl: 'https://api.sumsub.com',
    httpRequestTimeout: '8s',
    executionMode: 'SIMULATION',
    companyEvidence: {
      source: 'SYNTHETIC_MOCK',
      scenario: 'MOCK_COMPANY_ACTIVE_GREEN',
      label: 'MOCK — not Sumsub KYB',
    },
    bootstrapConfigurationHash: hash,
    acceptedEvidence: configuration.load().config.acceptedEvidence,
    // [REF-IMPL] final demo: individual-investor evidence rules for INVESTOR_ELIGIBILITY.
    investorEvidence: { levelNames: ['id-only'], evidenceMaxAgeDays: 180 },
    authorizedTriggerAddress: '0x0000000000000000000000000000000000000000',
    authorizedKeys: [
      { type: 'KEY_TYPE_ECDSA_EVM', publicKey: '0x0000000000000000000000000000000000000000' },
    ],
  },
});
const service = new TrustAnchorAdmissionService({
  uow: new PrismaUnitOfWork(client),
  clock: systemClock,
  ids: nodeIds,
  configuration,
  policy: packagedAdmissionPolicy,
  assertionSigner: signers.assertionSigner,
  bootstrapSigner: signers.bootstrapSigner,
  verifier,
});
wiring.service = service;

/** Part B: Trust Anchor → scoped capability → DENY (no transaction) → ALLOW (one Hedera ATS testnet transaction). */
async function runPartB(trustAnchor: string, executor: PrivySpvAtsExecutor) {
  const tokenization = new AssetTokenizationService({
    uow: new PrismaUnitOfWork(client),
    clock: systemClock,
    ids: nodeIds,
    trustDomain: TD,
    assertionSigner: signers.assertionSigner,
    verifyTrustAnchor: (did) => service.verifyTrustAnchor(did),
    executor,
  });
  await executor.assertTestnet();
  const orgB = await tokenization.registerOrganization();
  const orgC = await tokenization.registerOrganization();
  say('Part B organizations', 'LOCAL', { orgB: orgB.did, orgC: orgC.did, trustAnchor: false });

  const grant = await tokenization.grantTokenizationCapability({
    issuer: trustAnchor,
    subject: orgB.did,
    resource: RESOURCE,
    validUntil: new Date(Date.now() + 24 * 3600_000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  });
  say('Part B capability grant [REF-IMPL]', 'REAL', {
    issuer: 'the ACTIVE Trust Anchor',
    capability: grant.capability,
    proof: `${grant.proof.cryptosuite} via the Trust Anchor's Privy Credential Assertion Key`,
  });

  const nonceBefore = await executor.operatorNonce();
  const denials = [
    await tokenization.requestTokenization({ requester: orgC.did, resource: RESOURCE, grant }),
    await tokenization.requestTokenization({
      requester: orgB.did,
      resource: 'spv:catenor-demo-002',
      grant: {
        ...grant,
        capability: { ...grant.capability, resource: 'spv:catenor-demo-002' },
      },
    }),
  ];
  const nonceAfterDeny = await executor.operatorNonce();
  say('Part B DENY (Org C with Org B grant; tampered resource) + SPV wallet nonce read', 'REAL', {
    decisions: denials,
    spvWalletNonce: { before: nonceBefore, after: nonceAfterDeny },
    hederaTransactions: nonceAfterDeny - nonceBefore,
  });
  if (nonceAfterDeny !== nonceBefore) throw new Error('a DENY reached Hedera');

  const prepared = await executor.prepareDeployEquity({ resource: RESOURCE, grantId: grant.id });
  say('Part B exact deployEquity for this grant (READ-ONLY eth_call + estimateGas)', 'REAL', {
    from: `${prepared.from} (Privy SPV wallet)`,
    to: `${prepared.transaction.to} (ATS Factory)`,
    chainId: prepared.transaction.chain_id,
    estimatedGas: String(prepared.estimatedGas),
    gasLimit: prepared.transaction.gas_limit,
    maxHbar: formatEther(prepared.maxCostWeibar),
    calldataKeccak256: keccak256(prepared.transaction.data),
  });
  if (!hederaLive) {
    say(
      'Part B ALLOW → Hedera',
      'LOCAL',
      'NOT BROADCAST — requires --hedera-live (maintainer authorization)',
    );
    return;
  }

  const allowed = await tokenization.requestTokenization({
    requester: orgB.did,
    resource: RESOURCE,
    grant,
  });
  say('Part B ALLOW → Hedera ATS testnet deployEquity (Privy SPV wallet)', 'REAL', {
    ...allowed,
    hederaTransactions: (await executor.operatorNonce()) - nonceAfterDeny,
  });
}

/**
 * Part C (final demo, --distribution): pre-seeded investors (REAL Sumsub sandbox: A current review GREEN, B RED) →
 * CREATE DISTRIBUTION AGENT (live: AGENT did, Privy wallet + narrow policy, EXECUTE_DISTRIBUTION grant) → a wrong
 * requester is DENIED → SPV REVENUE RECEIVED → BLIND plan (DRY RUN) vs CONTROLLED plan (CRE SIMULATION per holder
 * → policy:distribution-eligibility:v1). Nothing is paid: Hedera execution is a later, separately authorized step.
 */
async function runPartC(trustAnchor: string) {
  const privy = new PrivyClient({
    appId: process.env['PRIVY_APP_ID'] ?? '',
    appSecret: process.env['PRIVY_APP_SECRET'] ?? '',
  });
  const provisioner = PrivyDistributionAgentProvisioner.fromEnv(privy);
  if (!provisioner) {
    say(
      'Part C',
      'LOCAL',
      'skipped — PRIVY_AGENT_OWNER_PUBLIC_KEY / PRIVY_AGENT_RUNTIME_QUORUM_ID not configured',
    );
    return;
  }
  const distribution = new DistributionService({
    uow: new PrismaUnitOfWork(client),
    clock: systemClock,
    ids: nodeIds,
    trustDomain: TD,
    assertionSigner: signers.assertionSigner,
    verifyTrustAnchor: (did) => service.verifyTrustAnchor(did),
    provisioner,
    holdings: new HederaAtsHoldingsReader(),
    verifier,
    resultTimeoutMs: 300_000,
  });
  wiring.distribution = distribution;

  // Pre-seeded state (not a live demo action): investor Subjects with PRIVATE bindings + current provider evidence.
  const investors = [] as { label: 'A' | 'B'; did: string; answer: 'GREEN' | 'RED' }[];
  for (const [label, answer] of [
    ['A', 'GREEN'],
    ['B', 'RED'],
  ] as const) {
    const wallet = DEMO_INVESTORS[label];
    const { did, bindingRef } = await distribution.registerInvestor({ account: wallet.address });
    const applicantId = await operator.createInvestorApplicant(bindingRef, label);
    await operator.forceReview(applicantId, answer);
    await distribution.attachInvestorApplicant(did, applicantId);
    investors.push({ label, did, answer });
  }
  say('Part C pre-seeded investors', 'REAL', {
    investors: investors.map((i) => ({
      investor: `Investor ${i.label}`,
      did: i.did,
      receivingAccount: 'private Account Binding (not published)',
      sumsubSandboxCurrentReview: i.answer,
    })),
  });

  const agent = await distribution.createDistributionAgent({
    issuer: trustAnchor,
    resource: RESOURCE,
    investors: investors.map((i) => i.did),
    maxPayoutWeibar: 20n * HBAR,
    validUntil: new Date(Date.now() + 24 * 3600_000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  });
  say('CREATE DISTRIBUTION AGENT (live)', 'REAL', {
    agentDid: agent.did,
    privyAgentWallet: agent.wallet.address,
    privyAgentPolicyControls: agent.wallet.controls,
    capability: agent.grant.capability,
    issuer: 'the ACTIVE Trust Anchor',
    proof: `${agent.grant.proof.cryptosuite} via the Trust Anchor's Privy Credential Assertion Key`,
  });

  const wrongRequester = await distribution.planDistribution({
    agent: investors[0]!.did,
    grant: agent.grant,
    resource: RESOURCE,
    asset: REHEARSAL_EQUITY,
    revenueWeibar: 10n * HBAR,
    investors: investors.map((i) => i.did),
  });
  say('Part C DENY (Investor A presents the Agent grant)', 'LOCAL', wrongRequester);

  const revenueWeibar = 10n * HBAR;
  say('SPV REVENUE RECEIVED (simulated trigger)', 'LOCAL', {
    resource: RESOURCE,
    revenueHbar: formatEther(revenueWeibar),
    source: 'demo trigger — in production a PMS, bank webhook, schedule or reconciliation event',
  });
  const plan = await distribution.planDistribution({
    agent: agent.did,
    grant: agent.grant,
    resource: RESOURCE,
    asset: REHEARSAL_EQUITY,
    revenueWeibar,
    investors: investors.map((i) => i.did),
  });
  if (plan.decision === 'DENY') {
    say('CONTROLLED DISTRIBUTION', 'LOCAL', plan);
    return;
  }
  const label = (did: string) => `Investor ${investors.find((i) => i.did === did)!.label}`;
  say('BLIND DISTRIBUTION (DRY RUN — holdings only, nothing sent)', 'LOCAL', {
    asset: `${REHEARSAL_EQUITY} (Hedera testnet, READ-ONLY balances)`,
    proposed: plan.blind.map((b) => ({
      investor: label(b.investor),
      hbar: formatEther(b.proposedWeibar),
    })),
  });
  say('CONTROLLED DISTRIBUTION (Catenor + CRE SIMULATION)', 'SIMULATION', {
    planRef: plan.planRef,
    holders: plan.holders.map((h) => ({
      investor: label(h.investor),
      units: String(h.units),
      proposedHbar: formatEther(h.proposedWeibar),
      confidentialRun: h.confidentialRun,
      policy: h.eligibility.policy,
      decision: h.eligibility.outcome,
      trace: h.eligibility.trace.map((t) => `${t.requirement}=${t.status}`),
      factReasons: h.factReasons ?? {},
      decisionCommitment: h.decisionCommitment,
      controlled: h.controlled,
    })),
    payHbar: formatEther(plan.payWeibar),
    heldHbar: formatEther(plan.heldWeibar),
    executed: false,
  });

  // Agent payout: only PAY holders reach the payout signer; every Privy signature request is recorded.
  const runtimeKey = process.env['CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY'] ?? '';
  if (!runtimeKey) {
    say(
      'AGENT PAYOUT',
      'LOCAL',
      'skipped — CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY not configured',
    );
    return;
  }
  const signatureRequests: string[] = [];
  const privyApi = privyEvmSigningApi(privy);
  const recordingApi: PrivyEvmSigningApi = {
    walletAddress: (id) => privyApi.walletAddress(id),
    signTransaction: (id, tx, key) => {
      signatureRequests.push(getAddress(tx.to));
      return privyApi.signTransaction(id, tx, key);
    },
  };
  const payout = new PrivyAgentPayoutExecutor(
    recordingApi,
    {
      walletId: agent.wallet.walletRef,
      walletAddress: agent.wallet.address,
      runtimeAuthorizationKey: runtimeKey,
    },
    undefined,
    payoutGasLimit,
  );
  const reader = new HederaAtsHoldingsReader();
  const balances = async () => ({
    agent: await reader.nativeBalance(agent.wallet.address),
    investorA: await reader.nativeBalance(DEMO_INVESTORS.A.address),
    investorB: await reader.nativeBalance(DEMO_INVESTORS.B.address),
  });
  const before = await balances();
  const nonceBefore = await payout.nonce();
  const payouts = [];
  const readyToExecute: Awaited<ReturnType<typeof payout.prepare>>[] = [];
  for (const h of plan.holders) {
    const approval = await distribution.approvedPayout(plan, h.investor);
    if (approval.controlled !== 'PAY') {
      payouts.push({
        investor: label(h.investor),
        controlled: approval.controlled,
        transactionConstructed: false,
        privySignatureRequested: false,
      });
      continue;
    }
    let prepared;
    try {
      prepared = await payout.prepare(approval, {
        recipient: approval.boundAccount,
        amountWeibar: approval.approvedWeibar,
      });
    } catch (e) {
      // Fail closed: a refused payout never reaches Privy.
      payouts.push({
        investor: label(h.investor),
        controlled: approval.controlled,
        refused: e instanceof PayoutRefused ? e.code : 'ERROR',
        privySignatureRequested: false,
      });
      continue;
    }
    const common = {
      investor: label(h.investor),
      controlled: approval.controlled,
      to: prepared.transaction.to,
      amountHbar: formatEther(approval.approvedWeibar),
      data: prepared.transaction.data,
      chainId: prepared.transaction.chain_id,
      nonce: prepared.transaction.nonce,
      estimatedGas: String(prepared.estimatedGas),
      gasLimit: prepared.transaction.gas_limit,
      maxCostHbar: formatEther(prepared.maxCostWeibar),
    };
    if (agentPayoutLive) {
      readyToExecute.push(prepared);
      payouts.push({ ...common, status: 'PREPARED FOR THE AUTHORIZED BROADCAST' });
    } else {
      const { recoveredFrom } = await payout.sign(prepared); // dry signature, discarded
      payouts.push({
        ...common,
        privyDrySignature: 'SIGNED (discarded, not broadcast)',
        recoveredFrom,
      });
    }
  }
  let executed: Awaited<ReturnType<typeof payout.execute>> | undefined;
  if (agentPayoutLive) {
    // The maintainer authorized exactly ONE payout: 6 HBAR to Investor A's bound account, empty calldata.
    const only = readyToExecute[0];
    if (
      readyToExecute.length !== 1 ||
      !only ||
      only.transaction.to !== getAddress(DEMO_INVESTORS.A.address) ||
      only.approval.approvedWeibar !== 6n * HBAR ||
      only.transaction.data !== '0x'
    ) {
      say('AGENT PAYOUT (LIVE)', 'LOCAL', {
        refused: 'the live plan does not yield exactly the authorized payout — nothing broadcast',
        payouts,
      });
      return;
    }
    executed = await payout.execute(only); // exactly one broadcast, no retry
  }
  const after = await balances();
  // The relay can serve a stale nonce right after a receipt (observed in CP13): poll READ-ONLY, bounded.
  let nonceAfter = await payout.nonce();
  for (let i = 0; executed && nonceAfter === nonceBefore && i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    nonceAfter = await payout.nonce();
  }
  if (executed) {
    const mirror = (await (
      await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${executed.transactionId}`,
      )
    ).json()) as Record<string, unknown>;
    const receipt = await new JsonRpcProvider(HEDERA_TESTNET.rpcUrl).getTransactionReceipt(
      executed.transactionId,
    );
    const gasPrice = receipt?.gasPrice ?? 0n;
    say('AGENT PAYOUT (LIVE) — verification', 'REAL', {
      transaction: executed.transactionId,
      hashscan: executed.explorerUrl,
      receiptStatus: receipt?.status === 1 ? 'SUCCESS' : String(receipt?.status),
      gasUsed: String(executed.gasUsed),
      gasFeeHbar: formatEther(executed.gasUsed * gasPrice),
      mirrorNode: { result: mirror['result'], timestamp: mirror['timestamp'] },
      agentHbar: { before: formatEther(before.agent), after: formatEther(after.agent) },
      investorAHbar: { before: formatEther(before.investorA), after: formatEther(after.investorA) },
      investorBHbar: { before: formatEther(before.investorB), after: formatEther(after.investorB) },
      agentNonce: { before: nonceBefore, after: nonceAfter },
      checks: {
        agentNonceIncrementedByOne: nonceAfter === nonceBefore + 1,
        investorAReceivedExactly6Hbar: after.investorA - before.investorA === 6n * HBAR,
        investorBUnchanged: after.investorB === before.investorB,
        agentPaid6HbarPlusGas:
          before.agent - after.agent === 6n * HBAR + executed.gasUsed * gasPrice,
        zeroSignatureRequestsForInvestorB: !signatureRequests.includes(
          getAddress(DEMO_INVESTORS.B.address),
        ),
        mirrorNodeSuccess: mirror['result'] === 'SUCCESS',
      },
    });
  }
  say(
    agentPayoutLive
      ? 'AGENT PAYOUT (LIVE)'
      : 'AGENT PAYOUT PREFLIGHT (Privy dry signature; NOTHING BROADCAST)',
    'REAL',
    {
      agentWallet: agent.wallet.address,
      agentWalletProvisioning: agent.wallet.provisioning ?? 'CREATED_LIVE',
      agentBalanceHbar: formatEther(
        await new HederaAtsHoldingsReader().nativeBalance(agent.wallet.address),
      ),
      payouts,
      privySignatureRequestsTo: signatureRequests,
      agentNonce: { before: nonceBefore, after: nonceAfter },
    },
  );
}

try {
  const started = await service.startInitialAdmission({
    operatorRef: 'operator-ref:maintainer-demo',
  });
  say('U2 candidate organization', 'LOCAL', { did: started.did });

  const applicantId = await operator.createRepresentative(
    started.providerSetup.representativeBindingRef,
  );
  await operator.forceReview(applicantId, representativeAnswer);
  say(
    'operator onboarding',
    'REAL',
    `Sumsub SANDBOX representative created with externalUserId = bindingRef; review forced ${representativeAnswer} (synthetic applicant)`,
  );

  await service.attachProviderReferences(started.sessionRef, {
    companyApplicantId: 'mock:company-fixture:MOCK_COMPANY_ACTIVE_GREEN',
    representativeApplicantId: applicantId,
  });
  say(
    'U3 provider references',
    'MOCK',
    'company = SYNTHETIC MOCK fixture reference; representative = REAL Sumsub sandbox applicant',
  );

  const key = await service.provisionAssertionKey(started.sessionRef);
  say('U4 Credential Assertion Key', 'REAL', {
    verificationMethod: key.verificationMethod.id,
    signer: 'Privy Solana Ed25519 wallet (dev app)',
  });

  await service.issueKeyPossessionChallenge(started.sessionRef);
  const proof = await service.proveKeyPossessionWithSecureSigner(started.sessionRef);
  say('U5/U6 proof of key possession', 'REAL', {
    possessionValid: proof.possessionValid,
    purposeValid: proof.purposeValid,
    cryptosuite: 'eddsa-jcs-2022 via Privy signMessage',
  });

  const { runId } = await service.requestConfidentialVerification(started.sessionRef);
  const outcome = await verifier.completion(runId);
  const delivery = deliveries.find((d) => d.runId === runId);
  say('U7/U8 confidential verification', 'SIMULATION', {
    handler: outcome.handlerResult ?? 'no result',
    callback: delivery ?? 'not delivered',
  });

  const run = await client.confidentialVerificationRun.findUnique({ where: { runId } });
  say('facts + reconciliation', 'SIMULATION', {
    status: run?.status,
    facts: run?.facts,
    reconciliation: (run?.commitmentInputs as { reconciliation?: unknown } | null)?.reconciliation,
    evidenceCommitment: run?.evidenceCommitment,
  });

  const decision = await service.evaluateAdmission(started.sessionRef);
  say('U9 policy:trust-anchor-admission:v1', 'LOCAL', decision);

  if (decision.outcome === 'ALLOW') {
    const { record } = await service.endorseAndActivate(started.sessionRef);
    say('U10 bootstrap endorsement + activation', 'REAL', {
      signer: 'separate Privy Bootstrap Endorsement Key wallet',
      trustAnchor: record.trustAnchor,
      status: 'ACTIVE (operational projection)',
    });
    const verification = await service.verifyTrustAnchor(started.did);
    say('U13 Trust Anchor verification', 'LOCAL', {
      TRUST_ANCHOR_VALID: verification.TRUST_ANCHOR_VALID,
      failedChecks: verification.checks.filter((c) => !c.passed).map((c) => c.id),
    });

    if (hedera === undefined) {
      say('Part B', 'LOCAL', 'skipped — the Privy SPV wallet (PRIVY_SPV_*) is not configured');
    } else {
      await runPartB(started.did, hedera);
    }
    if (runDistribution) await runPartC(started.did);
  }

  const timeline = await new PrismaUnitOfWork(client).run((p) => p.audit.timeline(TD));
  say('audit chain', 'LOCAL', {
    events: timeline.map((e) => e.type),
    chain: verifyChain(TD, timeline),
  });
} finally {
  const out = `${ROOT}artifacts/demo/`;
  mkdirSync(out, { recursive: true });
  const file = `${out}s001-run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        demo: 'Catenor One — S001 Trust Anchor Admission',
        profile:
          'HYBRID_DEMO — Company evidence: SYNTHETIC MOCK · Representative verification: REAL SUMSUB SANDBOX',
        cre: 'SIMULATION (cre workflow simulate) — not a deployed Confidential Workflow',
        hedera: !hedera
          ? 'Part B not run (no Privy SPV wallet configured)'
          : hederaLive
            ? 'Part B: REAL Hedera ATS testnet (chain 296), signed by the Privy SPV wallet, executed only after a Catenor ALLOW'
            : 'Part B: prepared READ-ONLY; not broadcast (no --hedera-live)',
        access:
          'maintainer/operator-initiated; the bootstrap access gate (AC-001–003) is not implemented',
        steps,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nRun record: ${file}`);
  verifier.dispose();
  await receiver.close();
  await client.$disconnect();
  await stopDatabase();
}
