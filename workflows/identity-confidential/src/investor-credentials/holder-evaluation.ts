// Shared per-investor evaluation for the clean-room operations OFFERING_ELIGIBILITY and CONFIDENTIAL_DISTRIBUTION
// (Catenor One [REF-IMPL]; Catenor semantics owned by the main session). Runs inside handlerInTee:
//
//   Verifiable Presentation (7 named checks: holder proof, credential signature, issuer authority, subject = holder,
//   validity window, status ACTIVE, well formed)  →  INVESTOR_PRESENTATION_VALID
//   current provider evidence (one REAL Sumsub sandbox GET, binding gate, N1–N6 normalization)
//     →  INVESTOR_IDENTITY_VERIFIED · INVESTOR_AML_CLEAR · EVIDENCE_FRESH
//   reconciliation: what the credential claims vs what the provider says NOW (explanatory, never a fact)
//
// The presentation, the credential, the applicant data and the provider response never leave the TEE: only check
// results, facts, sanitized reason codes, reconciliation classes and digests do.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { jcs, sumsubSignature } from '../trust-anchor-admission/commitment.js';
import { amlClear, fresh, reconcile, verifiedAtLevel } from '../trust-anchor-admission/facts.js';
import { normalizeApplicant } from '../trust-anchor-admission/normalize.js';
import { TtaError, type ReconciliationResult, type Tri } from '../trust-anchor-admission/types.js';
import type { TtaRuntime, TtaSecrets } from '../trust-anchor-admission/index.js';
import {
  documentHash,
  verifyPresentation,
  type AcceptedIssuer,
  type PresentationCheck,
} from '../credentials/verify-presentation.js';

export const INVESTOR_REQUIREMENTS = [
  'INVESTOR_PRESENTATION_VALID',
  'INVESTOR_IDENTITY_VERIFIED',
  'INVESTOR_AML_CLEAR',
  'EVIDENCE_FRESH',
] as const;
export type InvestorRequirement = (typeof INVESTOR_REQUIREMENTS)[number];

/** Public workflow config for credential-based operations (the Trust Domain's issuer rules + pinned policies). */
export interface CredentialRules {
  readonly credentialType: string;
  readonly acceptedIssuers: readonly AcceptedIssuer[];
  readonly maxStatusAgeSeconds: number;
  readonly policies: {
    readonly offering: PolicyDocument;
    readonly distribution: PolicyDocument;
  };
}

export interface PolicyDocument {
  readonly id: string;
  readonly action: string;
  readonly requirements: readonly { readonly claim: string; readonly equals: boolean }[];
  readonly decision: { readonly allRequirementsSatisfied: string; readonly otherwise: string };
}

/** One investor's private inputs, from the sealed context. */
export interface HolderInput {
  readonly investor: string;
  readonly presentation: unknown;
  readonly holderKey: unknown;
  readonly status: unknown;
  readonly applicantId: string;
  readonly bindingRef: string;
}

export interface HolderEvaluation {
  readonly facts: Record<InvestorRequirement, Tri>;
  readonly presentationChecks: Record<PresentationCheck, boolean>;
  /** Credential claims vs current provider evidence; provider observation class. */
  readonly reconciliation: {
    readonly credentialVsCurrent: 'CONSISTENT' | 'MISMATCH' | 'INCOMPLETE';
    readonly provider: ReconciliationResult;
  };
  readonly reasonCodes: readonly string[];
  /** Digests only (commitment input). */
  readonly digests: {
    readonly presentation: string;
    readonly status: string;
    readonly providerRef: string;
    readonly providerResponse: string | null;
  };
}

export const digest = (bytes: Uint8Array) => `0x${bytesToHex(sha256(bytes))}`;
const REASON = /^[A-Z][A-Z0-9_]{0,63}$/;

export function parseCredentialRules(raw: unknown): CredentialRules {
  const r = raw as Partial<CredentialRules> | undefined;
  if (
    !r ||
    typeof r.credentialType !== 'string' ||
    !Array.isArray(r.acceptedIssuers) ||
    typeof r.maxStatusAgeSeconds !== 'number' ||
    !r.policies?.offering ||
    !r.policies.distribution
  ) {
    throw new TtaError('CONFIG_INVALID');
  }
  return r as CredentialRules;
}

/** ALLOW iff every requirement's value is exactly its `equals` (true); FALSE and MISSING stay distinct. */
export function evaluatePolicy(policy: PolicyDocument, values: Record<string, Tri>) {
  const trace = policy.requirements.map(({ claim, equals }) => {
    const v = values[claim];
    const status = v === null || v === undefined ? 'MISSING' : v === equals ? 'TRUE' : 'FALSE';
    return { requirement: claim, status: status as 'TRUE' | 'FALSE' | 'MISSING' };
  });
  const failed = trace.filter((t) => t.status !== 'TRUE').map((t) => t.requirement);
  return {
    policy: policy.id,
    outcome: (failed.length === 0 ? 'ALLOW' : 'DENY') as 'ALLOW' | 'DENY',
    trace,
    failed,
  };
}

/** The policy evaluated in the TEE must be exactly the one the Catenor request pinned (e.g. the Sponsor's offering). */
export function pinnedPolicy(policy: PolicyDocument, expected: { id?: unknown; hash?: unknown }): string {
  const hash = documentHash(policy);
  if (expected.id !== policy.id || expected.hash !== hash) throw new TtaError('POLICY_PIN_MISMATCH');
  return hash;
}

export function parseHolder(raw: unknown): HolderInput {
  const h = raw as Partial<HolderInput> | undefined;
  if (
    !h ||
    typeof h.investor !== 'string' ||
    typeof h.applicantId !== 'string' ||
    h.applicantId.length === 0 ||
    typeof h.bindingRef !== 'string' ||
    h.bindingRef.length === 0
  ) {
    throw new TtaError('CONTEXT_INVALID');
  }
  return h as HolderInput;
}

export function evaluateHolder(input: {
  readonly holder: HolderInput;
  readonly challenge: string;
  readonly domain: string;
  readonly rules: CredentialRules;
  readonly investorEvidence: { readonly levelNames: readonly string[]; readonly evidenceMaxAgeDays: number };
  readonly sumsubBaseUrl: string;
  readonly secrets: TtaSecrets;
  readonly runtime: TtaRuntime;
}): HolderEvaluation {
  const { holder, runtime } = input;
  const now = runtime.now();
  const vp = verifyPresentation({
    presentation: holder.presentation,
    holderKey: holder.holderKey,
    challenge: input.challenge,
    domain: input.domain,
    credentialType: input.rules.credentialType,
    acceptedIssuers: input.rules.acceptedIssuers,
    status: holder.status,
    maxStatusAgeSeconds: input.rules.maxStatusAgeSeconds,
    now,
  });
  // The presentation's holder must be the investor Catenor asked about.
  const holderMatches =
    typeof (holder.presentation as { holder?: unknown })?.holder === 'string' &&
    (holder.presentation as { holder: string }).holder === holder.investor;
  const reasonCodes: string[] = vp.failed.map((c) => `FAILED_${c}`);
  if (!holderMatches) reasonCodes.push('PRESENTATION_NOT_FROM_INVESTOR');

  // Current provider evidence — the credential alone is not current truth.
  let identity: Tri = null;
  let aml: Tri = null;
  let isFresh: Tri = null;
  let provider: ReconciliationResult = 'INCOMPLETE';
  let responseDigest: string | null = null;
  try {
    const path = `/resources/applicants/${encodeURIComponent(holder.applicantId)}/one`;
    const ts = String(Math.floor(now.getTime() / 1000));
    const response = runtime.httpGet(`${input.sumsubBaseUrl}${path}`, {
      accept: 'application/json',
      'X-App-Token': input.secrets.sumsubAppToken,
      'X-App-Access-Ts': ts,
      'X-App-Access-Sig': sumsubSignature(input.secrets.sumsubSecretKey, ts, 'GET', path),
    });
    if (response.status !== 200) throw new TtaError(`SUMSUB_HTTP_${response.status}`);
    responseDigest = digest(response.body);
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder().decode(response.body));
    } catch {
      throw new TtaError('SUMSUB_RESPONSE_UNPARSEABLE');
    }
    const applicant = normalizeApplicant(raw);
    if (applicant.type !== 'individual' || applicant.externalUserId !== holder.bindingRef) {
      throw new TtaError('PROVIDER_BINDING_MISMATCH');
    }
    const amlResult = amlClear(applicant);
    identity = verifiedAtLevel(applicant, input.investorEvidence.levelNames);
    aml = amlResult.value;
    isFresh = fresh(applicant, now, input.investorEvidence.evidenceMaxAgeDays);
    provider = reconcile(applicant, now, input.investorEvidence.evidenceMaxAgeDays);
    reasonCodes.push(...applicant.reasonCodes, ...(amlResult.reason ? [amlResult.reason] : []));
  } catch (error) {
    // Fail closed for this investor only: its current-evidence facts stay MISSING (never coerced to true).
    reasonCodes.push(error instanceof TtaError ? error.code : 'PROVIDER_ERROR');
  }

  const claims = vp.claims;
  const credentialVsCurrent =
    !vp.checks.PRESENTATION_WELL_FORMED || identity === null || aml === null
      ? 'INCOMPLETE'
      : claims?.identityVerified === identity && claims?.amlClear === aml
        ? 'CONSISTENT'
        : 'MISMATCH';
  return {
    facts: {
      INVESTOR_PRESENTATION_VALID: vp.valid && holderMatches,
      INVESTOR_IDENTITY_VERIFIED: identity,
      INVESTOR_AML_CLEAR: aml,
      EVIDENCE_FRESH: isFresh,
    },
    presentationChecks: vp.checks,
    reconciliation: { credentialVsCurrent, provider },
    reasonCodes: [...new Set(reasonCodes)].filter((c) => REASON.test(c)).sort(),
    digests: {
      presentation: digest(utf8ToBytes(jcs(holder.presentation ?? null))),
      status: digest(utf8ToBytes(jcs(holder.status ?? null))),
      providerRef: digest(utf8ToBytes(holder.applicantId)),
      providerResponse: responseDigest,
    },
  };
}
