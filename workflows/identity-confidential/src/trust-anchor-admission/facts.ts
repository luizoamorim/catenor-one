// Provider-binding gate, deterministic fact derivation (PLAN §20.4, D26–D28, D32) and the explanatory minimal
// reconciliation (Delivery plan 2026-09-11-006). Fact derivation never branches on the evidence source.
import type { NormalizedApplicant } from './normalize.js';
import type {
  AcceptedEvidence,
  EvidenceFactName,
  PrivateContext,
  ReconciliationResult,
  Tri,
} from './types.js';

/** Kleene AND: any false → false; else any MISSING → MISSING; else true. */
const and = (...values: Tri[]): Tri =>
  values.includes(false) ? false : values.includes(null) ? null : true;

const DAY_MS = 86_400_000;

/** PLAN §17.4 step 5: externalUserId == bindingRef and the expected applicant types, before any derivation. */
export function bindingGatePasses(
  company: NormalizedApplicant,
  representative: NormalizedApplicant,
  context: PrivateContext,
): boolean {
  return (
    company.type === 'company' &&
    company.externalUserId === context.companyBindingRef &&
    representative.type === 'individual' &&
    representative.externalUserId === context.representativeBindingRef
  );
}

/** completed ∧ GREEN ∧ accepted level → true; RED / not completed / other level → false; unparseable → null. */
function verifiedAtLevel(a: NormalizedApplicant, acceptedLevels: readonly string[]): Tri {
  if (a.reviewStatus === null) return null;
  if (a.reviewStatus !== 'completed') return false; // pending, queued, onHold, awaitingUser, init …
  if (a.reviewAnswer === null || a.levelName === null) return null;
  return a.reviewAnswer === 'GREEN' && acceptedLevels.includes(a.levelName);
}

/** D32 (+ N6 correction): the AML rule consults no label list. */
function amlClear(company: NormalizedApplicant): { value: Tri; reason?: string } {
  if (company.reviewStatus === null) return { value: null };
  if (company.reviewStatus !== 'completed') return { value: false };
  if (company.reviewAnswer === 'RED') return { value: false };
  if (company.reviewAnswer !== 'GREEN' || company.rejectLabels === null) return { value: null };
  return company.rejectLabels.length === 0
    ? { value: true }
    : { value: null, reason: 'INCONSISTENT_PROVIDER_STATE' };
}

function fresh(a: NormalizedApplicant, now: Date, maxAgeDays: number): Tri {
  if (a.reviewDate === null) return null; // N4: absent / unparseable → MISSING
  return now.getTime() - a.reviewDate.getTime() <= maxAgeDays * DAY_MS;
}

export interface DerivedFacts {
  readonly facts: Record<EvidenceFactName, Tri>;
  readonly factReasons: Partial<Record<EvidenceFactName, string[]>>;
}

/** PLAN §20.4 — called only after the binding gate passed. */
export function deriveFacts(input: {
  company: NormalizedApplicant;
  registryStatus: string | null;
  representative: NormalizedApplicant;
  context: PrivateContext;
  accepted: AcceptedEvidence;
  now: Date;
}): DerivedFacts {
  const { company, representative, context, accepted, now } = input;
  const kyb = verifiedAtLevel(company, accepted.companyLevelNames);
  const representativeVerified = verifiedAtLevel(representative, accepted.representativeLevelNames);
  const aml = amlClear(company);
  // Registry status ∈ activeRegistryStatuses. The inactive-entity reject-label source is defined only with real
  // company KYB (T0.8b); none exists for the MOCK fixture.
  const statusValid: Tri =
    input.registryStatus === null ? null : accepted.activeRegistryStatuses.includes(input.registryStatus);
  const linkage: Tri =
    company.beneficiaries === null
      ? null
      : company.beneficiaries.some(
          (b) =>
            b.applicantId === context.representativeApplicantId &&
            b.types.some((t) => accepted.authorityRoles.includes(t)),
        );
  // Reverse membership "where available": only an exposed, non-empty memberOf can contradict the linkage.
  const reverse: Tri =
    representative.memberOf === null || representative.memberOf.length === 0
      ? true
      : representative.memberOf.includes(context.companyApplicantId);

  const facts: Record<EvidenceFactName, Tri> = {
    ORGANIZATION_KYB_VERIFIED: kyb,
    ORGANIZATION_STATUS_VALID: statusValid,
    ORGANIZATION_AML_CLEAR: aml.value,
    AUTHORIZED_REPRESENTATIVE_VERIFIED: representativeVerified,
    REPRESENTATIVE_AUTHORITY_CONFIRMED: and(linkage, reverse, kyb, representativeVerified),
    EVIDENCE_FRESH: and(
      fresh(company, now, accepted.evidenceMaxAgeDays),
      fresh(representative, now, accepted.evidenceMaxAgeDays),
    ),
  };
  const factReasons: Partial<Record<EvidenceFactName, string[]>> = {};
  const companyCodes = [...company.reasonCodes, ...(aml.reason ? [aml.reason] : [])];
  if (companyCodes.length > 0) factReasons.ORGANIZATION_AML_CLEAR = companyCodes;
  if (company.reasonCodes.length > 0) factReasons.ORGANIZATION_KYB_VERIFIED = [...company.reasonCodes];
  if (representative.reasonCodes.length > 0) {
    factReasons.AUTHORIZED_REPRESENTATIVE_VERIFIED = [...representative.reasonCodes];
  }
  return { facts, factReasons };
}

/** Explanatory classification of one observation — never a policy fact (Delivery plan, minimal reconciliation). */
export function reconcile(a: NormalizedApplicant, now: Date, maxAgeDays: number): ReconciliationResult {
  if (a.reviewStatus !== 'completed' || a.reviewAnswer === null) return 'INCOMPLETE';
  if (a.reviewAnswer === 'RED') return 'MISMATCH';
  const isFresh = fresh(a, now, maxAgeDays);
  if (isFresh === null) return 'INCOMPLETE';
  return isFresh ? 'CONSISTENT' : 'STALE';
}
