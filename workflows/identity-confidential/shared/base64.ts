/**
 * Pure-JS base64 encoder/decoder.
 *
 * The CRE QuickJS/WASM runtime has NO atob/btoa (T0.7 R9 SIMULATION-CONFIRMED).
 * This implementation is used for the sealed-context transport (T8.2).
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Build a reverse lookup table once
const LOOKUP = new Uint8Array(128)
for (let i = 0; i < 128; i++) LOOKUP[i] = 255
for (let i = 0; i < CHARS.length; i++) LOOKUP[CHARS.charCodeAt(i)] = i

/**
 * Decode a standard base64 string (with optional padding) to bytes.
 * Rejects invalid characters.
 */
export function base64Decode(b64: string): Uint8Array {
  // Strip padding
  let len = b64.length
  while (len > 0 && b64[len - 1] === '=') len--

  const outLen = (len * 3) >>> 2
  const out = new Uint8Array(outLen)

  let bits = 0
  let collected = 0
  let pos = 0

  for (let i = 0; i < len; i++) {
    const code = b64.charCodeAt(i)
    if (code >= 128) throw new Error('base64: invalid character')
    const val = LOOKUP[code]
    if (val === 255) throw new Error('base64: invalid character')
    bits = (bits << 6) | val
    collected += 6
    if (collected >= 8) {
      collected -= 8
      out[pos++] = (bits >>> collected) & 0xff
    }
  }

  return out
}

/**
 * Encode bytes to a standard base64 string with padding.
 */
export function base64Encode(bytes: Uint8Array): string {
  let result = ''
  const len = bytes.length
  const remainder = len % 3

  for (let i = 0; i < len - remainder; i += 3) {
    const a = bytes[i]
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    result += CHARS[(a >>> 2)]
    result += CHARS[((a & 3) << 4) | (b >>> 4)]
    result += CHARS[((b & 0xf) << 2) | (c >>> 6)]
    result += CHARS[c & 0x3f]
  }

  if (remainder === 1) {
    const a = bytes[len - 1]
    result += CHARS[(a >>> 2)]
    result += CHARS[((a & 3) << 4)]
    result += '=='
  } else if (remainder === 2) {
    const a = bytes[len - 2]
    const b = bytes[len - 1]
    result += CHARS[(a >>> 2)]
    result += CHARS[((a & 3) << 4) | (b >>> 4)]
    result += CHARS[((b & 0xf) << 2)]
    result += '='
  }

  return result
}
