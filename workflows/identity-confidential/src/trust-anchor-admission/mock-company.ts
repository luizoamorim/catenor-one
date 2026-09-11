// MockCompanyEvidenceFixture — SYNTHETIC MOCK company evidence (PLAN §20.7, D29–D31). No HTTP. The scenario comes
// only from the public workflow config (no per-run override); a fixed reviewDate literal is used (no runtime.now()
// to manufacture freshness). Labeled MOCK everywhere; never presented as Sumsub KYB.

export const MOCK_LABEL = 'MOCK — not Sumsub KYB';
export const MOCK_COMPANY_REFERENCE = /^mock:company-fixture:[A-Za-z0-9_-]+$/;

export const MOCK_SCENARIOS = [
  'MOCK_COMPANY_ACTIVE_GREEN',
  'MOCK_COMPANY_RED',
  'MOCK_COMPANY_INACTIVE',
  'MOCK_COMPANY_STALE',
  'MOCK_COMPANY_NOT_LINKED',
  'MOCK_COMPANY_BINDING_MISMATCH',
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

const FRESH_REVIEW_DATE = '2026-09-01 00:00:00+0000';
const STALE_REVIEW_DATE = '2025-09-01 00:00:00+0000';

export interface MockCompanyEvidence {
  readonly source: 'SYNTHETIC_MOCK';
  readonly label: string;
  /** Sumsub-shaped synthetic company applicant (all values synthetic). */
  readonly applicant: Record<string, unknown>;
  /** Synthetic registry status (the real source is the company check endpoint, T0.8b). */
  readonly registryStatus: string;
}

export function isMockScenario(value: string): value is MockScenario {
  return (MOCK_SCENARIOS as readonly string[]).includes(value);
}

export function mockCompanyEvidence(
  scenario: MockScenario,
  expected: {
    companyBindingRef: string;
    representativeApplicantId: string;
    levelName: string;
    authorityRole: string;
    activeRegistryStatus: string;
  },
): MockCompanyEvidence {
  const green = { reviewAnswer: 'GREEN' };
  const red = { reviewAnswer: 'RED', reviewRejectType: 'FINAL', rejectLabels: ['SANCTIONS'] };
  const linked = [{ applicantId: expected.representativeApplicantId, types: [expected.authorityRole] }];
  const applicant = {
    label: MOCK_LABEL,
    type: 'company',
    externalUserId:
      scenario === 'MOCK_COMPANY_BINDING_MISMATCH'
        ? 'mock-binding-ref-that-does-not-match'
        : expected.companyBindingRef,
    fixedInfo: {
      companyInfo: {
        companyName: 'MOCK Catenor Demo Holdings Ltd (SYNTHETIC)',
        beneficiaries: scenario === 'MOCK_COMPANY_NOT_LINKED' ? [] : linked,
      },
    },
    review: {
      levelName: expected.levelName,
      reviewStatus: 'completed',
      reviewDate: scenario === 'MOCK_COMPANY_STALE' ? STALE_REVIEW_DATE : FRESH_REVIEW_DATE,
      reviewResult: scenario === 'MOCK_COMPANY_RED' ? red : green,
    },
  };
  return {
    source: 'SYNTHETIC_MOCK',
    label: MOCK_LABEL,
    applicant,
    registryStatus:
      scenario === 'MOCK_COMPANY_INACTIVE' ? 'MOCK_INACTIVE' : expected.activeRegistryStatus,
  };
}
