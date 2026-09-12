// Clean-room demo operations of identity-confidential (Catenor One [REF-IMPL]; Catenor semantics owned by the main
// session; CRE mechanics shared with the other operations in ../../workflow.ts and ../../shared/*).
//
// OFFERING_ELIGIBILITY — may each subscriber invest? For every subscription: Verifiable Presentation (7 checks) +
//   current Sumsub sandbox evidence → policy:offering-eligibility:v1 (the exact policy the Sponsor's offering pins).
//
// CONFIDENTIAL_DISTRIBUTION — the distribution itself is computed HERE, not in the API: revenue × units / total per
//   holder (integer weibar), then per holder the presentation + current evidence → policy:distribution-eligibility:v2
//   → PAY (ALLOW) or HOLD (DENY). Only the minimized executable conclusion leaves the TEE: per holder its DID, units,
//   share, decision, PAY/HOLD, requirement statuses, check results, reconciliation class and sanitized reason codes,
//   plus an evidence commitment over digests. Execution stays outside the TEE (Catenor verifies the Agent's authority;
//   the Agent's Privy wallet policy constrains the payout).
//
// HTTP budget: one Sumsub GET per investor + one callback POST (≤ 4 investors under the 5-call limit).
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { callbackHeaders, jcs } from '../trust-anchor-admission/commitment.js';
import { TtaError, type ExecutionMode } from '../trust-anchor-admission/types.js';
import type { TtaResult, TtaRuntime, TtaSecrets } from '../trust-anchor-admission/index.js';
import {
  digest,
  evaluateHolder,
  evaluatePolicy,
  parseCredentialRules,
  parseHolder,
  pinnedPolicy,
} from './holder-evaluation.js';

export const MAX_INVESTORS_PER_RUN = 4;
type Operation = 'OFFERING_ELIGIBILITY' | 'CONFIDENTIAL_DISTRIBUTION';

interface OperationInput {
  readonly runId: string;
  readonly context: Record<string, unknown>;
  readonly config: Record<string, unknown>;
  readonly secrets: TtaSecrets;
  readonly runtime: TtaRuntime;
}

export interface CredentialResultEnvelope {
  readonly v: 1;
  readonly operation: Operation;
  readonly runId: string;
  readonly sessionRef: string;
  readonly mode: ExecutionMode;
  readonly status: 'OK' | 'ERROR';
  readonly code?: string;
  readonly bootstrapConfigurationHash: string;
  readonly evidenceProfile: 'INVESTOR_CREDENTIAL_AND_SANDBOX';
  readonly evidenceSources: { readonly credential: 'CATENOR_VC'; readonly investor: 'REAL_SUMSUB_SANDBOX' };
  /** The minimized conclusion (checked against commitmentInput.facts by the Catenor callback authenticator). */
  readonly facts?: Record<string, unknown>;
  readonly evidenceCommitment?: string;
  readonly commitmentInput?: Record<string, unknown>;
}

const rfc3339 = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const str = (v: unknown, code = 'CONTEXT_INVALID'): string => {
  if (typeof v !== 'string' || v.length === 0) throw new TtaError(code);
  return v;
};

function baseOf(operation: Operation, input: OperationInput) {
  return {
    v: 1 as const,
    operation,
    runId: input.runId,
    sessionRef: typeof input.context.sessionRef === 'string' ? input.context.sessionRef : '',
    mode: (input.config.executionMode === 'DEPLOYED' ? 'DEPLOYED' : 'SIMULATION') as ExecutionMode,
    bootstrapConfigurationHash:
      typeof input.config.bootstrapConfigurationHash === 'string' ? input.config.bootstrapConfigurationHash : '',
    evidenceProfile: 'INVESTOR_CREDENTIAL_AND_SANDBOX' as const,
    evidenceSources: { credential: 'CATENOR_VC' as const, investor: 'REAL_SUMSUB_SANDBOX' as const },
  };
}

function common(input: OperationInput) {
  const c = input.config as {
    sumsubBaseUrl?: unknown;
    investorEvidence?: { levelNames?: unknown; evidenceMaxAgeDays?: unknown };
    credentialRules?: unknown;
  };
  if (
    typeof c.sumsubBaseUrl !== 'string' ||
    !c.investorEvidence ||
    !Array.isArray(c.investorEvidence.levelNames) ||
    typeof c.investorEvidence.evidenceMaxAgeDays !== 'number'
  ) {
    throw new TtaError('CONFIG_INVALID');
  }
  const rules = parseCredentialRules(c.credentialRules);
  if (str(input.context.runId) !== input.runId) throw new TtaError('CONTEXT_INVALID');
  str(input.context.sessionRef);
  str(input.context.trustDomain);
  const notAfter = Date.parse(str(input.context.notAfter));
  if (Number.isNaN(notAfter) || input.runtime.now().getTime() > notAfter) throw new TtaError('CONTEXT_EXPIRED');
  return {
    sumsubBaseUrl: c.sumsubBaseUrl,
    investorEvidence: c.investorEvidence as { levelNames: string[]; evidenceMaxAgeDays: number },
    rules,
  };
}

function seal(
  base: ReturnType<typeof baseOf>,
  input: OperationInput,
  facts: Record<string, unknown>,
  inputs: Record<string, unknown>,
): CredentialResultEnvelope {
  const commitmentInput = {
    profile: 'catenor-one/evidence-commitment/v1',
    operation: base.operation,
    runId: base.runId,
    sessionRef: base.sessionRef,
    trustDomain: input.context.trustDomain,
    bootstrapConfigurationHash: base.bootstrapConfigurationHash,
    providerEnvironment: 'sandbox',
    observedAt: rfc3339(input.runtime.now()),
    evidenceProfile: base.evidenceProfile,
    evidenceSources: base.evidenceSources,
    inputs,
    facts,
  };
  const salt = `0x${bytesToHex(hmac(sha256, input.secrets.saltKey, utf8ToBytes(base.runId)))}`;
  return {
    ...base,
    status: 'OK',
    facts,
    evidenceCommitment: digest(utf8ToBytes(jcs({ ...commitmentInput, salt }))),
    commitmentInput,
  };
}

/** OFFERING_ELIGIBILITY: one decision per subscription. */
export function evaluateOffering(input: OperationInput): CredentialResultEnvelope {
  const base = baseOf('OFFERING_ELIGIBILITY', input);
  try {
    const cfg = common(input);
    const offering = input.context.offering as Record<string, unknown> | undefined;
    const subscriptions = input.context.subscriptions;
    if (!offering || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      throw new TtaError('CONTEXT_INVALID');
    }
    if (subscriptions.length > MAX_INVESTORS_PER_RUN) throw new TtaError('TOO_MANY_INVESTORS');
    const policy = cfg.rules.policies.offering;
    const policyHash = pinnedPolicy(policy, offering.policy as { id?: unknown; hash?: unknown });
    const offeringId = str(offering.id);
    const results = [];
    const inputs = [];
    for (const raw of subscriptions) {
      const holder = parseHolder(raw);
      const units = str((raw as { units?: unknown }).units);
      if (!/^[1-9]\d{0,17}$/.test(units)) throw new TtaError('CONTEXT_INVALID');
      const e = evaluateHolder({
        holder,
        challenge: str((raw as { challenge?: unknown }).challenge),
        domain: offeringId,
        rules: cfg.rules,
        investorEvidence: cfg.investorEvidence,
        sumsubBaseUrl: cfg.sumsubBaseUrl,
        secrets: input.secrets,
        runtime: input.runtime,
      });
      const evaluation = evaluatePolicy(policy, e.facts);
      results.push({
        investor: holder.investor,
        units,
        decision: evaluation.outcome,
        trace: evaluation.trace,
        presentationChecks: e.presentationChecks,
        reconciliation: e.reconciliation,
        reasonCodes: e.reasonCodes,
      });
      inputs.push({ investor: holder.investor, ...e.digests });
    }
    const facts = { offering: offeringId, policy: { id: policy.id, hash: policyHash }, results };
    return seal(base, input, facts, { subscriptions: inputs });
  } catch (error) {
    return { ...base, status: 'ERROR', code: error instanceof TtaError ? error.code : 'INTERNAL_ERROR' };
  }
}

/** CONFIDENTIAL_DISTRIBUTION: the pro-rata computation and PAY/HOLD per holder, inside the TEE. */
export function computeDistribution(input: OperationInput): CredentialResultEnvelope {
  const base = baseOf('CONFIDENTIAL_DISTRIBUTION', input);
  try {
    const cfg = common(input);
    const d = input.context.distribution as Record<string, unknown> | undefined;
    const holdersRaw = input.context.holders;
    if (!d || !Array.isArray(holdersRaw) || holdersRaw.length === 0) throw new TtaError('CONTEXT_INVALID');
    if (holdersRaw.length > MAX_INVESTORS_PER_RUN) throw new TtaError('TOO_MANY_INVESTORS');
    const policy = cfg.rules.policies.distribution;
    const policyHash = pinnedPolicy(policy, d.policy as { id?: unknown; hash?: unknown });
    const revenue = str(d.revenueWeibar);
    if (!/^[1-9]\d{0,36}$/.test(revenue)) throw new TtaError('CONTEXT_INVALID');
    const revenueWeibar = BigInt(revenue);
    const challenge = str(d.challenge);
    const domain = str(d.domain);
    const parsed = holdersRaw.map((raw) => {
      const units = str((raw as { units?: unknown }).units);
      if (!/^(0|[1-9]\d{0,17})$/.test(units)) throw new TtaError('CONTEXT_INVALID');
      return { holder: parseHolder(raw), units: BigInt(units) };
    });
    if (new Set(parsed.map((p) => p.holder.investor)).size !== parsed.length) throw new TtaError('CONTEXT_INVALID');
    const totalUnits = parsed.reduce((a, p) => a + p.units, 0n);
    if (totalUnits === 0n) throw new TtaError('NO_HOLDINGS');

    const holders = [];
    const inputs = [];
    let payWeibar = 0n;
    let heldWeibar = 0n;
    for (const { holder, units } of parsed) {
      const share = (revenueWeibar * units) / totalUnits;
      const e = evaluateHolder({
        holder,
        challenge,
        domain,
        rules: cfg.rules,
        investorEvidence: cfg.investorEvidence,
        sumsubBaseUrl: cfg.sumsubBaseUrl,
        secrets: input.secrets,
        runtime: input.runtime,
      });
      const evaluation = evaluatePolicy(policy, { HOLDS_ASSET: units > 0n, ...e.facts });
      const controlled = evaluation.outcome === 'ALLOW' ? 'PAY' : 'HOLD';
      if (controlled === 'PAY') payWeibar += share;
      else heldWeibar += share;
      holders.push({
        investor: holder.investor,
        units: units.toString(),
        shareWeibar: share.toString(),
        decision: evaluation.outcome,
        controlled,
        trace: evaluation.trace,
        presentationChecks: e.presentationChecks,
        reconciliation: e.reconciliation,
        reasonCodes: e.reasonCodes,
      });
      inputs.push({ investor: holder.investor, ...e.digests });
    }
    const facts = {
      plan: {
        resource: str(d.resource),
        asset: str(d.asset),
        revenueEventId: str(d.revenueEventId),
        revenueWeibar: revenueWeibar.toString(),
        totalUnits: totalUnits.toString(),
        policy: { id: policy.id, hash: policyHash },
      },
      holders,
      payWeibar: payWeibar.toString(),
      heldWeibar: heldWeibar.toString(),
      undistributedWeibar: (revenueWeibar - payWeibar - heldWeibar).toString(),
    };
    return seal(base, input, facts, { holders: inputs });
  } catch (error) {
    return { ...base, status: 'ERROR', code: error instanceof TtaError ? error.code : 'INTERNAL_ERROR' };
  }
}

/** Entry point from workflow.ts inside handlerInTee: evaluate, then deliver the authenticated callback. */
export function runCredentialOperation(operation: Operation, input: OperationInput): TtaResult {
  const envelope = operation === 'OFFERING_ELIGIBILITY' ? evaluateOffering(input) : computeDistribution(input);
  input.runtime.log(operation === 'OFFERING_ELIGIBILITY' ? 'offering_evaluated' : 'distribution_computed', {
    status: envelope.status,
    code: envelope.code ?? 'OK',
  });
  const body = utf8ToBytes(JSON.stringify(envelope));
  const timestamp = rfc3339(input.runtime.now());
  try {
    const { status } = input.runtime.httpPost(
      String(input.config.callbackUrl),
      callbackHeaders(input.secrets.callbackKey, timestamp, body),
      body,
    );
    return status >= 200 && status < 300
      ? { status: 'DELIVERED', code: envelope.code ?? 'OK' }
      : { status: 'FAILED', code: `CALLBACK_HTTP_${status}` };
  } catch {
    return { status: 'FAILED', code: 'CALLBACK_UNREACHABLE' };
  }
}
