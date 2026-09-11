import { commit, isCommitment, type Commitment } from '@catenor-one/audit';
import { isEd25519Multikey } from '@catenor-one/identity';

/** `trust-domain:<slug>` (PLAN §3.5). */
export type TrustDomainId = string & { readonly __brand: 'TrustDomainId' };
export const TRUST_DOMAIN_PATTERN = /^trust-domain:[a-z0-9][a-z0-9-]*$/;

export function parseTrustDomainId(value: string): TrustDomainId {
  if (!TRUST_DOMAIN_PATTERN.test(value)) {
    throw new TypeError('trust domain must be trust-domain:<lowercase slug>');
  }
  return value as TrustDomainId;
}

/** Evidence profiles (PLAN §20.7.1, SPEC §12.3): no other combination is valid. */
export const EVIDENCE_PROFILES = {
  HYBRID_DEMO: { company: 'SYNTHETIC_MOCK', representative: 'REAL_SUMSUB_SANDBOX' },
  FULL_SUMSUB_SANDBOX: { company: 'REAL_SUMSUB_SANDBOX', representative: 'REAL_SUMSUB_SANDBOX' },
} as const;
export type EvidenceProfile = keyof typeof EVIDENCE_PROFILES;
export type EvidenceSource = 'SYNTHETIC_MOCK' | 'REAL_SUMSUB_SANDBOX';

/**
 * Catenor One [REF-IMPL] evidence-acceptance rules (PLAN §16.1) — hash-pinned with the configuration.
 * Provider-specific values are opaque to the domain except where an invariant depends on them.
 */
export interface AcceptedEvidence {
  readonly profileNote: string;
  readonly provider: string;
  readonly environment: string;
  readonly evidenceProfile: EvidenceProfile;
  readonly evidenceSources: {
    readonly company: EvidenceSource;
    readonly representative: EvidenceSource;
  };
  readonly companyLevelNames: readonly string[];
  readonly representativeLevelNames: readonly string[];
  readonly authorityRoles: readonly string[];
  readonly activeRegistryStatuses: readonly string[];
  readonly evidenceMaxAgeDays: number;
}

/** Trust Domain Bootstrap Configuration [REF-IMPL; Trust Domain object is an open wire format] (PLAN §16.1). */
export interface BootstrapConfiguration {
  readonly type: 'CatenorTrustDomainBootstrapConfiguration';
  readonly profile: 'catenor-one/bootstrap-configuration/v1';
  readonly trustDomain: TrustDomainId;
  readonly admissionPolicy: string;
  readonly admissionPolicyHash: Commitment;
  readonly bootstrapVerificationMethod: string;
  readonly bootstrapPublicKeyMultibase: string;
  readonly commitmentProfile: {
    readonly canonicalization: 'RFC8785';
    readonly hash: 'SHA-256';
    readonly encoding: '0x-hex';
  };
  readonly acceptedEvidence: AcceptedEvidence;
}

export class InvalidBootstrapConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBootstrapConfigurationError';
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string');

function fail(message: string): never {
  throw new InvalidBootstrapConfigurationError(message);
}

function parseAcceptedEvidence(value: unknown): AcceptedEvidence {
  if (!isRecord(value)) fail('acceptedEvidence must be an object');
  const profile = value.evidenceProfile;
  if (profile !== 'HYBRID_DEMO' && profile !== 'FULL_SUMSUB_SANDBOX') {
    fail('acceptedEvidence.evidenceProfile must be HYBRID_DEMO or FULL_SUMSUB_SANDBOX');
  }
  const expected = EVIDENCE_PROFILES[profile];
  const sources = value.evidenceSources;
  if (
    !isRecord(sources) ||
    sources.company !== expected.company ||
    sources.representative !== expected.representative
  ) {
    fail(`evidenceSources must be ${JSON.stringify(expected)} for the ${profile} profile`);
  }
  for (const key of ['profileNote', 'provider', 'environment'] as const) {
    if (typeof value[key] !== 'string') fail(`acceptedEvidence.${key} must be a string`);
  }
  for (const key of [
    'companyLevelNames',
    'representativeLevelNames',
    'authorityRoles',
    'activeRegistryStatuses',
  ] as const) {
    if (!isStringArray(value[key])) fail(`acceptedEvidence.${key} must be an array of strings`);
  }
  const days = value.evidenceMaxAgeDays;
  if (typeof days !== 'number' || !Number.isInteger(days) || days <= 0) {
    fail('acceptedEvidence.evidenceMaxAgeDays must be a positive integer');
  }
  return value as unknown as AcceptedEvidence;
}

/** Validates a parsed Bootstrap Configuration; throws on any deviation. */
export function parseBootstrapConfiguration(value: unknown): BootstrapConfiguration {
  if (!isRecord(value)) fail('bootstrap configuration must be an object');
  if (value.type !== 'CatenorTrustDomainBootstrapConfiguration') fail('unexpected type');
  if (value.profile !== 'catenor-one/bootstrap-configuration/v1') fail('unexpected profile');
  if (typeof value.trustDomain !== 'string' || !TRUST_DOMAIN_PATTERN.test(value.trustDomain)) {
    fail('trustDomain must be trust-domain:<slug>');
  }
  if (typeof value.admissionPolicy !== 'string' || value.admissionPolicy.length === 0) {
    fail('admissionPolicy missing');
  }
  if (!isCommitment(value.admissionPolicyHash)) fail('admissionPolicyHash must be a commitment');
  if (typeof value.bootstrapVerificationMethod !== 'string' || !value.bootstrapVerificationMethod) {
    fail('bootstrapVerificationMethod missing');
  }
  if (
    typeof value.bootstrapPublicKeyMultibase !== 'string' ||
    !isEd25519Multikey(value.bootstrapPublicKeyMultibase)
  ) {
    fail('bootstrapPublicKeyMultibase must be an Ed25519 Multikey');
  }
  const cp = value.commitmentProfile;
  if (
    !isRecord(cp) ||
    cp.canonicalization !== 'RFC8785' ||
    cp.hash !== 'SHA-256' ||
    cp.encoding !== '0x-hex'
  ) {
    fail('commitmentProfile must be {RFC8785, SHA-256, 0x-hex}');
  }
  parseAcceptedEvidence(value.acceptedEvidence);
  return value as unknown as BootstrapConfiguration;
}

/** `bootstrapConfigurationHash = commit(config)` (PLAN §16.1). */
export function bootstrapConfigurationHash(config: BootstrapConfiguration): Commitment {
  return commit(config);
}
