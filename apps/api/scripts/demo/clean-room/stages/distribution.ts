// 70 Agent · 71 Sponsor → Agent relationship · 72 delegated EXECUTE_DISTRIBUTION · 80 Investor B state change ·
// 81 revenue · 82 CONFIDENTIAL distribution (computed inside CRE) · 83 execution of the approved plan (Agent, Privy).
import {
  EXECUTE_DISTRIBUTION,
  RELATIONSHIP_PREDICATES,
  TOKENIZE_ASSET,
} from '@catenor-one/authority';
import { formatEther, getAddress } from 'ethers';
import {
  PayoutRefused,
  PrivyAgentPayoutExecutor,
} from '../../../../src/infrastructure/execution/privy-agent-payout-executor.js';
import {
  privyEvmSigningApi,
  type PrivyEvmSigningApi,
} from '../../../../src/infrastructure/execution/privy-spv-ats-executor.js';
import { HederaAtsHoldingsReader } from '../../../../src/infrastructure/execution/hedera-ats-holdings.js';
import { SponsorActionRefused } from '../../../../src/modules/sponsor-authorization/application/sponsor-authorization.service.js';
import { HBAR, RESOURCE, inDays } from '../context.js';
import { provisionSigner } from '../privy-infra.js';
import { confirmLive, say, type Stage } from '../stage.js';
import { env, need, setState } from '../state.js';
import { atsHoldings } from './hedera.js';

const investorDids = () => ({
  A: need('DEMO_INVESTOR_A_DID', '40-create-investor-a.sh'),
  B: need('DEMO_INVESTOR_B_DID', '41-create-investor-b.sh'),
});

export const createAgent: Stage = {
  id: '70-create-distribution-agent',
  title: 'Catenor Protocol — Sponsor creates the Distribution Agent',
  actor: 'Sponsor (CREATE_AGENT)',
  operation: 'CREATE_AGENT (authorized) → AGENT Subject + Privy execution wallet + private binding',
  changes: [
    'Privy dev app: Agent signer infrastructure (management owner → ~/.catenor-one; runtime key quorum) if absent',
    'AGENT Subject with its own random did:catenor (the Agent keeps its own identity)',
    'Privy EVM execution wallet whose policy is narrower than the SPV’s: chain 296 ∧ to ∈ {Investor A, Investor B} ∧ value ≤ 20 HBAR; exports denied',
    'private AGENT_EXECUTION Account Binding',
  ],
  sponsors: ['Privy'],
  mode: 'SPONSOR LIVE (non-spending)',
  expected: 'Agent did:catenor + wallet; NO capability yet (created ≠ authorized)',
  details: () => ({ Sponsor: env('DEMO_SPONSOR_DID') || '(stage 20)' }),
  async run(ctx) {
    const sponsor = need('DEMO_SPONSOR_DID', '20-create-sponsor.sh');
    const { A, B } = investorDids();
    if (!env('DEMO_AGENT_OWNER_PUBLIC_KEY')) {
      // Before the services are first built in this process, so the Agent provisioner sees the new public values.
      await provisionSigner(
        ctx.privy,
        ctx.instance,
        'DEMO_AGENT',
        'catenor-one-clean-room-agent-runtime',
      );
    }
    const agent = await ctx.services.sponsor.createAgent({
      sponsor,
      resource: RESOURCE,
      investors: [A, B],
      maxPayoutWeibar: 20n * HBAR,
    });
    setState({
      DEMO_AGENT_DID: agent.did,
      DEMO_AGENT_WALLET_ID: agent.wallet.walletRef,
      DEMO_AGENT_WALLET_ADDRESS: agent.wallet.address,
      DEMO_AGENT_POLICY_ID: agent.wallet.policyRef,
    });
    const before = await ctx.services.investors.computeConfidentialDistribution({
      agent: agent.did,
      resource: RESOURCE,
      asset: 'n/a',
      revenueEventId: 'none',
      investors: [A, B],
      holdings: new Map(),
      holdingsSource: 'n/a',
    });
    say('Agent', { did: agent.did, wallet: agent.wallet.address, controls: agent.wallet.controls });
    say('Agent requests a distribution BEFORE any delegation', before);
    return {
      agent: agent.did,
      wallet: agent.wallet.address,
      controls: agent.wallet.controls,
      requestBeforeDelegation: before,
    };
  },
};

export const agentRelationship: Stage = {
  id: '71-sponsor-establish-agent-relationship',
  title: 'Catenor Protocol — Sponsor → Agent relationship (who the Agent acts for)',
  actor: 'Sponsor',
  operation: 'Relationship Credential: Agent AGENT_OF Sponsor [REF-IMPL predicate]',
  changes: [
    'OFFICER_OF is the protocol’s only example and relates a Human to an Organization; the Agent is an AGENT Subject, so Catenor One uses the [REF-IMPL] predicate AGENT_OF (the predicate vocabulary is an open design item)',
    'signed by the Sponsor assertion key; it authorizes NOTHING by itself',
  ],
  sponsors: ['Privy (Sponsor signs)'],
  mode: 'SPONSOR LIVE (non-spending)',
  expected: 'VALID relationship; the Agent still cannot distribute (no capability)',
  details: () => ({
    Issuer: env('DEMO_SPONSOR_DID'),
    Subject: env('DEMO_AGENT_DID'),
    Relationship: 'AGENT_OF → Sponsor',
  }),
  async run(ctx) {
    const sponsor = need('DEMO_SPONSOR_DID', '20-create-sponsor.sh');
    const agent = need('DEMO_AGENT_DID', '70-create-distribution-agent.sh');
    const vc = await ctx.services.sponsor.establishAgentRelationship({
      sponsor,
      agent,
      validUntil: inDays(30),
    });
    const rel = await ctx.services.sponsor.verifyRelationship({
      subject: agent,
      predicate: RELATIONSHIP_PREDICATES.AGENT_OF,
      object: sponsor,
    });
    const { A, B } = investorDids();
    const stillDenied = await ctx.services.investors.computeConfidentialDistribution({
      agent,
      resource: RESOURCE,
      asset: 'n/a',
      revenueEventId: 'none',
      investors: [A, B],
      holdings: new Map(),
      holdingsSource: 'n/a',
    });
    say('relationship', { id: vc.id, verification: rel.verification });
    say('Agent requests a distribution with ONLY the relationship', stillDenied);
    return {
      relationship: {
        credentialId: vc.id,
        predicate: 'AGENT_OF',
        object: sponsor,
        verification: rel.verification,
      },
      requestWithRelationshipOnly: stillDenied,
    };
  },
};

export const delegateCapability: Stage = {
  id: '72-sponsor-delegate-distribution-capability',
  title: 'Catenor Protocol — Delegated Capability (what the Agent may do)',
  actor: 'Sponsor → Agent',
  operation:
    'EXECUTE_DISTRIBUTION on spv:catenor-demo-001, delegated under CREATE_DISTRIBUTION + DELEGATE_DISTRIBUTION_AUTHORITY',
  changes: [
    'checked BEFORE signing: the action is explicitly delegable; the Sponsor holds CREATE_DISTRIBUTION and DELEGATE_DISTRIBUTION_AUTHORITY from the ACTIVE Trust Anchor on the same resource',
    'Sponsor signs the grant (valid 20 days ≤ the Sponsor’s 30) — delegated authority ⊆ delegator authority',
    'negative: the Sponsor tries to delegate TOKENIZE_ASSET → refused before any signature (not delegable)',
  ],
  sponsors: ['Privy (Sponsor signs)'],
  mode: 'SPONSOR LIVE (non-spending)',
  expected:
    'authority chain VALID: Trust Anchor → Sponsor → Agent; TOKENIZE_ASSET delegation refused',
  details: () => ({
    Issuer: env('DEMO_SPONSOR_DID'),
    Subject: env('DEMO_AGENT_DID'),
    Capability: `EXECUTE_DISTRIBUTION resource=${RESOURCE}`,
  }),
  async run(ctx) {
    const sponsor = need('DEMO_SPONSOR_DID', '20-create-sponsor.sh');
    const agent = need('DEMO_AGENT_DID', '70-create-distribution-agent.sh');
    let refused;
    try {
      await ctx.services.sponsor.delegateToAgent({
        sponsor,
        agent,
        action: TOKENIZE_ASSET,
        resource: RESOURCE,
        validUntil: inDays(20),
      });
      refused = { unexpected: 'TOKENIZE_ASSET delegation was not refused' };
    } catch (e) {
      refused = {
        refused: true,
        reasons: e instanceof SponsorActionRefused ? e.reasons : [(e as Error).message],
        signature: 'none requested',
      };
    }
    const { grant, authorization } = await ctx.services.sponsor.delegateToAgent({
      sponsor,
      agent,
      action: EXECUTE_DISTRIBUTION,
      resource: RESOURCE,
      validUntil: inDays(20),
    });
    const { A } = investorDids();
    const wrongRequester = await ctx.services.sponsor.authorizeDelegated({
      requester: A,
      grant,
      action: EXECUTE_DISTRIBUTION,
      resource: RESOURCE,
    });
    say('delegation', { grantId: grant.id, authorization });
    say('negative: delegate TOKENIZE_ASSET', refused);
    say('negative: Investor A presents the Agent grant', wrongRequester);
    return {
      grant: {
        id: grant.id,
        issuer: grant.issuer,
        subject: grant.capability.subject,
        action: grant.capability.action,
        resource: grant.capability.resource,
        validUntil: grant.capability.constraints.validUntil,
      },
      authorityChain: authorization.chain,
      decision: authorization.decision,
      negatives: { delegateTokenizeAsset: refused, wrongRequester },
    };
  },
};

/** "Investor A (Lisa Simpson)" — the fictional Sumsub sandbox name recorded by stage 40/41, when present. */
function investorLabel(label: 'A' | 'B'): string {
  const name = env(`DEMO_INVESTOR_${label}_SANDBOX_NAME`);
  return name ? `Investor ${label} (${name})` : `Investor ${label}`;
}

export const invalidateInvestorB: Stage = {
  id: '80-invalidate-investor-b',
  title: 'Provider state change — Investor B becomes RED / SANCTIONS / FINAL (Sumsub sandbox)',
  actor: 'Identity provider (Sumsub SANDBOX, driven by the operator)',
  operation:
    'none in Catenor — the CURRENT external evidence changes; Catenor re-checks it confidentially at distribution time',
  changes: [
    'Sumsub sandbox: Investor B’s applicant review → RED, rejectLabels [SANCTIONS], FINAL',
    'nothing else changes: B keeps its 400 ATS units, its dividend entitlement and a cryptographically valid, ACTIVE credential',
  ],
  sponsors: ['Sumsub (sandbox)'],
  mode: 'SPONSOR LIVE (non-spending)',
  expected: 'current review RED; B still owns 400 units (ownership ≠ current eligibility)',
  async run(ctx) {
    const { B } = investorDids();
    const applicant = await ctx.services.investors.providerApplicant(B);
    const how = await ctx.sumsub.changeReview(applicant, 'RED');
    const review = await ctx.sumsub.currentReview(applicant);
    const credential = await ctx.services.investors.credentialOf(B);
    const holdings = await atsHoldings();
    const out = {
      investor: investorLabel('B'),
      did: B,
      sumsubSandboxReview: { ...review, changed: how },
      credential: {
        id: credential?.id,
        status: credential?.status,
        note: 'still ACTIVE and validly signed — signature validity ≠ current eligibility',
      },
      holdings: holdings
        ? { source: 'Hedera ATS (READ-ONLY)', units: holdings.B }
        : {
            source: 'Catenor-authorized allocation (ATS issuance not broadcast in this instance)',
            units: 400,
          },
    };
    say('Investor B', out);
    return out;
  },
};

export const triggerRevenue: Stage = {
  id: '81-trigger-revenue',
  title: 'SPV revenue event',
  actor:
    'SPV (demo trigger — in production: property-management system, bank webhook, schedule or reconciliation)',
  operation: 'REVENUE_RECEIVED 10 HBAR for spv:catenor-demo-001 (audit event)',
  changes: ['one REVENUE_RECEIVED audit event (id written to state.env); no funds move'],
  sponsors: ['none'],
  mode: 'LOCAL',
  expected: 'revenue event id',
  async run(ctx) {
    const spv = need('DEMO_SPV_DID', '30-create-spv.sh');
    const { revenueEventId } = await ctx.services.investors.recordRevenue({
      spv,
      resource: RESOURCE,
      amountWeibar: 10n * HBAR,
      source: 'clean-room demo trigger (scripts/demo/81-trigger-revenue.sh)',
    });
    setState({ DEMO_REVENUE_EVENT_ID: revenueEventId });
    say('revenue', { revenueEventId, amountHbar: '10.0' });
    return { revenueEventId, resource: RESOURCE, amountHbar: '10.0' };
  },
};

export const confidentialDistribution: Stage = {
  id: '82-run-confidential-distribution',
  title: 'Chainlink CRE Confidential — the distribution is computed inside the TEE',
  actor: 'Distribution Agent (EXECUTE_DISTRIBUTION, delegated)',
  operation:
    'delegated authority → sealed context → handlerInTee: verify VP/VC/status → current evidence → reconcile → policy:distribution-eligibility:v2 → PAY/HOLD + amounts',
  changes: [
    'Catenor verifies the Agent’s authority chain (Trust Anchor → Sponsor → Agent); a wrong requester is DENIED',
    'fresh challenge; each investor presents its VP; the issuer signs current status statements',
    'ONE sealed CRE run computes 10 HBAR × units / 1000 per holder AND decides PAY/HOLD per holder; only the minimized plan + commitment leave the TEE',
    'Catenor verifies the result (authenticated callback, commitment, arithmetic, holder set) and records one protocol Decision per holder; nothing is executed',
  ],
  sponsors: [
    'Chainlink CRE (confidential)',
    'Sumsub (sandbox)',
    'Privy (signatures)',
    'Hedera ATS (READ-ONLY holdings, when issued)',
  ],
  mode: 'CONFIDENTIAL (CRE)',
  expected: 'Investor A PAY 6 HBAR · Investor B HOLD 4 HBAR',
  async run(ctx) {
    await ctx.startConfidential();
    const agent = need('DEMO_AGENT_DID', '70-create-distribution-agent.sh');
    const revenueEventId = need('DEMO_REVENUE_EVENT_ID', '81-trigger-revenue.sh');
    const { A, B } = investorDids();
    const ats = await atsHoldings();
    const onChain = ats && ats.A + ats.B > 0n;
    const holdings = new Map([
      [A, onChain ? ats.A : 600n],
      [B, onChain ? ats.B : 400n],
    ]);
    const holdingsSource = onChain
      ? `Hedera ATS ${env('DEMO_EQUITY_ADDRESS')} (READ-ONLY balanceOf)`
      : 'Catenor-authorized allocation from the offering Decisions (ATS issuance not broadcast in this instance)';
    const wrong = await ctx.services.investors.computeConfidentialDistribution({
      agent: A,
      resource: RESOURCE,
      asset: 'n/a',
      revenueEventId,
      investors: [A, B],
      holdings,
      holdingsSource,
    });
    say('negative: Investor A requests the distribution', wrong);
    const result = await ctx.services.investors.computeConfidentialDistribution({
      agent,
      resource: RESOURCE,
      asset: env('DEMO_EQUITY_ADDRESS') || 'ats:not-yet-deployed',
      revenueEventId,
      investors: [A, B],
      holdings,
      holdingsSource,
    });
    if (result.decision === 'DENY') {
      say('Agent request', result);
      return { decision: result };
    }
    const { plan, run } = result;
    setState({ DEMO_PLAN_ID: plan.id });
    const label = (did: string) => investorLabel(did === A ? 'A' : 'B');
    const view = {
      planId: plan.id,
      computedIn: `Chainlink CRE identity-confidential CONFIDENTIAL_DISTRIBUTION (${run.mode})`,
      holdingsSource,
      blindDryRun: plan.blind.map((b) => ({
        investor: label(b.investor),
        hbar: formatEther(BigInt(b.proposedWeibar)),
      })),
      holders: plan.holders.map((h) => ({
        investor: label(h.investor),
        units: h.units,
        shareHbar: formatEther(BigInt(h.shareWeibar)),
        decision: h.decision,
        controlled: h.controlled,
        trace: h.trace.map((t) => `${t.requirement}=${t.status}`),
        presentationChecks: h.presentationChecks,
        reconciliation: h.reconciliation,
        reasonCodes: h.reasonCodes,
        decisionCommitment: h.decisionCommitment,
      })),
      payHbar: formatEther(BigInt(plan.payWeibar)),
      heldHbar: formatEther(BigInt(plan.heldWeibar)),
      authorityChain: plan.authorityChain,
      evidenceCommitment: plan.confidentialRun.evidenceCommitment,
      executed: false,
    };
    say('confidential distribution plan', view);
    return {
      wrongRequester: wrong,
      plan: view,
      confidentialRun: { mode: run.mode, runId: run.runId, status: run.status },
    };
  },
};

export const executeDistribution: Stage = {
  id: '83-execute-approved-distribution',
  title: 'Execution — the Agent pays exactly the TEE-approved PAY holders (Privy)',
  actor: 'Distribution Agent execution wallet',
  operation:
    'approved plan → Catenor signer boundary → Privy Agent policy → Hedera transfer (PAY only)',
  changes: [
    'HOLD holders: no transaction is built and no Privy signature is requested',
    'PAY holders: exactly the plan amount to the PRIVATELY bound account, empty calldata, chain 296',
    'default: Privy dry signature (discarded); --live: ONE transfer per PAY holder (confirmation required)',
  ],
  sponsors: ['Privy (Agent wallet + policy)', 'Hedera Testnet'],
  mode: 'READ-ONLY',
  liveMode: 'TESTNET LIVE (spends HBAR)',
  expected:
    'Investor A: 6 HBAR (dry-signed, or paid with --live) · Investor B: nothing, zero signature requests',
  async run(ctx, flags) {
    const agent = need('DEMO_AGENT_DID', '70-create-distribution-agent.sh');
    const plan = await ctx.services.investors.findPlan(
      agent,
      need('DEMO_PLAN_ID', '82-run-confidential-distribution.sh'),
    );
    if (!plan) throw new Error('plan not found');
    const requests: string[] = [];
    const base = privyEvmSigningApi(ctx.privy);
    const api: PrivyEvmSigningApi = {
      walletAddress: (id) => base.walletAddress(id),
      signTransaction: (id, tx, key) => {
        requests.push(getAddress(tx.to));
        return base.signTransaction(id, tx, key);
      },
    };
    const executor = new PrivyAgentPayoutExecutor(api, {
      walletId: need('DEMO_AGENT_WALLET_ID', '70'),
      walletAddress: need('DEMO_AGENT_WALLET_ADDRESS', '70'),
      runtimeAuthorizationKey: need('DEMO_AGENT_RUNTIME_AUTHORIZATION_KEY', '70'),
    });
    const reader = new HederaAtsHoldingsReader();
    const { A, B } = investorDids();
    const label = (did: string) =>
      did === A ? investorLabel('A') : did === B ? investorLabel('B') : did;
    const nonceBefore = await executor.nonce();
    const outcomes = [];
    for (const h of plan.holders) {
      const approval = await ctx.services.investors.approvedPayout(plan, h.investor);
      if (approval.controlled !== 'PAY') {
        outcomes.push({
          investor: label(h.investor),
          controlled: 'HOLD',
          heldHbar: formatEther(BigInt(h.shareWeibar)),
          transactionConstructed: false,
          privySignatureRequested: false,
        });
        continue;
      }
      let prepared;
      try {
        prepared = await executor.prepare(approval, {
          recipient: approval.boundAccount,
          amountWeibar: approval.approvedWeibar,
        });
      } catch (e) {
        outcomes.push({
          investor: label(h.investor),
          controlled: 'PAY',
          refused: e instanceof PayoutRefused ? e.code : (e as Error).message,
          privySignatureRequested: false,
        });
        continue;
      }
      if (!flags.live) {
        const { recoveredFrom } = await executor.sign(prepared);
        outcomes.push({
          investor: label(h.investor),
          controlled: 'PAY',
          amountHbar: formatEther(approval.approvedWeibar),
          estimatedGas: prepared.estimatedGas,
          privyDrySignature: 'SIGNED (discarded)',
          recoveredFrom,
        });
        continue;
      }
      await confirmLive(
        this.id,
        `transfer ${formatEther(approval.approvedWeibar)} HBAR from the Agent wallet to ${label(h.investor)}'s bound account (plan ${plan.id})`,
      );
      const before = await reader.nativeBalance(approval.boundAccount);
      const executed = await executor.execute(prepared);
      const after = await reader.nativeBalance(approval.boundAccount);
      await ctx.services.investors.recordPayoutExecuted({
        agent,
        planRef: plan.id,
        investor: h.investor,
        amountWeibar: approval.approvedWeibar,
        transactionId: executed.transactionId,
      });
      setState({ DEMO_PAYOUT_TX: executed.transactionId });
      outcomes.push({
        investor: label(h.investor),
        controlled: 'PAY',
        amountHbar: formatEther(approval.approvedWeibar),
        transaction: executed.transactionId,
        hashscan: executed.explorerUrl,
        receivedHbar: formatEther(after - before),
      });
    }
    const out = {
      planId: plan.id,
      outcomes,
      privySignatureRequestsTo: requests,
      investorBSignatureRequests: requests.filter(
        (r) =>
          r ===
          getAddress(
            env('DEMO_INVESTOR_B_ADDRESS') || '0x0000000000000000000000000000000000000000',
          ),
      ).length,
      agentNonce: { before: nonceBefore, after: await executor.nonce() },
      broadcast: flags.live,
    };
    say('execution', out);
    return out;
  },
};
