import serialize from 'canonicalize';

/**
 * RFC 8785 JSON Canonicalization Scheme (JCS).
 *
 * Throws for inputs that have no JSON representation (top-level `undefined`, functions, symbols)
 * and for values RFC 8785 forbids (NaN, ±Infinity, lone surrogates).
 */
export function canonicalizeToString(value: unknown): string {
  const text = serialize(value);
  if (text === undefined) {
    throw new TypeError('value has no JSON representation and cannot be canonicalized');
  }
  return text;
}

/** RFC 8785 canonical form, UTF-8 encoded (RFC 8785 §3.2.4). */
export function canonicalize(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalizeToString(value));
}
