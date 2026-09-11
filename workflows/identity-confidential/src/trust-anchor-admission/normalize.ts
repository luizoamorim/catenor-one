// Sumsub applicant normalization (PLAN §20.8 N1–N6, fields confirmed by T0.8). Allowlisted fields only;
// unknown fields are ignored; unparseable → null (MISSING). `review.reprocessing` is ignored entirely (N3).

export interface NormalizedApplicant {
  readonly type: 'company' | 'individual' | null;
  readonly externalUserId: string | null;
  readonly levelName: string | null;
  readonly reviewStatus: string | null;
  readonly reviewAnswer: 'GREEN' | 'RED' | null;
  /** N1: [] on completed GREEN without labels; N2: null (MISSING) when absent in any other state. */
  readonly rejectLabels: readonly string[] | null;
  readonly reviewRejectType: string | null;
  /** N4: the only freshness source; `YYYY-MM-DD HH:MM:SS+0000`. */
  readonly reviewDate: Date | null;
  /** N5: sanitized reason codes (rejection labels and reject type), private only. */
  readonly reasonCodes: readonly string[];
  /** Company only: beneficiaries from fixedInfo / info companyInfo. */
  readonly beneficiaries: readonly { applicantId: string; types: readonly string[] }[] | null;
  /** Individual only: reverse membership where the provider exposes it. */
  readonly memberOf: readonly string[] | null;
}

const REASON_CODE = /^[A-Z_]{1,64}$/;
const REVIEW_DATE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\+0000$/;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

export function parseReviewDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const m = REVIEW_DATE.exec(value);
  if (m === null) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number) as number[];
  const date = new Date(Date.UTC(y!, mo! - 1, d!, h!, mi!, s!));
  return Number.isNaN(date.getTime()) || date.getUTCDate() !== d ? null : date;
}

function beneficiariesOf(raw: Record<string, unknown>) {
  const lists = [raw.fixedInfo, raw.info]
    .map((i) => (isRecord(i) && isRecord(i.companyInfo) ? i.companyInfo.beneficiaries : undefined))
    .filter((b) => b !== undefined);
  if (lists.length === 0) return null;
  const out: { applicantId: string; types: string[] }[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) return null;
    for (const b of list) {
      if (!isRecord(b) || str(b.applicantId) === null) continue;
      const types = Array.isArray(b.types) ? b.types.filter((t): t is string => typeof t === 'string') : [];
      out.push({ applicantId: b.applicantId as string, types });
    }
  }
  return out;
}

function memberOfOf(raw: Record<string, unknown>): string[] | null {
  if (!Array.isArray(raw.memberOf)) return null;
  return raw.memberOf
    .map((m) => (isRecord(m) ? str(m.applicantId) : null))
    .filter((id): id is string => id !== null);
}

export function normalizeApplicant(raw: unknown): NormalizedApplicant {
  const root = isRecord(raw) ? raw : {};
  const review = isRecord(root.review) ? root.review : {};
  const result = isRecord(review.reviewResult) ? review.reviewResult : {};
  const type = root.type === 'company' || root.type === 'individual' ? root.type : null;
  const reviewStatus = str(review.reviewStatus);
  const reviewAnswer = result.reviewAnswer === 'GREEN' || result.reviewAnswer === 'RED' ? result.reviewAnswer : null;
  const completedGreen = reviewStatus === 'completed' && reviewAnswer === 'GREEN';

  let rejectLabels: string[] | null;
  if (result.rejectLabels === undefined) {
    rejectLabels = completedGreen ? [] : null; // N1 / N2
  } else if (Array.isArray(result.rejectLabels) && result.rejectLabels.every((l) => typeof l === 'string')) {
    rejectLabels = [...(result.rejectLabels as string[])];
  } else {
    rejectLabels = null; // unparseable
  }
  const reviewRejectType =
    result.reviewRejectType === undefined ? null : str(result.reviewRejectType);
  const reasonCodes = [...(rejectLabels ?? []), ...(reviewRejectType ? [reviewRejectType] : [])].filter(
    (c) => REASON_CODE.test(c),
  );

  return {
    type,
    externalUserId: str(root.externalUserId),
    levelName: str(review.levelName),
    reviewStatus,
    reviewAnswer,
    rejectLabels,
    reviewRejectType,
    reviewDate: parseReviewDate(review.reviewDate),
    reasonCodes,
    beneficiaries: type === 'company' ? beneficiariesOf(root) : null,
    memberOf: type === 'individual' ? memberOfOf(root) : null,
  };
}
