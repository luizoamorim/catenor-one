// Clean-room demo — investors, Verifiable Credentials / Presentations, offering eligibility, investment authorization
// and the CONFIDENTIAL distribution (Catenor One [REF-IMPL]; prompt 2026-09-11-023). Application orchestration only.
//
//   Investor = HUMAN Subject (random did:catenor) · private receiving Account Binding (Privy EVM wallet) · private
//   identity-provider binding (Sumsub sandbox) · its own AUTHENTICATION key (holder key, Privy Ed25519) in its DID
//   Document — never its financial account.
//
//   Provider evidence ──CRE INVESTOR_ELIGIBILITY──▶ facts ──Trust Anchor──▶ CatenorInvestorEligibilityCredential (VC)
//   VC ──holder key, verifier challenge + domain──▶ Verifiable Presentation (VP)
//   VP + issuer-signed status statement + current evidence ──CRE (TEE)──▶ offering / distribution decisions
//
// The CONFIDENTIAL_DISTRIBUTION operation computes the distribution inside the TEE; this service only authorizes the
// Agent (delegated chain), supplies the private inputs sealed, and verifies the minimized result it gets back
// (authenticated callback, commitment, arithmetic, holder set) before any execution may use it.
import { commit, isCommitment, type Commitment } from '@catenor-one/audit';
import {
  EXECUTE_DISTRIBUTION,
  TOKENIZE_ASSET,
  type CapabilityDenialReason,
  type DelegatedAuthorization,
  type OfferingDefinition,
} from '@catenor-one/authority';
import {
  createCredential,
  createPresentation,
  createStatusStatement,
  type SignedCredentialStatusStatement,
  type VerifiableCredential,
  type VerifiablePresentation,
} from '@catenor-one/credentials';
import { generateCatenorDid, type CatenorDid } from '@catenor-one/identity';
import {
  DISTRIBUTION_ELIGIBILITY_V2_POLICY_HASH,
  DISTRIBUTION_ELIGIBILITY_V2_POLICY_ID,
  INVESTOR_ELIGIBILITY_CREDENTIAL,
  OFFERING_ELIGIBILITY_POLICY_HASH,
  OFFERING_ELIGIBILITY_POLICY_ID,
  RECEIVE_DISTRIBUTION_ACTION,
  SUBSCRIBE_OFFERING,
  createDecision,
  type Decision,
} from '@catenor-one/policy';
import type { TrustAnchorVerificationResult } from '@catenor-one/authority';
import type { SponsorAuthorizationService } from '../../sponsor-authorization/application/sponsor-authorization.service.js';
import {
  provisionSubjectKey,
  rfc3339,
  signAs,
  subjectKey,
  type SubjectKeyDeps,
} from '../../sponsor-authorization/application/subject-keys.js';
import type { IdGenerator } from '../../trust-anchor-admission/application/admission.ports.js';
import type {
  PersistencePorts,
  StoredDocument,
} from '../../trust-anchor-admission/application/persistence.ports.js';

const CAIP2 = 'eip155:296';
const INVESTOR_PROVIDER = 'sumsub';
const addressOf = (caip10: string) => caip10.slice(caip10.lastIndexOf(':') + 1);

export type CredentialOperation =
  'INVESTOR_ELIGIBILITY' | 'OFFERING_ELIGIBILITY' | 'CONFIDENTIAL_DISTRIBUTION';

/** identity-confidential, for the clean-room operations (sealed context; authenticated callback). */
export interface CredentialOperationsVerifier {
  readonly mode: 'SIMULATION' | 'DEPLOYED' | 'FAKE';
  readonly workflowId: string;
  request(input: {
    readonly operation: CredentialOperation;
    readonly runId: string;
    readonly context: { readonly runId: string } & Record<string, unknown>;
  }): Promise<{ readonly executionId: string }>;
}

/** An authenticated TEE result (HMAC, freshness and commitment already checked by the callback authenticator). */
export interface CredentialOperationResult {
  readonly v: 1;
  readonly operation: CredentialOperation;
  readonly runId: string;
  readonly sessionRef: string;
  readonly mode: 'SIMULATION' | 'DEPLOYED';
  readonly status: 'OK' | 'ERROR';
  readonly code?: string;
  readonly facts?: unknown;
  readonly evidenceCommitment?: string;
  readonly reconciliation?: unknown;
}

export interface InvestorCredentialsDeps extends SubjectKeyDeps {
  readonly ids: IdGenerator;
  readonly trustDomain: string;
  readonly verifyTrustAnchor: (did: string) => Promise<TrustAnchorVerificationResult>;
  readonly verifier: CredentialOperationsVerifier;
  readonly sponsor: SponsorAuthorizationService;
  /** How long one confidential run may take (simulation compiles the workflow: ~30–90 s). */
  readonly resultTimeoutMs: number;
  /** Credential lifetime (days) — [REF-IMPL] demo value. */
  readonly credentialValidityDays?: number;
}

type Trace = readonly {
  readonly requirement: string;
  readonly status: 'TRUE' | 'FALSE' | 'MISSING';
}[];

export interface InvestorOutcome {
  readonly investor: string;
  readonly decision: 'ALLOW' | 'DENY';
  readonly trace: Trace;
  readonly presentationChecks: Readonly<Record<string, boolean>>;
  readonly reconciliation: { readonly credentialVsCurrent: string; readonly provider: string };
  readonly reasonCodes: readonly string[];
}

export interface OfferingDecisionRecord {
  readonly type: 'CatenorOneOfferingDecision';
  readonly id: string;
  readonly offeringId: string;
  readonly units: string;
  readonly decision: Decision;
  readonly decisionCommitment: string;
  readonly outcome: InvestorOutcome;
  readonly confidentialRun: {
    readonly runId: string;
    readonly mode: string;
    readonly workflowId: string;
  };
}

export interface HolderPlan extends InvestorOutcome {
  readonly units: string;
  readonly shareWeibar: string;
  readonly controlled: 'PAY' | 'HOLD';
  readonly decisionCommitment: string;
}

export interface ConfidentialPlanRecord {
  readonly type: 'CatenorOneConfidentialDistributionPlan';
  readonly id: string;
  readonly agent: string;
  readonly resource: string;
  readonly asset: string;
  readonly revenueEventId: string;
  readonly revenueWeibar: string;
  readonly holdingsSource: string;
  readonly blind: readonly { readonly investor: string; readonly proposedWeibar: string }[];
  readonly holders: readonly HolderPlan[];
  readonly payWeibar: string;
  readonly heldWeibar: string;
  readonly policy: { readonly id: string; readonly hash: string };
  readonly authorityChain: DelegatedAuthorization['chain'];
  readonly confidentialRun: {
    readonly runId: string;
    readonly mode: string;
    readonly workflowId: string;
    readonly evidenceCommitment: string;
  };
  readonly executed: readonly { readonly investor: string; readonly transactionId: string }[];
}

export class InvestorFlowRefused extends Error {
  constructor(
    message: string,
    readonly reasons: readonly string[] = [],
  ) {
    super(message);
    this.name = 'InvestorFlowRefused';
  }
}

export class InvestorCredentialsService {
  private readonly pending = new Map<string, (r: CredentialOperationResult) => void>();

  constructor(private readonly deps: InvestorCredentialsDeps) {}

  // ---- investors --------------------------------------------------------------------------------------

  /** HUMAN Subject + private provider binding + private receiving binding + AUTHENTICATION (holder) key. */
  async registerInvestor(input: {
    readonly account: string;
    readonly walletRef?: string;
  }): Promise<{ did: CatenorDid; bindingRef: string; authenticationMethod: string }> {
    const did = generateCatenorDid(this.deps.ids.randomBytes(16));
    const bindingRef = `cbr-${Buffer.from(this.deps.ids.randomBytes(16)).toString('hex')}`;
    const subjectId = this.deps.ids.id('subject');
    await this.deps.uow.run(async (p) => {
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
      await this.audit(p, 'SUBJECT_CREATED', did, { subjectType: 'HUMAN', role: 'INVESTOR' });
      await this.audit(p, 'ACCOUNT_BINDING_CREATED', did, {
        purpose: 'DISTRIBUTION_RECEIVING',
        visibility: 'PRIVATE',
      });
    });
    const key = await provisionSubjectKey(this.deps, { did, subjectId, purpose: 'AUTHENTICATION' });
    await this.deps.uow.run(async (p) => {
      await this.audit(p, 'KEY_ADDED', did, { purpose: 'AUTHENTICATION' });
      await this.audit(p, 'DID_DOCUMENT_CREATED', did);
    });
    return { did, bindingRef, authenticationMethod: key.verificationMethod.id };
  }

  async attachApplicant(did: string, applicantId: string): Promise<void> {
    await this.deps.uow.run(async (p) => {
      const subject = await p.subjects.findSubjectByDid(did);
      if (!subject) throw new Error('unknown investor');
      await p.subjects.attachProviderReference(subject.id, 'INVESTOR', applicantId);
      await this.audit(p, 'PROVIDER_REFERENCES_ATTACHED', did, { role: 'INVESTOR' });
    });
  }

  /** The investor's private provider applicant id — for the operator's sandbox step only; never printed or published. */
  providerApplicant(did: string): Promise<string> {
    return this.deps.uow.run(async (p) => (await this.providerRef(p, did)).applicantId);
  }

  /** The investor's private receiving account (CAIP-10 address part). */
  receivingAccount(did: string): Promise<string> {
    return this.deps.uow.run(async (p) => addressOf(await this.binding(p, did)));
  }

  // ---- credentials ------------------------------------------------------------------------------------

  /**
   * Provider evidence → CRE INVESTOR_ELIGIBILITY (confidential) → if every fact is TRUE, the ACTIVE Trust Anchor
   * issues a CatenorInvestorEligibilityCredential. No PII in the credential: boolean claims + evidence commitment.
   */
  async issueInvestorCredential(input: {
    readonly trustAnchor: string;
    readonly investor: string;
  }): Promise<{ credential: VerifiableCredential; run: CredentialOperationResult }> {
    if (!(await this.deps.verifyTrustAnchor(input.trustAnchor)).TRUST_ANCHOR_VALID) {
      throw new InvestorFlowRefused('the credential issuer is not an ACTIVE Trust Anchor');
    }
    const provider = await this.deps.uow.run((p) => this.providerRef(p, input.investor));
    const runId = this.deps.ids.id('run');
    const sessionRef = this.deps.ids.id('credential-check');
    const run = await this.confidential('INVESTOR_ELIGIBILITY', runId, {
      sessionRef,
      runId,
      trustDomain: this.deps.trustDomain,
      subjectDid: input.investor,
      applicantId: provider.applicantId,
      bindingRef: provider.bindingRef,
      notAfter: rfc3339(new Date(this.deps.clock.now().getTime() + 10 * 60_000)),
    });
    const facts = (run.facts ?? {}) as Record<string, boolean | null>;
    const allTrue =
      run.status === 'OK' &&
      facts['INVESTOR_IDENTITY_VERIFIED'] === true &&
      facts['INVESTOR_AML_CLEAR'] === true &&
      facts['EVIDENCE_FRESH'] === true;
    if (!allTrue || !run.evidenceCommitment) {
      throw new InvestorFlowRefused('the current provider evidence does not support a credential', [
        run.code ?? 'FACTS_NOT_ALL_TRUE',
      ]);
    }
    const now = this.deps.clock.now();
    const id = this.deps.ids.id('urn:uuid');
    const credential = createCredential({
      id,
      type: INVESTOR_ELIGIBILITY_CREDENTIAL,
      issuer: input.trustAnchor,
      validFrom: rfc3339(now),
      validUntil: rfc3339(
        new Date(now.getTime() + (this.deps.credentialValidityDays ?? 90) * 86_400_000),
      ),
      credentialSubject: {
        id: input.investor,
        investorIdentityVerified: true,
        investorAmlClear: true,
        evidenceCommitment: run.evidenceCommitment,
      },
      statusId: `urn:catenor-one:status:${id.slice('urn:uuid:'.length)}`,
    });
    const proof = await signAs(this.deps, input.trustAnchor, { kind: 'CREDENTIAL', credential });
    const vc: VerifiableCredential = { ...credential, proof };
    await this.store(input.investor, 'INVESTOR_CREDENTIAL', vc.id, input.trustAnchor, vc);
    await this.deps.uow.run((p) =>
      this.audit(p, 'CREDENTIAL_ISSUED', input.investor, {
        credentialId: vc.id,
        credentialType: INVESTOR_ELIGIBILITY_CREDENTIAL,
        issuer: input.trustAnchor,
        evidenceCommitment: run.evidenceCommitment ?? null,
        confidentialMode: run.mode,
        credentialCommitment: commit(vc),
      }),
    );
    return { credential: vc, run };
  }

  /** The investor's latest recorded investor credential and its current recorded status. */
  async credentialOf(investor: string) {
    const docs = await this.documents<VerifiableCredential>(investor, 'INVESTOR_CREDENTIAL');
    return docs.at(-1);
  }

  /** The issuer signs a statement of the credential's CURRENT recorded status (fetched at evaluation time). */
  async statusStatement(investor: string): Promise<SignedCredentialStatusStatement> {
    const stored = await this.credentialOf(investor);
    if (!stored) throw new InvestorFlowRefused('the investor holds no credential');
    const statement = createStatusStatement({
      credential: stored.document,
      status: stored.status,
      checkedAt: rfc3339(this.deps.clock.now()),
    });
    const proof = await signAs(this.deps, stored.issuer, { kind: 'STATUS_STATEMENT', statement });
    return { ...statement, proof };
  }

  /** The investor (holder key) presents its credential for one verifier request (challenge + domain). */
  async present(input: {
    readonly investor: string;
    readonly challenge: string;
    readonly domain: string;
  }): Promise<VerifiablePresentation> {
    const stored = await this.credentialOf(input.investor);
    if (!stored) throw new InvestorFlowRefused('the investor holds no credential');
    const presentation = createPresentation({
      holder: input.investor,
      credentials: [stored.document],
    });
    const proof = await signAs(this.deps, input.investor, {
      kind: 'PRESENTATION',
      presentation,
      challenge: input.challenge,
      domain: input.domain,
    });
    return { ...presentation, proof };
  }

  /** The Trust Domain's issuer rules for the workflow config: the ACTIVE Trust Anchor's assertion key. */
  async acceptedIssuers(trustAnchor: string) {
    const key = await this.deps.uow.run((p) => subjectKey(p, trustAnchor, 'CREDENTIAL_ASSERTION'));
    return [
      {
        did: trustAnchor,
        verificationMethod: key.vmId,
        publicKeyMultibase: key.publicKeyMultibase,
        credentialTypes: [INVESTOR_ELIGIBILITY_CREDENTIAL],
      },
    ];
  }

  // ---- offering eligibility + investment -----------------------------------------------------------------

  /** Subscriptions → presentations (fresh challenge each) → CRE OFFERING_ELIGIBILITY → one protocol Decision each. */
  async evaluateOffering(input: {
    readonly sponsor: string;
    readonly offeringId: string;
    readonly subscriptions: readonly { readonly investor: string; readonly units: bigint }[];
  }): Promise<{ records: OfferingDecisionRecord[]; run: CredentialOperationResult }> {
    const offering = await this.deps.sponsor.findOffering(input.sponsor, input.offeringId);
    const verified = await this.deps.sponsor.verifyOffering(offering);
    if (!offering || verified.decision !== 'ALLOW') {
      throw new InvestorFlowRefused('the offering is not authoritative', [...verified.reasons]);
    }
    const subscriptions = [];
    for (const s of input.subscriptions) {
      const challenge = Buffer.from(this.deps.ids.randomBytes(16)).toString('hex');
      subscriptions.push({
        ...(await this.holderInput(s.investor, challenge, offering.id)),
        units: s.units.toString(),
        challenge,
      });
    }
    const runId = this.deps.ids.id('run');
    const sessionRef = this.deps.ids.id('offering-check');
    const run = await this.confidential('OFFERING_ELIGIBILITY', runId, {
      sessionRef,
      runId,
      trustDomain: this.deps.trustDomain,
      notAfter: rfc3339(new Date(this.deps.clock.now().getTime() + 10 * 60_000)),
      offering: {
        id: offering.id,
        policy: { id: OFFERING_ELIGIBILITY_POLICY_ID, hash: OFFERING_ELIGIBILITY_POLICY_HASH },
      },
      subscriptions,
    });
    if (run.status !== 'OK') {
      throw new InvestorFlowRefused('the confidential offering evaluation failed', [
        run.code ?? 'ERROR',
      ]);
    }
    const facts = run.facts as {
      offering: string;
      policy: { id: string; hash: string };
      results: (InvestorOutcome & { units: string })[];
    };
    if (
      facts.offering !== offering.id ||
      facts.policy.hash !== OFFERING_ELIGIBILITY_POLICY_HASH ||
      facts.results.length !== input.subscriptions.length ||
      !input.subscriptions.every((s, i) => facts.results[i]?.investor === s.investor)
    ) {
      throw new InvestorFlowRefused('the confidential result does not answer this request');
    }
    const records: OfferingDecisionRecord[] = [];
    for (const r of facts.results) {
      const decision = createDecision({
        policy: OFFERING_ELIGIBILITY_POLICY_ID,
        subject: r.investor,
        action: SUBSCRIBE_OFFERING,
        resource: offering.resource,
        decision: r.decision,
        evaluatedAt: rfc3339(this.deps.clock.now()),
        evidenceCommitment: run.evidenceCommitment as Commitment,
      });
      const record: OfferingDecisionRecord = {
        type: 'CatenorOneOfferingDecision',
        id: this.deps.ids.id('decision'),
        offeringId: offering.id,
        units: r.units,
        decision,
        decisionCommitment: commit(decision),
        outcome: {
          investor: r.investor,
          decision: r.decision,
          trace: r.trace,
          presentationChecks: r.presentationChecks,
          reconciliation: r.reconciliation,
          reasonCodes: r.reasonCodes,
        },
        confidentialRun: { runId, mode: run.mode, workflowId: this.deps.verifier.workflowId },
      };
      await this.store(r.investor, 'DECISION', record.id, 'catenor-one', record);
      await this.deps.uow.run((p) =>
        this.audit(p, 'OFFERING_ELIGIBILITY_EVALUATED', r.investor, {
          offeringId: offering.id,
          policy: OFFERING_ELIGIBILITY_POLICY_ID,
          decision: r.decision,
          units: r.units,
          trace: r.trace.map((t) => `${t.requirement}=${t.status}`),
          presentationChecks: Object.entries(r.presentationChecks).map(([k, v]) => `${k}=${v}`),
          confidentialMode: run.mode,
          evidenceCommitment: run.evidenceCommitment ?? null,
          decisionCommitment: record.decisionCommitment,
        }),
      );
      records.push(record);
    }
    return { records, run };
  }

  /**
   * Investment authorization (no generic mint): the investor's ALLOW offering Decision for exactly these units, not
   * used before, within the offering's total, AND the Sponsor's TOKENIZE_ASSET on the SPV resource. Returns what the
   * issuance executor may do: issue `units` to the investor's privately bound account.
   */
  async authorizeInvestment(input: {
    readonly sponsor: string;
    readonly offeringId: string;
    readonly investor: string;
  }): Promise<{
    record: OfferingDecisionRecord;
    offering: OfferingDefinition;
    units: bigint;
    tokenHolder: string;
    tokenizeGrantId: string;
  }> {
    const offering = await this.deps.sponsor.findOffering(input.sponsor, input.offeringId);
    if (!offering || (await this.deps.sponsor.verifyOffering(offering)).decision !== 'ALLOW') {
      throw new InvestorFlowRefused('the offering is not authoritative');
    }
    const records = await this.documents<OfferingDecisionRecord>(input.investor, 'DECISION');
    const record = records
      .map((d) => d.document)
      .filter((d) => d.type === 'CatenorOneOfferingDecision' && d.offeringId === input.offeringId)
      .at(-1);
    if (!record || record.decision.decision !== 'ALLOW') {
      throw new InvestorFlowRefused('no ALLOW offering Decision for this investor', [
        record ? 'OFFERING_DECISION_DENY' : 'OFFERING_DECISION_MISSING',
      ]);
    }
    const timeline = await this.deps.uow.run((p) => p.audit.timeline(this.deps.trustDomain));
    const executed = timeline.filter(
      (e) => e.type === 'INVESTMENT_EXECUTED' && e.details?.['offeringId'] === input.offeringId,
    );
    if (executed.some((e) => e.details?.['decisionRef'] === record.id)) {
      throw new InvestorFlowRefused('this Decision was already used for an issuance', [
        'DECISION_USED',
      ]);
    }
    const issued = executed.reduce((a, e) => a + BigInt(String(e.details?.['units'] ?? '0')), 0n);
    const units = BigInt(record.units);
    if (issued + units > BigInt(offering.asset.totalUnits)) {
      throw new InvestorFlowRefused('the issuance would exceed the offering total', [
        'OFFERING_TOTAL_EXCEEDED',
      ]);
    }
    const tokenize = await this.deps.sponsor.authorizeSponsorAction(
      input.sponsor,
      TOKENIZE_ASSET,
      offering.resource,
    );
    if (tokenize.decision !== 'ALLOW' || !tokenize.grantId) {
      throw new InvestorFlowRefused('the Sponsor may not tokenize this resource', [
        ...tokenize.reasons,
      ]);
    }
    const tokenHolder = await this.receivingAccount(input.investor);
    await this.deps.uow.run((p) =>
      this.audit(p, 'INVESTMENT_AUTHORIZED', input.investor, {
        offeringId: offering.id,
        decisionRef: record.id,
        decisionCommitment: record.decisionCommitment,
        units: units.toString(),
        tokenizeGrantId: tokenize.grantId ?? null,
      }),
    );
    return { record, offering, units, tokenHolder, tokenizeGrantId: tokenize.grantId };
  }

  async recordInvestmentExecuted(input: {
    readonly investor: string;
    readonly offeringId: string;
    readonly decisionRef: string;
    readonly units: bigint;
    readonly asset: string;
    readonly transactionId: string;
  }): Promise<void> {
    await this.deps.uow.run((p) =>
      this.audit(p, 'INVESTMENT_EXECUTED', input.investor, {
        offeringId: input.offeringId,
        decisionRef: input.decisionRef,
        units: input.units.toString(),
        asset: input.asset,
        network: 'hedera-testnet',
        transactionId: input.transactionId,
      }),
    );
  }

  // ---- revenue + confidential distribution ----------------------------------------------------------------

  /** Records a revenue event for the SPV resource (demo trigger; production: PMS / bank webhook / reconciliation). */
  async recordRevenue(input: {
    readonly spv: string;
    readonly resource: string;
    readonly amountWeibar: bigint;
    readonly source: string;
  }): Promise<{ revenueEventId: string }> {
    const revenueEventId = this.deps.ids.id('revenue-event');
    await this.deps.uow.run((p) =>
      this.audit(p, 'REVENUE_RECEIVED', input.spv, {
        revenueEventId,
        resource: input.resource,
        amountWeibar: input.amountWeibar.toString(),
        source: input.source,
      }),
    );
    return { revenueEventId };
  }

  async findRevenue(revenueEventId: string) {
    const timeline = await this.deps.uow.run((p) => p.audit.timeline(this.deps.trustDomain));
    const event = timeline.find(
      (e) => e.type === 'REVENUE_RECEIVED' && e.details?.['revenueEventId'] === revenueEventId,
    );
    return event
      ? {
          resource: String(event.details?.['resource']),
          amountWeibar: BigInt(String(event.details?.['amountWeibar'])),
        }
      : undefined;
  }

  /**
   * The Agent requests a distribution of a revenue event. Authorized through the delegated chain; the private inputs
   * are sealed to the TEE, which computes the plan; the minimized result is verified here and recorded. Nothing is
   * executed.
   */
  async computeConfidentialDistribution(input: {
    readonly agent: string;
    readonly resource: string;
    readonly asset: string;
    readonly revenueEventId: string;
    readonly investors: readonly string[];
    /** Holdings (units) per investor DID and where they came from (ATS READ-ONLY, or the authorized allocation). */
    readonly holdings: ReadonlyMap<string, bigint>;
    readonly holdingsSource: string;
  }): Promise<
    | { decision: 'DENY'; reasons: readonly CapabilityDenialReason[] }
    | { decision: 'ALLOW'; plan: ConfidentialPlanRecord; run: CredentialOperationResult }
  > {
    const grant = await this.deps.sponsor.agentGrant(
      input.agent,
      EXECUTE_DISTRIBUTION,
      input.resource,
    );
    const authorization = await this.deps.sponsor.authorizeDelegated({
      requester: input.agent,
      grant,
      action: EXECUTE_DISTRIBUTION,
      resource: input.resource,
    });
    if (authorization.decision === 'DENY') {
      await this.deps.uow.run((p) =>
        this.audit(p, 'DISTRIBUTION_REQUEST_DENIED', input.agent, {
          grantId: grant?.id ?? null,
          action: EXECUTE_DISTRIBUTION,
          resource: input.resource,
          reasons: [...authorization.reasons],
        }),
      );
      return { decision: 'DENY', reasons: authorization.reasons };
    }
    const revenue = await this.findRevenue(input.revenueEventId);
    if (!revenue || revenue.resource !== input.resource) {
      throw new InvestorFlowRefused('unknown revenue event for this resource');
    }
    const planId = this.deps.ids.id('distribution-plan');
    const challenge = Buffer.from(this.deps.ids.randomBytes(16)).toString('hex');
    const domain = `distribution:${input.resource}`;
    const units = input.investors.map((d) => input.holdings.get(d) ?? 0n);
    const total = units.reduce((a, b) => a + b, 0n);
    const share = (u: bigint) => (total === 0n ? 0n : (revenue.amountWeibar * u) / total);
    const blind = input.investors.map((d, i) => ({
      investor: d,
      proposedWeibar: share(units[i]!).toString(),
    }));
    const holders = [];
    for (const [i, investor] of input.investors.entries()) {
      holders.push({
        ...(await this.holderInput(investor, challenge, domain)),
        units: units[i]!.toString(),
      });
    }
    const runId = this.deps.ids.id('run');
    const run = await this.confidential('CONFIDENTIAL_DISTRIBUTION', runId, {
      sessionRef: planId,
      runId,
      trustDomain: this.deps.trustDomain,
      notAfter: rfc3339(new Date(this.deps.clock.now().getTime() + 10 * 60_000)),
      distribution: {
        resource: input.resource,
        asset: input.asset,
        revenueEventId: input.revenueEventId,
        revenueWeibar: revenue.amountWeibar.toString(),
        policy: {
          id: DISTRIBUTION_ELIGIBILITY_V2_POLICY_ID,
          hash: DISTRIBUTION_ELIGIBILITY_V2_POLICY_HASH,
        },
        challenge,
        domain,
      },
      holders,
    });
    if (run.status !== 'OK' || !run.evidenceCommitment || !isCommitment(run.evidenceCommitment)) {
      throw new InvestorFlowRefused('the confidential distribution failed', [run.code ?? 'ERROR']);
    }
    const f = run.facts as {
      plan: {
        resource: string;
        revenueEventId: string;
        revenueWeibar: string;
        policy: { hash: string };
      };
      holders: (InvestorOutcome & {
        units: string;
        shareWeibar: string;
        controlled: 'PAY' | 'HOLD';
      })[];
      payWeibar: string;
      heldWeibar: string;
    };
    // Catenor verifies the minimized result answers THIS request before anything may execute it.
    const consistent =
      f.plan.resource === input.resource &&
      f.plan.revenueEventId === input.revenueEventId &&
      f.plan.revenueWeibar === revenue.amountWeibar.toString() &&
      f.plan.policy.hash === DISTRIBUTION_ELIGIBILITY_V2_POLICY_HASH &&
      f.holders.length === input.investors.length &&
      f.holders.every(
        (h, i) =>
          h.investor === input.investors[i] &&
          h.units === units[i]!.toString() &&
          h.shareWeibar === share(units[i]!).toString() &&
          h.controlled === (h.decision === 'ALLOW' ? 'PAY' : 'HOLD'),
      ) &&
      BigInt(f.payWeibar) + BigInt(f.heldWeibar) <= revenue.amountWeibar &&
      BigInt(f.payWeibar) ===
        f.holders
          .filter((h) => h.controlled === 'PAY')
          .reduce((a, h) => a + BigInt(h.shareWeibar), 0n);
    if (!consistent) {
      throw new InvestorFlowRefused('the confidential result does not answer this request');
    }

    const planHolders: HolderPlan[] = [];
    for (const h of f.holders) {
      const decision = createDecision({
        policy: DISTRIBUTION_ELIGIBILITY_V2_POLICY_ID,
        subject: h.investor,
        action: RECEIVE_DISTRIBUTION_ACTION,
        resource: input.resource,
        decision: h.decision,
        evaluatedAt: rfc3339(this.deps.clock.now()),
        evidenceCommitment: run.evidenceCommitment,
      });
      const decisionCommitment = commit(decision);
      planHolders.push({
        investor: h.investor,
        decision: h.decision,
        trace: h.trace,
        presentationChecks: h.presentationChecks,
        reconciliation: h.reconciliation,
        reasonCodes: h.reasonCodes,
        units: h.units,
        shareWeibar: h.shareWeibar,
        controlled: h.controlled,
        decisionCommitment,
      });
      await this.deps.uow.run((p) =>
        this.audit(p, 'DISTRIBUTION_ELIGIBILITY_EVALUATED', h.investor, {
          planRef: planId,
          policy: DISTRIBUTION_ELIGIBILITY_V2_POLICY_ID,
          decision: h.decision,
          controlled: h.controlled,
          trace: h.trace.map((t) => `${t.requirement}=${t.status}`),
          reconciliation: h.reconciliation.credentialVsCurrent,
          confidentialMode: run.mode,
          computedIn: 'CRE_CONFIDENTIAL_WORKFLOW',
          evidenceCommitment: run.evidenceCommitment ?? null,
          decisionCommitment,
        }),
      );
    }
    const plan: ConfidentialPlanRecord = {
      type: 'CatenorOneConfidentialDistributionPlan',
      id: planId,
      agent: input.agent,
      resource: input.resource,
      asset: input.asset,
      revenueEventId: input.revenueEventId,
      revenueWeibar: revenue.amountWeibar.toString(),
      holdingsSource: input.holdingsSource,
      blind,
      holders: planHolders,
      payWeibar: f.payWeibar,
      heldWeibar: f.heldWeibar,
      policy: {
        id: DISTRIBUTION_ELIGIBILITY_V2_POLICY_ID,
        hash: DISTRIBUTION_ELIGIBILITY_V2_POLICY_HASH,
      },
      authorityChain: authorization.chain,
      confidentialRun: {
        runId,
        mode: run.mode,
        workflowId: this.deps.verifier.workflowId,
        evidenceCommitment: run.evidenceCommitment,
      },
      executed: [],
    };
    await this.store(input.agent, 'DISTRIBUTION_PLAN', plan.id, 'catenor-one', plan);
    await this.deps.uow.run((p) =>
      this.audit(p, 'DISTRIBUTION_PLAN_CREATED', input.agent, {
        planRef: planId,
        grantId: grant?.id ?? null,
        resource: input.resource,
        revenueEventId: input.revenueEventId,
        revenueWeibar: plan.revenueWeibar,
        payWeibar: plan.payWeibar,
        heldWeibar: plan.heldWeibar,
        paid: planHolders.filter((h) => h.controlled === 'PAY').map((h) => h.investor),
        held: planHolders.filter((h) => h.controlled === 'HOLD').map((h) => h.investor),
        computedIn: 'CRE_CONFIDENTIAL_WORKFLOW',
        confidentialMode: run.mode,
        executed: false,
      }),
    );
    return { decision: 'ALLOW', plan, run };
  }

  async findPlan(agent: string, planId: string): Promise<ConfidentialPlanRecord | undefined> {
    return (await this.documents<ConfidentialPlanRecord>(agent, 'DISTRIBUTION_PLAN')).find(
      (d) => d.id === planId,
    )?.document;
  }

  /** PAY/HOLD and amount exactly as the TEE-computed plan decided; recipient from the PRIVATE binding. */
  async approvedPayout(plan: ConfidentialPlanRecord, investor: string) {
    const holder = plan.holders.find((h) => h.investor === investor);
    if (!holder) throw new InvestorFlowRefused('the investor is not a holder in this plan');
    return {
      planRef: plan.id,
      investor,
      controlled: holder.controlled,
      approvedWeibar: holder.controlled === 'PAY' ? BigInt(holder.shareWeibar) : 0n,
      boundAccount: await this.receivingAccount(investor),
    };
  }

  async recordPayoutExecuted(input: {
    readonly agent: string;
    readonly planRef: string;
    readonly investor: string;
    readonly amountWeibar: bigint;
    readonly transactionId: string;
  }): Promise<void> {
    await this.deps.uow.run((p) =>
      this.audit(p, 'DISTRIBUTION_PAYOUT_EXECUTED', input.agent, {
        planRef: input.planRef,
        investor: input.investor,
        amountWeibar: input.amountWeibar.toString(),
        network: 'hedera-testnet',
        transactionId: input.transactionId,
      }),
    );
  }

  // ---- confidential runs ----------------------------------------------------------------------------------

  /** Delivery of an authenticated callback for one of this service's operations. */
  recordResult(result: CredentialOperationResult): Promise<{ accepted: boolean; reason?: string }> {
    const resolve = this.pending.get(result.runId);
    if (!resolve) return Promise.resolve({ accepted: false, reason: 'UNKNOWN_RUN' });
    this.pending.delete(result.runId);
    resolve(result);
    return Promise.resolve({ accepted: true });
  }

  private async confidential(
    operation: CredentialOperation,
    runId: string,
    context: { readonly runId: string; readonly sessionRef: string } & Record<string, unknown>,
  ): Promise<CredentialOperationResult> {
    const received = new Promise<CredentialOperationResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(runId);
        reject(new Error(`confidential run ${runId} (${operation}) timed out`));
      }, this.deps.resultTimeoutMs);
      this.pending.set(runId, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
    });
    await this.deps.verifier.request({ operation, runId, context });
    const result = await received;
    if (result.operation !== operation || result.sessionRef !== context.sessionRef) {
      return { ...result, status: 'ERROR', code: 'SESSION_MISMATCH' };
    }
    return result;
  }

  private async holderInput(investor: string, challenge: string, domain: string) {
    const [presentation, status, provider, key] = await Promise.all([
      this.present({ investor, challenge, domain }),
      this.statusStatement(investor),
      this.deps.uow.run((p) => this.providerRef(p, investor)),
      this.deps.uow.run((p) => subjectKey(p, investor, 'AUTHENTICATION')),
    ]);
    return {
      investor,
      presentation,
      holderKey: { verificationMethod: key.vmId, publicKeyMultibase: key.publicKeyMultibase },
      status,
      applicantId: provider.applicantId,
      bindingRef: provider.bindingRef,
    };
  }

  private async providerRef(p: PersistencePorts, did: string) {
    const subject = await p.subjects.findSubjectByDid(did);
    const binding = subject
      ? (await p.subjects.listProviderBindings(subject.id)).find((b) => b.role === 'INVESTOR')
      : undefined;
    if (!binding?.externalSubjectId) {
      throw new InvestorFlowRefused('investor applicant not attached');
    }
    return { applicantId: binding.externalSubjectId, bindingRef: binding.bindingRef };
  }

  private async binding(p: PersistencePorts, did: string): Promise<string> {
    const subject = await p.subjects.findSubjectByDid(did);
    const binding = subject
      ? await p.accountBindings.findAccountBinding(subject.id, 'DISTRIBUTION_RECEIVING')
      : undefined;
    if (!binding) throw new InvestorFlowRefused('investor has no receiving account binding');
    return binding.account;
  }

  private async store(
    subjectDid: string,
    kind: StoredDocument['kind'],
    id: string,
    issuer: string,
    document: unknown,
  ) {
    await this.deps.uow.run(async (p) => {
      const subject = await p.subjects.findSubjectByDid(subjectDid);
      if (!subject) throw new Error(`unknown subject ${subjectDid}`);
      await p.documents.saveDocument({ id, kind, subjectId: subject.id, issuer, document });
    });
  }

  private documents<T>(subjectDid: string, kind: StoredDocument['kind']) {
    return this.deps.uow.run(async (p) => {
      const subject = await p.subjects.findSubjectByDid(subjectDid);
      return subject ? p.documents.listDocuments<T>(subject.id, kind) : [];
    });
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
