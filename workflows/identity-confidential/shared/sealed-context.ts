/**
 * Sealed-context transport (PLAN §18, T8.2).
 *
 * Opens an AES-256-GCM sealed context from the trigger payload.
 * Nonce and ciphertext‖tag are transported as BASE64 strings (no atob/btoa in QuickJS).
 *
 * Profile:
 *   cipher:    AES-256-GCM, 12-byte nonce, 16-byte tag
 *   key:       k_ctx = HKDF-SHA256(CATENOR_INTERNAL_API_TOKEN, empty salt,
 *              "catenor-one/identity-confidential/ctx/v1", 32)
 *   aad:       UTF-8(operation + runId)
 *   payload:   ciphertext ‖ tag
 *   transport: nonce and ct as base64 strings in the trigger JSON
 *
 * After opening:
 *   - context.runId must equal the trigger runId
 *   - context.notAfter (RFC 3339) must be ≥ now and ≤ now + 10 min
 *   - any failure → ERROR (fail closed), no HTTP call
 */
import { gcm } from '@noble/ciphers/aes.js'
import { base64Decode } from './base64.js'

const MAX_FUTURE_MS = 10 * 60 * 1000 // 10 minutes

export interface SealedContextEnvelope {
  nonce: string  // base64
  ct: string     // base64 (ciphertext ‖ 16-byte tag)
}

export interface TriggerPayload {
  v: number
  operation: string
  runId: string
  sealedContext: SealedContextEnvelope
}

export interface OpenedContext {
  [key: string]: unknown
  runId: string
  notAfter: string
}

/**
 * Open a sealed context. Returns the parsed context object.
 * Throws on any failure (wrong key, tampered, expired, runId mismatch).
 */
export function openSealedContext(
  payload: TriggerPayload,
  contextKey: Uint8Array,
  now: Date,
): OpenedContext {
  // Validate payload version
  if (payload.v !== 1) {
    throw new Error('SEALED_CONTEXT_ERROR: unsupported payload version')
  }

  // Decode base64 nonce and ciphertext‖tag
  let nonceBytes: Uint8Array
  let ctBytes: Uint8Array
  try {
    nonceBytes = base64Decode(payload.sealedContext.nonce)
    ctBytes = base64Decode(payload.sealedContext.ct)
  } catch {
    throw new Error('SEALED_CONTEXT_ERROR: invalid base64 encoding')
  }

  if (nonceBytes.length !== 12) {
    throw new Error('SEALED_CONTEXT_ERROR: nonce must be 12 bytes')
  }

  // Build AAD: UTF-8(operation + runId) — bound so a context sealed for one
  // operation/run cannot be replayed into another
  const aad = new TextEncoder().encode(payload.operation + payload.runId)

  // AES-256-GCM open (noble expects ciphertext‖tag)
  let plaintext: Uint8Array
  try {
    const aes = gcm(contextKey, nonceBytes, aad)
    plaintext = aes.decrypt(ctBytes)
  } catch {
    throw new Error('SEALED_CONTEXT_ERROR: decryption failed (wrong key, tampered ciphertext, or wrong AAD)')
  }

  // Parse the plaintext JSON
  let context: Record<string, unknown>
  try {
    context = JSON.parse(new TextDecoder().decode(plaintext))
  } catch {
    throw new Error('SEALED_CONTEXT_ERROR: plaintext is not valid JSON')
  }

  // Validate runId match
  if (typeof context.runId !== 'string' || context.runId !== payload.runId) {
    throw new Error('SEALED_CONTEXT_ERROR: runId mismatch between trigger and context')
  }

  // Validate notAfter
  if (typeof context.notAfter !== 'string') {
    throw new Error('SEALED_CONTEXT_ERROR: missing notAfter')
  }

  const notAfterDate = new Date(context.notAfter)
  if (isNaN(notAfterDate.getTime())) {
    throw new Error('SEALED_CONTEXT_ERROR: notAfter is not a valid date')
  }

  const nowMs = now.getTime()
  if (notAfterDate.getTime() < nowMs) {
    throw new Error('SEALED_CONTEXT_ERROR: context expired (notAfter < now)')
  }

  if (notAfterDate.getTime() > nowMs + MAX_FUTURE_MS) {
    throw new Error('SEALED_CONTEXT_ERROR: notAfter too far in the future (> now + 10 min)')
  }

  return context as OpenedContext
}
