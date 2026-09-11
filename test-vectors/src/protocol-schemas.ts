import { readFileSync } from 'node:fs';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

/** Pinned protocol commit (docs/PROTOCOL-BASELINE.md). */
export const PROTOCOL_COMMIT = '66ef712694acfc987663f5ffa9bcc9d12d1fe80e';

export type ProtocolSchemaName = 'policy' | 'decision' | 'audit-event';

/** Loads a vendored protocol JSON Schema from `schemas/catenor-protocol/<commit>/`. */
export function loadProtocolSchema(name: ProtocolSchemaName): Record<string, unknown> {
  const url = new URL(
    `../../schemas/catenor-protocol/${PROTOCOL_COMMIT}/${name}.schema.json`,
    import.meta.url,
  );
  return JSON.parse(readFileSync(url, 'utf8')) as Record<string, unknown>;
}

/** Raw bytes of a vendored protocol schema (for integrity checks). */
export function readProtocolSchemaBytes(name: ProtocolSchemaName): Buffer {
  return readFileSync(
    new URL(
      `../../schemas/catenor-protocol/${PROTOCOL_COMMIT}/${name}.schema.json`,
      import.meta.url,
    ),
  );
}

// ajv / ajv-formats are CommonJS; under Node ESM the classes live on `.default`.
const Ajv2020 = Ajv2020Module.default;
const addFormats = addFormatsModule.default;

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validates a value against a pinned protocol schema (draft 2020-12, with `format` checks). */
export function validateProtocolObject(
  name: ProtocolSchemaName,
  value: unknown,
): SchemaValidationResult {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(loadProtocolSchema(name));
  const valid = validate(value);
  return {
    valid,
    errors: (validate.errors ?? []).map((e) =>
      `${e.instancePath || '/'} ${e.message ?? ''}`.trim(),
    ),
  };
}
