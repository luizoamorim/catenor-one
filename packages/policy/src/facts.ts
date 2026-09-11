/** The eight Admission Policy facts (SPEC §17) — the only fact names S001 evaluates. */
export const FACT_NAMES = [
  'ORGANIZATION_KYB_VERIFIED',
  'ORGANIZATION_STATUS_VALID',
  'ORGANIZATION_AML_CLEAR',
  'AUTHORIZED_REPRESENTATIVE_VERIFIED',
  'REPRESENTATIVE_AUTHORITY_CONFIRMED',
  'ASSERTION_KEY_POSSESSION_VALID',
  'ASSERTION_KEY_PURPOSE_VALID',
  'EVIDENCE_FRESH',
] as const;

export type FactName = (typeof FACT_NAMES)[number];

export function isFactName(value: unknown): value is FactName {
  return typeof value === 'string' && (FACT_NAMES as readonly string[]).includes(value);
}

/** Where a fact came from (PLAN §3.4): the key-possession verifier or the confidential verification run. */
export type FactSource = 'KEY_POSSESSION_VERIFIER' | 'CONFIDENTIAL_VERIFICATION';

export interface VerifiedFact {
  readonly name: FactName;
  readonly value: boolean;
  readonly provenance: { readonly source: FactSource; readonly ref: string };
}

/** A candidate fact as received from a verifier — its name is not yet trusted. */
export interface FactInput {
  readonly name: string;
  readonly value: boolean;
  readonly provenance: { readonly source: FactSource; readonly ref: string };
}

export class DuplicateFactError extends Error {
  constructor(name: FactName) {
    super(`fact ${name} supplied more than once`);
    this.name = 'DuplicateFactError';
  }
}

/**
 * FactName → VerifiedFact. Unknown names are dropped and never evaluated (TV-S001-F11); a known fact
 * supplied twice is an integrity failure.
 */
export class FactSet {
  private constructor(
    private readonly facts: ReadonlyMap<FactName, VerifiedFact>,
    /** Names that were not policy facts and were discarded. */
    readonly dropped: readonly string[],
  ) {}

  static from(inputs: readonly FactInput[]): FactSet {
    const facts = new Map<FactName, VerifiedFact>();
    const dropped: string[] = [];
    for (const input of inputs) {
      if (!isFactName(input.name)) {
        dropped.push(input.name);
        continue;
      }
      if (typeof input.value !== 'boolean') {
        throw new TypeError(`fact ${input.name} must be a boolean`);
      }
      if (facts.has(input.name)) throw new DuplicateFactError(input.name);
      facts.set(input.name, { name: input.name, value: input.value, provenance: input.provenance });
    }
    return new FactSet(facts, dropped);
  }

  get(name: FactName): VerifiedFact | undefined {
    return this.facts.get(name);
  }

  get size(): number {
    return this.facts.size;
  }
}
