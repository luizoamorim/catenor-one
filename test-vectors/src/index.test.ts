import { describe, expect, it } from 'vitest';
import { loadVector } from './index.js';

interface Rfc8785Vectors {
  source: string;
  primitives: { inputJson: string; expectedCanonical: string };
  numberSerialization: { ieee754: string; expected: string }[];
}

describe('loadVector', () => {
  it('reads a golden vector from test-vectors/s001', () => {
    const v = loadVector<Rfc8785Vectors>('s001', 'rfc8785-jcs');
    expect(v.source).toContain('RFC 8785');
    expect(v.numberSerialization.length).toBeGreaterThan(20);
    expect(() => JSON.parse(v.primitives.inputJson)).not.toThrow();
  });

  it('rejects path-like names', () => {
    expect(() => loadVector('s001', '../package')).toThrow(/invalid vector name/);
  });
});
