import { loadVector } from '@catenor-one/test-vectors';
import { describe, expect, it } from 'vitest';
import { canonicalize, canonicalizeToString } from './jcs.js';

interface Rfc8785Vectors {
  primitives: { inputJson: string; expectedCanonical: string };
  propertySorting: { inputJson: string; expectedValueOrder: string[] };
  numberSerialization: { ieee754: string; expected: string }[];
  invalidNumbers: { ieee754: string; comment: string }[];
}

const v = loadVector<Rfc8785Vectors>('s001', 'rfc8785-jcs');

function numberFromIeee754(hex: string): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, BigInt(`0x${hex}`));
  return view.getFloat64(0);
}

describe('RFC 8785 JCS', () => {
  it('serializes primitives and sorts properties (RFC 8785 §3.2.2–3.2.3)', () => {
    expect(canonicalizeToString(JSON.parse(v.primitives.inputJson))).toBe(
      v.primitives.expectedCanonical,
    );
  });

  it('sorts property names by UTF-16 code units (RFC 8785 §3.2.3)', () => {
    const canonical = canonicalizeToString(JSON.parse(v.propertySorting.inputJson));
    // Read values in textual order: JSON.parse would re-order integer-like keys such as "1".
    const valuesInOrder = [...canonical.matchAll(/"(?:[^"\\]|\\.)*":"((?:[^"\\]|\\.)*)"/g)].map(
      (m) => m[1],
    );
    expect(valuesInOrder).toEqual(v.propertySorting.expectedValueOrder);
  });

  it.each(v.numberSerialization.map((n) => [n.ieee754, n.expected]))(
    'serializes IEEE 754 %s as %s (RFC 8785 Appendix B)',
    (hex, expected) => {
      expect(canonicalizeToString(numberFromIeee754(hex))).toBe(expected);
    },
  );

  it.each(v.invalidNumbers.map((n) => [n.comment, n.ieee754]))('rejects %s', (_label, hex) => {
    expect(() => canonicalizeToString(numberFromIeee754(hex))).toThrow();
  });

  it('encodes the canonical form as UTF-8 (RFC 8785 §3.2.4)', () => {
    const bytes = canonicalize({ euro: '€' });
    expect(Array.from(bytes.slice(-5))).toEqual([0xe2, 0x82, 0xac, 0x22, 0x7d]); // "€" "}
  });

  it('rejects values without a JSON representation', () => {
    expect(() => canonicalize(undefined)).toThrow(TypeError);
    expect(() => canonicalize(() => 1)).toThrow(TypeError);
  });
});
