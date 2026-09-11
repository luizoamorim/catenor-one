import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readProtocolSchemaBytes, validateProtocolObject } from './protocol-schemas.js';

// Recorded in schemas/catenor-protocol/<commit>/README.md when the files were vendored.
const VENDORED_SHA256 = {
  'audit-event': '9d49b65c0e258a3a7be14dc57c05e72a7141f14f3bab92f50aa6e472a5dce77a',
  decision: 'a27344279781e36ba619bb38ff266d6c3fc79b9639f0c2c508bf53a8d9253805',
  policy: '59334599fbb721b0ebb925c2f9b186ebcc3863044411ad20623ab7cde671b536',
} as const;

describe('vendored protocol schemas', () => {
  it.each(Object.entries(VENDORED_SHA256))('%s.schema.json is unmodified', (name, sha256) => {
    const actual = createHash('sha256')
      .update(readProtocolSchemaBytes(name as keyof typeof VENDORED_SHA256))
      .digest('hex');
    expect(actual).toBe(sha256);
  });

  it('decision schema rejects additional properties (additionalProperties: false)', () => {
    const base = {
      policy: 'policy:x',
      subject: 'did:catenor:00',
      action: 'A',
      decision: 'ALLOW',
      evaluatedAt: '2026-09-09T22:00:00Z',
    };
    expect(validateProtocolObject('decision', base).valid).toBe(true);
    expect(validateProtocolObject('decision', { ...base, extra: 1 }).valid).toBe(false);
    expect(validateProtocolObject('decision', { ...base, evaluatedAt: 'yesterday' }).valid).toBe(
      false,
    );
  });
});
