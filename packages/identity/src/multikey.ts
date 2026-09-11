import { base58 } from '@scure/base';

/**
 * Ed25519 public key ⇄ Multikey `publicKeyMultibase`:
 * `z` + base58btc(0xed 0x01 ‖ 32-byte public key) (W3C Controlled Identifiers / Multikey).
 */
const ED25519_PUB_MULTICODEC = new Uint8Array([0xed, 0x01]);
export const ED25519_PUBLIC_KEY_LENGTH = 32;

export function encodeEd25519Multikey(publicKey: Uint8Array): string {
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== ED25519_PUBLIC_KEY_LENGTH) {
    throw new TypeError('Ed25519 public key must be exactly 32 bytes');
  }
  const bytes = new Uint8Array(ED25519_PUB_MULTICODEC.length + publicKey.length);
  bytes.set(ED25519_PUB_MULTICODEC, 0);
  bytes.set(publicKey, ED25519_PUB_MULTICODEC.length);
  return `z${base58.encode(bytes)}`;
}

export function decodeEd25519Multikey(publicKeyMultibase: string): Uint8Array {
  if (typeof publicKeyMultibase !== 'string' || !publicKeyMultibase.startsWith('z')) {
    throw new TypeError('publicKeyMultibase must be base58btc (multibase prefix "z")');
  }
  let bytes: Uint8Array;
  try {
    bytes = base58.decode(publicKeyMultibase.slice(1));
  } catch {
    throw new TypeError('publicKeyMultibase is not valid base58btc');
  }
  if (
    bytes.length !== ED25519_PUB_MULTICODEC.length + ED25519_PUBLIC_KEY_LENGTH ||
    bytes[0] !== ED25519_PUB_MULTICODEC[0] ||
    bytes[1] !== ED25519_PUB_MULTICODEC[1]
  ) {
    throw new TypeError('publicKeyMultibase is not an Ed25519 Multikey (0xed01 + 32 bytes)');
  }
  return bytes.slice(ED25519_PUB_MULTICODEC.length);
}

export function isEd25519Multikey(publicKeyMultibase: string): boolean {
  try {
    decodeEd25519Multikey(publicKeyMultibase);
    return true;
  } catch {
    return false;
  }
}
