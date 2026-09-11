// investor-eligibility — final-demo operation of the identity-confidential workflow (Catenor One [REF-IMPL],
// FINAL-DEMO FD-6/FD-7). Owned by the Catenor One main session (Catenor semantics); CRE mechanics (secrets, sealed
// context, HTTPClient, handlerInTee) are shared with trust-anchor-admission in ../../workflow.ts and ../../shared/*.
//
// Question answered inside the TEE: is this investor's CURRENT identity evidence acceptable for receiving a regulated
// distribution? One REAL Sumsub sandbox GET /resources/applicants/{id}/one for the investor's individual applicant →
// binding gate (externalUserId == bindingRef, type individual) → N1–N6 normalization → three deterministic facts →
// minimal reconciliation → evidence commitment → authenticated callback. The raw provider response never leaves the
// TEE; only facts, sanitized reason codes, the reconciliation class and the commitment do. Holding tokens is not an
// input here: ownership ≠ current eligibility. Catenor's policy (API side) turns the facts into ALLOW / DENY.
// Errors at any step → status ERROR with a code and NO facts (fail closed).
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { callbackHeaders, jcs, sumsubSignature } from '../trust-anchor-admission/commitment.js';
import { amlClear, fresh, reconcile, verifiedAtLevel } from '../trust-anchor-admission/facts.js';
import { normalizeApplicant } from '../trust-anchor-admission/normalize.js';
import {
  TtaError,
  type ExecutionMode,
  type ReconciliationResult,
  type Tri,
} from '../trust-anchor-admission/types.js';
import type { TtaResult, TtaRuntime, TtaSecrets } from '../trust-anchor-admission/index.js';

export const INVESTOR_ELIGIBILITY_FACTS = [
  'INVESTOR_IDENTITY_VERIFIED',
  'INVESTOR_AML_CLEAR',
  'EVIDENCE_FRESH',
] as const;
export type InvestorFactName = (typeof INVESTOR_ELIGIBILITY_FACTS)[number];

/** Sealed private context for one investor check. */
export interface InvestorContext {
  readonly sessionRef: string;
  readonly runId: string;
  readonly trustDomain: string;
  readonly subjectDid: string;
  readonly applicantId: string;
  readonly bindingRef: string;
  readonly notAfter: string;
}

/** Public [REF-IMPL] acceptance rules for individual investor evidence (workflow config `investorEvidence`). */
export interface InvestorEvidenceRules {
  readonly levelNames: readonly string[];
  readonly evidenceMaxAgeDays: number;
}

export interface InvestorResultEnvelope {
  readonly v: 1;
  readonly operation: 'INVESTOR_ELIGIBILITY';
  readonly runId: string;
  readonly sessionRef: string;
  readonly mode: ExecutionMode;
  readonly status: 'OK' | 'ERROR';
  readonly code?: string;
  readonly bootstrapConfigurationHash: string;
  readonly evidenceProfile: 'INVESTOR_INDIVIDUAL_SANDBOX';
  readonly evidenceSources: { readonly investor: 'REAL_SUMSUB_SANDBOX' };
  readonly facts?: Record<InvestorFactName, Tri>;
  readonly factReasons?: Partial<Record<InvestorFactName, string[]>>;
  readonly reconciliation?: { investor: ReconciliationResult };
  readonly evidenceCommitment?: string;
  /** commitmentInput minus the salt (same scheme as trust-anchor-admission, PLAN §23). */
  readonly commitmentInput?: Record<string, unknown>;
}

const CONTEXT_FIELDS = [
  'sessionRef',
  'runId',
  'trustDomain',
  'subjectDid',
  'applicantId',
  'bindingRef',
  'notAfter',
] as const;
const rfc3339 = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const digest = (bytes: Uint8Array) => `0x${bytesToHex(sha256(bytes))}`;

function parseContext(runId: string, raw: Record<string, unknown>): InvestorContext {
  for (const field of CONTEXT_FIELDS) {
    if (typeof raw[field] !== 'string' || (raw[field] as string).length === 0) {
      throw new TtaError('CONTEXT_INVALID');
    }
  }
  if (raw.runId !== runId) throw new TtaError('CONTEXT_INVALID');
  return raw as unknown as InvestorContext;
}

function parseConfig(raw: Record<string, unknown>) {
  const c = raw as {
    callbackUrl?: unknown;
    sumsubBaseUrl?: unknown;
    executionMode?: unknown;
    bootstrapConfigurationHash?: unknown;
    investorEvidence?: InvestorEvidenceRules;
  };
  const rules = c.investorEvidence;
  if (
    typeof c.callbackUrl !== 'string' ||
    typeof c.sumsubBaseUrl !== 'string' ||
    (c.executionMode !== 'SIMULATION' && c.executionMode !== 'DEPLOYED') ||
    typeof c.bootstrapConfigurationHash !== 'string' ||
    !rules ||
    !Array.isArray(rules.levelNames) ||
    typeof rules.evidenceMaxAgeDays !== 'number'
  ) {
    throw new TtaError('CONFIG_INVALID');
  }
  return {
    callbackUrl: c.callbackUrl,
    sumsubBaseUrl: c.sumsubBaseUrl,
    executionMode: c.executionMode as ExecutionMode,
    bootstrapConfigurationHash: c.bootstrapConfigurationHash,
    rules,
  };
}

/** Builds the result envelope for one investor check (no I/O except the one Sumsub sandbox GET). */
export function evaluateInvestor(input: {
  runId: string;
  context: Record<string, unknown>;
  config: Record<string, unknown>;
  secrets: TtaSecrets;
  runtime: TtaRuntime;
}): InvestorResultEnvelope {
  const base = {
    v: 1 as const,
    operation: 'INVESTOR_ELIGIBILITY' as const,
    runId: input.runId,
    sessionRef: typeof input.context.sessionRef === 'string' ? input.context.sessionRef : '',
    mode: (input.config.executionMode === 'DEPLOYED' ? 'DEPLOYED' : 'SIMULATION') as ExecutionMode,
    bootstrapConfigurationHash:
      typeof input.config.bootstrapConfigurationHash === 'string'
        ? input.config.bootstrapConfigurationHash
        : '',
    evidenceProfile: 'INVESTOR_INDIVIDUAL_SANDBOX' as const,
    evidenceSources: { investor: 'REAL_SUMSUB_SANDBOX' as const },
  };
  try {
    const config = parseConfig(input.config);
    const context = parseContext(input.runId, input.context);
    const path = `/resources/applicants/${encodeURIComponent(context.applicantId)}/one`;
    const ts = String(Math.floor(input.runtime.now().getTime() / 1000));
    const response = input.runtime.httpGet(`${config.sumsubBaseUrl}${path}`, {
      accept: 'application/json',
      'X-App-Token': input.secrets.sumsubAppToken,
      'X-App-Access-Ts': ts,
      'X-App-Access-Sig': sumsubSignature(input.secrets.sumsubSecretKey, ts, 'GET', path),
    });
    if (response.status !== 200) throw new TtaError(`SUMSUB_HTTP_${response.status}`);
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder().decode(response.body));
    } catch {
      throw new TtaError('SUMSUB_RESPONSE_UNPARSEABLE');
    }
    const investor = normalizeApplicant(raw);
    // Binding gate before any derivation: this applicant must be the one bound to this investor subject.
    if (investor.type !== 'individual' || investor.externalUserId !== context.bindingRef) {
      throw new TtaError('PROVIDER_BINDING_MISMATCH');
    }
    const now = input.runtime.now();
    const aml = amlClear(investor);
    const facts: Record<InvestorFactName, Tri> = {
      INVESTOR_IDENTITY_VERIFIED: verifiedAtLevel(investor, config.rules.levelNames),
      INVESTOR_AML_CLEAR: aml.value,
      EVIDENCE_FRESH: fresh(investor, now, config.rules.evidenceMaxAgeDays),
    };
    const factReasons: Partial<Record<InvestorFactName, string[]>> = {};
    if (investor.reasonCodes.length > 0) {
      factReasons.INVESTOR_IDENTITY_VERIFIED = [...investor.reasonCodes];
      factReasons.INVESTOR_AML_CLEAR = [...investor.reasonCodes, ...(aml.reason ? [aml.reason] : [])];
    }
    const commitmentInput = {
      profile: 'catenor-one/evidence-commitment/v1',
      operation: 'INVESTOR_ELIGIBILITY',
      runId: context.runId,
      sessionRef: context.sessionRef,
      trustDomain: context.trustDomain,
      subject: context.subjectDid,
      bootstrapConfigurationHash: config.bootstrapConfigurationHash,
      providerEnvironment: 'sandbox',
      observedAt: rfc3339(now),
      evidenceProfile: base.evidenceProfile,
      evidenceSources: base.evidenceSources,
      acceptedInvestorEvidence: config.rules,
      providerRefDigests: { investor: digest(utf8ToBytes(context.applicantId)) },
      responseDigests: { investorApplicant: digest(response.body) },
      reasonCodes: { investor: investor.reasonCodes },
      facts,
    };
    const salt = `0x${bytesToHex(hmac(sha256, input.secrets.saltKey, utf8ToBytes(context.runId)))}`;
    return {
      ...base,
      status: 'OK',
      facts,
      factReasons,
      reconciliation: { investor: reconcile(investor, now, config.rules.evidenceMaxAgeDays) },
      evidenceCommitment: digest(utf8ToBytes(jcs({ ...commitmentInput, salt }))),
      commitmentInput,
    };
  } catch (error) {
    const code = error instanceof TtaError ? error.code : 'INTERNAL_ERROR';
    return { ...base, status: 'ERROR', code };
  }
}

/** Entry point called by workflow.ts inside handlerInTee: evaluate, then deliver the authenticated callback. */
export function runInvestorEligibility(input: {
  runId: string;
  context: Record<string, unknown>;
  config: Record<string, unknown>;
  secrets: TtaSecrets;
  runtime: TtaRuntime;
}): TtaResult {
  const envelope = evaluateInvestor(input);
  input.runtime.log('investor_evaluated', { status: envelope.status, code: envelope.code ?? 'OK' });
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
