import { describe, expect, it } from 'vitest';
import {
  InvalidBootstrapConfigurationError,
  bootstrapConfigurationHash,
  parseBootstrapConfiguration,
  parseTrustDomainId,
} from './bootstrap-configuration.js';
import { configFor, newKey } from './scenario.test-fixtures.js';

const config = configFor(newKey().multikey);
const raw = JSON.parse(JSON.stringify(config)) as Record<string, unknown> & {
  acceptedEvidence: Record<string, unknown>;
};

describe('TV-S001-B01 — valid Bootstrap Configuration', () => {
  it('parses and has a deterministic 0x-hex SHA-256 commitment (pin)', () => {
    expect(parseBootstrapConfiguration(raw)).toEqual(config);
    expect(bootstrapConfigurationHash(config)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(bootstrapConfigurationHash(parseBootstrapConfiguration(raw))).toBe(
      bootstrapConfigurationHash(config),
    );
  });

  it('any change to the configuration changes the pin (AC-S001-004/005)', () => {
    const changed = {
      ...raw,
      acceptedEvidence: { ...raw.acceptedEvidence, evidenceMaxAgeDays: 181 },
    };
    expect(bootstrapConfigurationHash(parseBootstrapConfiguration(changed))).not.toBe(
      bootstrapConfigurationHash(config),
    );
  });
});

describe('evidence profiles (PLAN §20.7.1 H1, SPEC §12.3)', () => {
  it('HYBRID_DEMO identifies company evidence as SYNTHETIC_MOCK and the representative as REAL', () => {
    expect(config.acceptedEvidence.evidenceProfile).toBe('HYBRID_DEMO');
    expect(config.acceptedEvidence.evidenceSources).toEqual({
      company: 'SYNTHETIC_MOCK',
      representative: 'REAL_SUMSUB_SANDBOX',
    });
  });

  it('accepts FULL_SUMSUB_SANDBOX with both sources REAL', () => {
    const full = {
      ...raw,
      acceptedEvidence: {
        ...raw.acceptedEvidence,
        evidenceProfile: 'FULL_SUMSUB_SANDBOX',
        evidenceSources: { company: 'REAL_SUMSUB_SANDBOX', representative: 'REAL_SUMSUB_SANDBOX' },
      },
    };
    expect(parseBootstrapConfiguration(full).acceptedEvidence.evidenceProfile).toBe(
      'FULL_SUMSUB_SANDBOX',
    );
  });

  it.each([
    [
      'HYBRID_DEMO claiming a REAL company source',
      { company: 'REAL_SUMSUB_SANDBOX', representative: 'REAL_SUMSUB_SANDBOX' },
    ],
    ['a MOCK representative', { company: 'SYNTHETIC_MOCK', representative: 'SYNTHETIC_MOCK' }],
  ])('rejects %s', (_label, evidenceSources) => {
    expect(() =>
      parseBootstrapConfiguration({
        ...raw,
        acceptedEvidence: { ...raw.acceptedEvidence, evidenceSources },
      }),
    ).toThrow(InvalidBootstrapConfigurationError);
  });
});

describe('parseBootstrapConfiguration rejects malformed configurations', () => {
  it.each([
    [
      'unknown evidence profile',
      { acceptedEvidence: { ...raw.acceptedEvidence, evidenceProfile: 'PROD' } },
    ],
    [
      'non-positive freshness',
      { acceptedEvidence: { ...raw.acceptedEvidence, evidenceMaxAgeDays: 0 } },
    ],
    ['placeholder policy hash', { admissionPolicyHash: '0xpolicyhash_demo_v1' }],
    ['non-Multikey bootstrap key', { bootstrapPublicKeyMultibase: 'z6MkFixtureBootstrapKey' }],
    ['bad trust domain', { trustDomain: 'Catenor One Demo' }],
    [
      'other commitment profile',
      { commitmentProfile: { canonicalization: 'RFC8785', hash: 'SHA-1', encoding: '0x-hex' } },
    ],
    ['wrong type', { type: 'TrustDomain' }],
  ])('%s', (_label, override) => {
    expect(() => parseBootstrapConfiguration({ ...raw, ...override })).toThrow(
      InvalidBootstrapConfigurationError,
    );
  });

  it('trust domain ids are trust-domain:<slug>', () => {
    expect(parseTrustDomainId('trust-domain:catenor-one-demo')).toBe(
      'trust-domain:catenor-one-demo',
    );
    expect(() => parseTrustDomainId('trust-domain:')).toThrow(TypeError);
  });
});
