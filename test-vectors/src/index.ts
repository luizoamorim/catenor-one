import { readFileSync } from 'node:fs';

export {
  PROTOCOL_COMMIT,
  loadProtocolSchema,
  readProtocolSchemaBytes,
  validateProtocolObject,
  type ProtocolSchemaName,
  type SchemaValidationResult,
} from './protocol-schemas.js';

/** Slices that own golden vectors. */
export type VectorSlice = 's001';

const NAME_PATTERN = /^[a-z0-9][a-z0-9.-]*$/;

/**
 * Loads a golden vector `test-vectors/<slice>/<name>.json`.
 * The path is resolved relative to this package, so it works from `src/` (tests) and `dist/`.
 */
export function loadVector<T = unknown>(slice: VectorSlice, name: string): T {
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`invalid vector name: ${name}`);
  }
  const url = new URL(`../${slice}/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}
