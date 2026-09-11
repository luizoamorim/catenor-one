// Final demo — Distribution Agent + eligibility-gated distribution plan (Catenor One [REF-IMPL]; FINAL-DEMO FD-5,
// FD-6, FD-7). Application orchestration only: Catenor semantics here, sponsor mechanics behind ports.
//
//   CREATE DISTRIBUTION AGENT: AGENT Subject (random did:catenor) → dedicated execution wallet whose wallet policy
//   is narrower than the SPV's (infrastructure port; Privy) → private Account Binding → the ACTIVE Trust Anchor
//   grants EXECUTE_DISTRIBUTION on the SPV resource (signed Capability). Relationship ≠ Capability.
//
//   PLAN DISTRIBUTION: the Agent's request is authorized against its grant (fail closed); holdings are read
//   (execution network, READ-ONLY); a BLIND plan (holdings only) is computed as a DRY RUN; each holder's CURRENT
//   evidence is checked confidentially (identity-confidential INVESTOR_ELIGIBILITY); policy:distribution-eligibility:v1
//   decides per holder; the CONTROLLED plan pays ALLOW holders and HOLDS the rest. Nothing is executed here —
//   ownership ≠ current eligibility, and Policy Decision ≠ Execution Authorization.
import { commit, isCommitment, type Commitment } from '@catenor-one/audit';
import {
  EXECUTE_DISTRIBUTION,
  authorizeWithCapability,
  type CapabilityDenialReason,
  type CapabilityGrant,
} from '@catenor-one/authority';
import { generateCatenorDid, type CatenorDid } from '@catenor-one/identity';
import {
  DISTRIBUTION_ELIGIBILITY_POLICY_ID,
  createDecision,
  evaluateDistributionEligibility,
  type DistributionEligibilityEvaluation,
} from '@catenor-one/policy';
import {
  grantCapability,
  type CapabilityGrantDeps,
} from '../../capability-grants/application/grant-capability.js';
import type { PersistencePorts } from '../../trust-anchor-admission/application/persistence.ports.js';

/** [REF-IMPL] action of the per-holder Decision: may this holder receive this distribution now? */
export const RECEIVE_DISTRIBUTION = 'RECEIVE_DISTRIBUTION';
const CAIP2 = 'eip155:296';
const INVESTOR_PROVIDER = 'sumsub';

/** Execution-wallet provisioning for the Agent (Privy). The wallet policy is an execution control, not authority. */
export interface DistributionAgentWalletProvisioner {
  readonly adapter: string;
  provision(input: {
    readonly agentDid: string;
    readonly resource: string;
    /** The only accounts the wallet policy lets the Agent pay. */
    readonly recipients: readonly string[];
    /** Per-transaction cap enforced by the wallet policy (18-decimal weibar). */
    readonly maxPayoutWeibar: bigint;
  }): Promise<{
    readonly walletRef: string;
    readonly address: string;
    readonly policyRef: string;
    /** Human-readable summary of the wallet controls as stored by the provider. */
    readonly controls: readonly string[];
    /** CREATED_LIVE, or PRE_SEEDED_VERIFIED (a funded wallet provisioned before the demo, verified now). */
    readonly provisioning?: 'CREATED_LIVE' | 'PRE_SEEDED_VERIFIED';
  }>;
}

/** What Catenor approved for one holder (from a controlled plan) plus its private binding — input to the payout signer. */
export interface ApprovedPayout {
  readonly planRef: string;
  readonly investor: string;
  readonly controlled: 'PAY' | 'HOLD';
  /** The amount the approved plan assigned to this holder (18-decimal weibar). */
  readonly approvedWeibar: bigint;
  /** The investor's privately bound receiving account (address part of the CAIP-10 binding). */
  readonly boundAccount: string;
}

/** READ-ONLY holdings on the execution network (Hedera ATS). */
export interface HoldingsReader {
  balanceOf(asset: string, holder: string): Promise<bigint>;
}

/** Sealed context of one confidential investor check (identity-confidential INVESTOR_ELIGIBILITY). */
export interface InvestorVerificationContext {
  readonly sessionRef: string;
  readonly runId: string;
  readonly trustDomain: string;
  readonly subjectDid: string;
  readonly applicantId: string;
  readonly bindingRef: string;
  readonly notAfter: string;
}

export interface InvestorEvidenceVerifier {
  readonly mode: 'SIMULATION' | 'DEPLOYED' | 'FAKE';
  readonly workflowId: string;
  request(input: {
    readonly operation: 'INVESTOR_ELIGIBILITY';
    readonly runId: string;
    readonly context: InvestorVerificationContext;
  }): Promise<{ readonly executionId: string }>;
}

/** The authenticated TEE result (callback authenticator already checked HMAC, freshness and commitment). */
export interface InvestorEligibilityResult {
  readonly v: 1;
  readonly operation: 'INVESTOR_ELIGIBILITY';
  readonly runId: string;
  readonly sessionRef: string;
  readonly mode: 'SIMULATION' | 'DEPLOYED';
  readonly status: 'OK' | 'ERROR';
  readonly code?: string;
  readonly facts?: Readonly<
    Record<'INVESTOR_IDENTITY_VERIFIED' | 'INVESTOR_AML_CLEAR' | 'EVIDENCE_FRESH', boolean | null>
  >;
  readonly factReasons?: Readonly<Record<string, readonly string[]>>;
  readonly reconciliation?: { readonly investor: string };
  readonly evidenceCommitment?: string;
}

export interface DistributionDeps extends CapabilityGrantDeps {
  readonly provisioner: DistributionAgentWalletProvisioner;
  readonly holdings: HoldingsReader;
  readonly verifier: InvestorEvidenceVerifier;
  /** How long a confidential investor check may take (simulation compiles the workflow: ~30–60 s). */
  readonly resultTimeoutMs: number;
}

export interface HolderOutcome {
  readonly investor: string;
  readonly units: bigint;
  /** Pro-rata share of the revenue (weibar). */
  readonly proposedWeibar: bigint;
  readonly confidentialRun: {
    readonly mode: string;
    readonly status: string;
    readonly code?: string;
    readonly reconciliation?: string;
    readonly evidenceCommitment?: string;
  };
  readonly eligibility: DistributionEligibilityEvaluation;
  readonly factReasons?: Readonly<Record<string, readonly string[]>>;
  readonly decisionCommitment: string;
  readonly controlled: 'PAY' | 'HOLD';
}

export type DistributionPlan =
  | { readonly decision: 'DENY'; readonly reasons: readonly CapabilityDenialReason[] }
  | {
      readonly decision: 'ALLOW';
      readonly planRef: string;
      readonly revenueWeibar: bigint;
      /** DRY RUN — holdings only; never executed. */
      readonly blind: readonly { readonly investor: string; readonly proposedWeibar: bigint }[];
      readonly holders: readonly HolderOutcome[];
      readonly payWeibar: bigint;
      readonly heldWeibar: bigint;
    };

const rfc3339 = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
/** The TEE evidence commitment; for an ERROR run, a local commitment to the run outcome (no evidence, cf. D38). */
const evidenceCommitmentOf = (run: InvestorEligibilityResult): Commitment =>
  run.evidenceCommitment !== undefined && isCommitment(run.evidenceCommitment)
    ? run.evidenceCommitment
    : commit({
        profile: 'catenor-one/local-decision-evidence/v1',
        runId: run.runId,
        status: run.status,
        code: run.code ?? null,
      });
const addressOf = (caip10: string) => caip10.slice(caip10.lastIndexOf(':') + 1);

export class DistributionService {
  private readonly pending = new Map<string, (r: InvestorEligibilityResult) => void>();

  constructor(private readonly deps: DistributionDeps) {}

  /** Pre-seeded investor: HUMAN Subject, private identity-provider binding and private receiving-account binding. */
  async registerInvestor(input: {
    readonly account: string;
    readonly walletRef?: string;
  }): Promise<{ did: CatenorDid; bindingRef: string }> {
    const did = generateCatenorDid(this.deps.ids.randomBytes(16));
    const bindingRef = `cbr-${Buffer.from(this.deps.ids.randomBytes(16)).toString('hex')}`;
    await this.deps.uow.run(async (p) => {
      const subjectId = this.deps.ids.id('subject');
      await p.subjects.createSubject({ id: subjectId, did, type: 'HUMAN', lifecycle: 'ACTIVE' });
      await p.subjects.createProviderBindings([
        {
          id: this.deps.ids.id('provider-binding'),
          subjectId,
          provider: INVESTOR_PROVIDER,
          role: 'INVESTOR',
          bindingRef,
        },
      ]);
      await p.accountBindings.createAccountBinding({
        id: this.deps.ids.id('account-binding'),
        subjectId,
        purpose: 'DISTRIBUTION_RECEIVING',
        account: `${CAIP2}:${input.account}`,
        walletProvider: 'privy',
        ...(input.walletRef ? { walletRef: input.walletRef } : {}),
      });
      await this.audit(p, 'SUBJECT_CREATED', did);
      await this.audit(p, 'ACCOUNT_BINDING_CREATED', did, {
        purpose: 'DISTRIBUTION_RECEIVING',
        visibility: 'PRIVATE',
      });
    });
    return { did, bindingRef };
  }

  /** Attaches the investor's identity-provider applicant (after it was created with externalUserId = bindingRef). */
  async attachInvestorApplicant(did: string, applicantId: string): Promise<void> {
    await this.deps.uow.run(async (p) => {
      const subject = await p.subjects.findSubjectByDid(did);
      if (!subject) throw new Error('unknown investor');
      await p.subjects.attachProviderReference(subject.id, 'INVESTOR', applicantId);
      await this.audit(p, 'PROVIDER_REFERENCES_ATTACHED', did, { role: 'INVESTOR' });
    });
  }

  /** CREATE DISTRIBUTION AGENT — live demo action. */
  async createDistributionAgent(input: {
    readonly issuer: string;
    readonly resource: string;
    readonly investors: readonly string[];
    readonly maxPayoutWeibar: bigint;
    readonly validUntil: string;
  }): Promise<{
    did: CatenorDid;
    wallet: {
      address: string;
      walletRef: string;
      policyRef: string;
      controls: readonly string[];
      provisioning?: 'CREATED_LIVE' | 'PRE_SEEDED_VERIFIED';
    };
    grant: CapabilityGrant;
  }> {
    const recipients = await this.deps.uow.run(async (p) => {
      const accounts: string[] = [];
      for (const did of input.investors) accounts.push(await this.receivingAccount(p, did));
      return accounts;
    });
    const did = generateCatenorDid(this.deps.ids.randomBytes(16));
    const subjectId = this.deps.ids.id('subject');
    await this.deps.uow.run(async (p) => {
      await p.subjects.createSubject({ id: subjectId, did, type: 'AGENT', lifecycle: 'ACTIVE' });
      await this.audit(p, 'SUBJECT_CREATED', did, { subjectType: 'AGENT' });
    });
    const wallet = await this.deps.provisioner.provision({
      agentDid: did,
      resource: input.resource,
      recipients: recipients.map(addressOf),
      maxPayoutWeibar: input.maxPayoutWeibar,
    });
    await this.deps.uow.run(async (p) => {
      await p.accountBindings.createAccountBinding({
        id: this.deps.ids.id('account-binding'),
        subjectId,
        purpose: 'AGENT_EXECUTION',
        account: `${CAIP2}:${wallet.address}`,
        walletProvider: this.deps.provisioner.adapter,
        walletRef: wallet.walletRef,
      });
      await this.audit(p, 'AGENT_EXECUTION_WALLET_PROVISIONED', did, {
        walletProvider: this.deps.provisioner.adapter,
        walletAddress: wallet.address,
        resource: input.resource,
        provisioning: wallet.provisioning ?? 'CREATED_LIVE',
        controls: [...wallet.controls],
      });
    });
    const grant = await grantCapability(this.deps, {
      issuer: input.issuer,
      subject: did,
      action: EXECUTE_DISTRIBUTION,
      resource: input.resource,
      validUntil: input.validUntil,
    });
    return { did, wallet, grant };
  }

  /**
   * The approved payout for one holder of an ALLOW plan: PAY/HOLD and amount exactly as the controlled plan decided,
   * recipient from the holder's PRIVATE receiving-account binding (never from the caller).
   */
  async approvedPayout(
    plan: Extract<DistributionPlan, { decision: 'ALLOW' }>,
    investor: string,
  ): Promise<ApprovedPayout> {
    const outcome = plan.holders.find((h) => h.investor === investor);
    if (!outcome) throw new Error('the investor is not a holder in this plan');
    const account = await this.deps.uow.run((p) => this.receivingAccount(p, investor));
    return {
      planRef: plan.planRef,
      investor,
      controlled: outcome.controlled,
      approvedWeibar: outcome.controlled === 'PAY' ? outcome.proposedWeibar : 0n,
      boundAccount: addressOf(account),
    };
  }

  /** Delivery of an authenticated INVESTOR_ELIGIBILITY callback (from the CRE callback receiver). */
  recordInvestorEligibilityResult(
    result: InvestorEligibilityResult,
  ): Promise<{ accepted: boolean; reason?: string }> {
    const resolve = this.pending.get(result.runId);
    if (!resolve || result.operation !== 'INVESTOR_ELIGIBILITY') {
      return Promise.resolve({ accepted: false, reason: 'UNKNOWN_RUN' });
    }
    this.pending.delete(result.runId);
    resolve(result);
    return Promise.resolve({ accepted: true });
  }

  /** Revenue received → blind DRY RUN vs Catenor-controlled plan. No transaction is sent. */
  async planDistribution(input: {
    readonly agent: string;
    readonly grant: CapabilityGrant | undefined;
    readonly resource: string;
    readonly asset: string;
    readonly revenueWeibar: bigint;
    readonly investors: readonly string[];
  }): Promise<DistributionPlan> {
    const issuer = input.grant?.issuer;
    const issuerDocument = issuer
      ? (await this.deps.uow.run((p) => p.didState.resolve(issuer)))?.document
      : undefined;
    const issuerIsActiveTrustAnchor = issuer
      ? (await this.deps.verifyTrustAnchor(issuer)).TRUST_ANCHOR_VALID
      : false;
    const authorization = authorizeWithCapability({
      grant: input.grant,
      issuerDocument,
      issuerIsActiveTrustAnchor,
      request: { requester: input.agent, action: EXECUTE_DISTRIBUTION, resource: input.resource },
      now: this.deps.clock.now(),
    });
    if (authorization.decision === 'DENY') {
      await this.deps.uow.run((p) =>
        this.audit(p, 'DISTRIBUTION_REQUEST_DENIED', input.agent, {
          grantId: input.grant?.id ?? null,
          action: EXECUTE_DISTRIBUTION,
          resource: input.resource,
          reasons: [...authorization.reasons],
        }),
      );
      return { decision: 'DENY', reasons: authorization.reasons };
    }

    const planRef = this.deps.ids.id('distribution-plan');
    const holders = await this.deps.uow.run(async (p) => {
      const out: { did: string; account: string; applicantId: string; bindingRef: string }[] = [];
      for (const did of input.investors) {
        const subject = await p.subjects.findSubjectByDid(did);
        const binding = subject
          ? (await p.subjects.listProviderBindings(subject.id)).find((b) => b.role === 'INVESTOR')
          : undefined;
        if (!binding?.externalSubjectId) throw new Error('investor applicant not attached');
        out.push({
          did,
          account: await this.receivingAccount(p, did),
          applicantId: binding.externalSubjectId,
          bindingRef: binding.bindingRef,
        });
      }
      return out;
    });
    const units = await Promise.all(
      holders.map((h) => this.deps.holdings.balanceOf(input.asset, addressOf(h.account))),
    );
    const total = units.reduce((a, b) => a + b, 0n);
    const share = (u: bigint) => (total === 0n ? 0n : (input.revenueWeibar * u) / total);
    const blind = holders.map((h, i) => ({ investor: h.did, proposedWeibar: share(units[i]!) }));

    const outcomes: HolderOutcome[] = [];
    for (const [i, h] of holders.entries()) {
      const run = await this.confidentialCheck(planRef, h);
      const facts = run.status === 'OK' ? run.facts : undefined;
      const eligibility = evaluateDistributionEligibility({
        HOLDS_ASSET: units[i]! > 0n,
        INVESTOR_IDENTITY_VERIFIED: facts?.INVESTOR_IDENTITY_VERIFIED ?? null,
        INVESTOR_AML_CLEAR: facts?.INVESTOR_AML_CLEAR ?? null,
        EVIDENCE_FRESH: facts?.EVIDENCE_FRESH ?? null,
      });
      const decision = createDecision({
        policy: DISTRIBUTION_ELIGIBILITY_POLICY_ID,
        subject: h.did,
        action: RECEIVE_DISTRIBUTION,
        resource: input.resource,
        decision: eligibility.outcome,
        evaluatedAt: rfc3339(this.deps.clock.now()),
        evidenceCommitment: evidenceCommitmentOf(run),
      });
      const outcome: HolderOutcome = {
        investor: h.did,
        units: units[i]!,
        proposedWeibar: share(units[i]!),
        confidentialRun: {
          mode: run.mode,
          status: run.status,
          ...(run.code ? { code: run.code } : {}),
          ...(run.reconciliation ? { reconciliation: run.reconciliation.investor } : {}),
          ...(run.evidenceCommitment ? { evidenceCommitment: run.evidenceCommitment } : {}),
        },
        eligibility,
        ...(run.factReasons ? { factReasons: run.factReasons } : {}),
        decisionCommitment: commit(decision),
        controlled: eligibility.outcome === 'ALLOW' ? 'PAY' : 'HOLD',
      };
      outcomes.push(outcome);
      await this.deps.uow.run((p) =>
        this.audit(p, 'DISTRIBUTION_ELIGIBILITY_EVALUATED', h.did, {
          planRef,
          policy: DISTRIBUTION_ELIGIBILITY_POLICY_ID,
          decision: eligibility.outcome,
          trace: eligibility.trace.map((t) => `${t.requirement}=${t.status}`),
          reconciliation: run.reconciliation?.investor ?? null,
          confidentialMode: run.mode,
          evidenceCommitment: run.evidenceCommitment ?? null,
          decisionCommitment: outcome.decisionCommitment,
        }),
      );
    }
    const payWeibar = outcomes
      .filter((o) => o.controlled === 'PAY')
      .reduce((a, o) => a + o.proposedWeibar, 0n);
    const heldWeibar = outcomes
      .filter((o) => o.controlled === 'HOLD')
      .reduce((a, o) => a + o.proposedWeibar, 0n);
    await this.deps.uow.run((p) =>
      this.audit(p, 'DISTRIBUTION_PLAN_CREATED', input.agent, {
        planRef,
        grantId: input.grant!.id,
        resource: input.resource,
        revenueWeibar: String(input.revenueWeibar),
        payWeibar: String(payWeibar),
        heldWeibar: String(heldWeibar),
        paid: outcomes.filter((o) => o.controlled === 'PAY').map((o) => o.investor),
        held: outcomes.filter((o) => o.controlled === 'HOLD').map((o) => o.investor),
        executed: false,
      }),
    );
    return {
      decision: 'ALLOW',
      planRef,
      revenueWeibar: input.revenueWeibar,
      blind,
      holders: outcomes,
      payWeibar,
      heldWeibar,
    };
  }

  private async confidentialCheck(
    planRef: string,
    h: { did: string; applicantId: string; bindingRef: string },
  ): Promise<InvestorEligibilityResult> {
    const runId = this.deps.ids.id('run');
    const received = new Promise<InvestorEligibilityResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(runId);
        reject(new Error(`confidential investor check ${runId} timed out`));
      }, this.deps.resultTimeoutMs);
      this.pending.set(runId, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
    });
    await this.deps.verifier.request({
      operation: 'INVESTOR_ELIGIBILITY',
      runId,
      context: {
        sessionRef: planRef,
        runId,
        trustDomain: this.deps.trustDomain,
        subjectDid: h.did,
        applicantId: h.applicantId,
        bindingRef: h.bindingRef,
        notAfter: rfc3339(new Date(this.deps.clock.now().getTime() + 10 * 60_000)),
      },
    });
    const result = await received;
    if (result.sessionRef !== planRef) {
      return { ...result, status: 'ERROR', code: 'SESSION_MISMATCH' };
    }
    return result;
  }

  private async receivingAccount(p: PersistencePorts, did: string): Promise<string> {
    const subject = await p.subjects.findSubjectByDid(did);
    const binding = subject
      ? await p.accountBindings.findAccountBinding(subject.id, 'DISTRIBUTION_RECEIVING')
      : undefined;
    if (!binding) throw new Error('investor has no receiving account binding');
    return binding.account;
  }

  private audit(
    p: PersistencePorts,
    type: Parameters<PersistencePorts['audit']['append']>[1]['type'],
    subject: string,
    details?: Record<string, string | number | boolean | null | readonly string[]>,
  ) {
    return p.audit.append(this.deps.trustDomain, {
      type,
      subject,
      timestamp: rfc3339(this.deps.clock.now()),
      ...(details ? { details } : {}),
    });
  }
}
