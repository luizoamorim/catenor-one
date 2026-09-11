// Runtime adapters: system clock, CSPRNG ids, the packaged admission policy and a pinned Bootstrap
// Configuration source (the configuration must hash to the out-of-band pin — PLAN §16, T7).
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  bootstrapConfigurationHash,
  parseBootstrapConfiguration,
  type BootstrapConfiguration,
} from '@catenor-one/authority';
import type {
  AdmissionPolicySource,
  BootstrapConfigurationSource,
  Clock,
  IdGenerator,
} from '../../modules/trust-anchor-admission/application/admission.ports.js';

export const systemClock: Clock = { now: () => new Date() };

export const nodeIds: IdGenerator = {
  id: (prefix) => `${prefix}:${randomUUID()}`,
  randomBytes: (length) => new Uint8Array(randomBytes(length)),
};

/** `policy:trust-anchor-admission:v1` as packaged by @catenor-one/policy. */
export const packagedAdmissionPolicy: AdmissionPolicySource = {
  load: () =>
    JSON.parse(
      readFileSync(
        new URL(import.meta.resolve('@catenor-one/policy/policies/trust-anchor-admission.v1.json')),
        'utf8',
      ),
    ) as unknown,
};

/** Parses the configuration and refuses it unless its hash equals the pin. */
export function pinnedBootstrapConfiguration(
  raw: unknown,
  pinnedHash: string,
): BootstrapConfigurationSource {
  const config: BootstrapConfiguration = parseBootstrapConfiguration(raw);
  const hash = bootstrapConfigurationHash(config);
  if (hash !== pinnedHash) {
    throw new Error('Bootstrap Configuration does not match the pinned hash');
  }
  return { load: () => ({ config, hash }) };
}
