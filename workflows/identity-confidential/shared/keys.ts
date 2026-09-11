/**
 * Key schedule — HKDF-SHA256 from CATENOR_INTERNAL_API_TOKEN (PLAN §18).
 *
 * Three derived 32-byte keys from a single root secret:
 *   - context key:        sealing/opening the AES-256-GCM sealed context
 *   - callback HMAC key:  authenticating the result callback to the API
 *   - commitment-salt key: deterministic salt for evidence commitments
 *
 * Profile: HKDF-SHA256, salt = empty (treated as hashLen zeros per RFC 5869),
 *          info = UTF-8 string, L = 32.
 */
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'

const EMPTY_SALT = new Uint8Array(0)

const INFO_CTX  = 'catenor-one/identity-confidential/ctx/v1'
const INFO_CB   = 'catenor-one/identity-confidential/cb/v1'
const INFO_SALT = 'catenor-one/identity-confidential/salt/v1'

export interface DerivedKeys {
  contextKey: Uint8Array       // 32 bytes — AES-256-GCM key for sealed context
  callbackKey: Uint8Array      // 32 bytes — HMAC key for result callback
  commitmentSaltKey: Uint8Array // 32 bytes — HMAC key for evidence commitment salt
}

/**
 * Derive all three keys from the raw CATENOR_INTERNAL_API_TOKEN (hex string).
 */
export function deriveKeys(tokenHex: string): DerivedKeys {
  const ikm = hexToBytes(tokenHex)
  if (ikm.length !== 32) {
    throw new Error('INVALID_TOKEN: CATENOR_INTERNAL_API_TOKEN must be 32 bytes (64 hex chars)')
  }

  const enc = new TextEncoder()

  return {
    contextKey:        hkdf(sha256, ikm, EMPTY_SALT, enc.encode(INFO_CTX), 32),
    callbackKey:       hkdf(sha256, ikm, EMPTY_SALT, enc.encode(INFO_CB), 32),
    commitmentSaltKey: hkdf(sha256, ikm, EMPTY_SALT, enc.encode(INFO_SALT), 32),
  }
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('hexToBytes: odd length')
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}
