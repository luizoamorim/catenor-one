/**
 * `did:catenor` identifiers [REF-IMPL, protocol Open A]: `did:catenor:` + 32 lowercase hex characters
 * encoding 128 bits from a CSPRNG (PLAN §3.2).
 *
 * The identifier is never derived from input data (legal name, provider IDs, emails, keys): the only
 * input accepted by {@link generateCatenorDid} is the 16 random bytes supplied by the caller's CSPRNG.
 */
export type CatenorDid = string & { readonly __brand: 'CatenorDid' };

export const CATENOR_DID_PREFIX = 'did:catenor:';
export const CATENOR_DID_PATTERN = /^did:catenor:[0-9a-f]{32}$/;
export const CATENOR_DID_RANDOM_BYTES = 16;

export function isCatenorDid(value: unknown): value is CatenorDid {
  return typeof value === 'string' && CATENOR_DID_PATTERN.test(value);
}

export function parseCatenorDid(value: string): CatenorDid {
  if (!isCatenorDid(value)) {
    throw new TypeError('not a did:catenor identifier (expected did:catenor:<32 lowercase hex>)');
  }
  return value;
}

/** Builds a DID from exactly 16 CSPRNG bytes. */
export function generateCatenorDid(randomBytes: Uint8Array): CatenorDid {
  if (!(randomBytes instanceof Uint8Array) || randomBytes.length !== CATENOR_DID_RANDOM_BYTES) {
    throw new TypeError(`did:catenor requires exactly ${CATENOR_DID_RANDOM_BYTES} random bytes`);
  }
  const hex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${CATENOR_DID_PREFIX}${hex}` as CatenorDid;
}
