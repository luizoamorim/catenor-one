#!/usr/bin/env node
/**
 * seal-context.mjs — Node fixture for creating sealed trigger payloads.
 *
 * Seals a context JSON with a given CATENOR_INTERNAL_API_TOKEN (hex) into
 * a trigger payload file with base64-encoded nonce and ciphertext‖tag.
 *
 * Usage:
 *   node fixtures/seal-context.mjs <tokenHex> <operation> <runId> <outputFile> [contextJsonFile]
 *
 * If contextJsonFile is omitted, a default synthetic context is used.
 *
 * Variants (for tamper testing):
 *   --wrong-key        use a different key to seal
 *   --wrong-aad-op     use a different operation in the AAD but keep the right one in payload
 *   --wrong-runid      set a different runId in the payload (context has the original)
 *   --flip-ct          flip a ciphertext bit
 *   --flip-tag         flip a tag bit
 *   --expired          set notAfter to 1 hour ago
 */
import {
  createCipheriv,
  randomBytes,
  createHash,
} from 'node:crypto'
import { hkdfSync } from 'node:crypto'
import { writeFileSync, readFileSync } from 'node:fs'

const args = process.argv.slice(2)

// Parse flags
const flags = new Set()
const positional = []
for (const arg of args) {
  if (arg.startsWith('--')) {
    flags.add(arg)
  } else {
    positional.push(arg)
  }
}

const [tokenHex, operation, runId, outputFile, contextJsonFile] = positional

if (!tokenHex || !operation || !runId || !outputFile) {
  console.error('Usage: seal-context.mjs <tokenHex> <operation> <runId> <outputFile> [contextJsonFile] [--flags]')
  process.exit(1)
}

// Derive k_ctx via HKDF
const ikm = Buffer.from(tokenHex, 'hex')
const info = 'catenor-one/identity-confidential/ctx/v1'
const kCtx = Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), info, 32))

// Use a wrong key if requested
let encryptionKey = kCtx
if (flags.has('--wrong-key')) {
  encryptionKey = Buffer.from(
    hkdfSync('sha256', randomBytes(32), Buffer.alloc(0), info, 32)
  )
}

// Build context
let context
if (contextJsonFile) {
  context = JSON.parse(readFileSync(contextJsonFile, 'utf-8'))
} else {
  // Default synthetic context
  const notAfter = flags.has('--expired')
    ? new Date(Date.now() - 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 5 * 60 * 1000).toISOString()

  context = {
    sessionRef: 'sess-sim-001',
    runId: runId,
    trustDomain: 'td:catenor-one:demo',
    subjectDid: 'did:catenor:sim-subject-abc123',
    companyApplicantId: 'mock:company-fixture:MOCK_COMPANY_ACTIVE_GREEN',
    representativeApplicantId: 'sim-rep-applicant-001',
    companyBindingRef: 'sim-company-br-001',
    representativeBindingRef: 'sim-rep-br-001',
    notAfter,
  }
}

// Plaintext = JSON of context
const plaintext = Buffer.from(JSON.stringify(context), 'utf-8')

// AAD: UTF-8(operation + runId) — use a wrong operation for AAD if requested
const aadOperation = flags.has('--wrong-aad-op') ? 'WRONG_OPERATION' : operation
const aad = Buffer.from(aadOperation + runId, 'utf-8')

// Encrypt
const nonce = randomBytes(12)
const cipher = createCipheriv('aes-256-gcm', encryptionKey, nonce, { authTagLength: 16 })
cipher.setAAD(aad)
const enc1 = cipher.update(plaintext)
const enc2 = cipher.final()
const ciphertext = Buffer.concat([enc1, enc2])
const tag = cipher.getAuthTag()

// ciphertext ‖ tag
let ctWithTag = Buffer.concat([ciphertext, tag])

// Tamper variants
if (flags.has('--flip-ct')) {
  ctWithTag = Buffer.from(ctWithTag)
  ctWithTag[0] ^= 0x01
}
if (flags.has('--flip-tag')) {
  ctWithTag = Buffer.from(ctWithTag)
  ctWithTag[ctWithTag.length - 1] ^= 0x01
}

// Build trigger payload with BASE64 transport
const triggerRunId = flags.has('--wrong-runid') ? 'wrong-run-id-xxx' : runId
const payload = {
  v: 1,
  operation,
  runId: triggerRunId,
  sealedContext: {
    nonce: nonce.toString('base64'),
    ct: ctWithTag.toString('base64'),
  },
}

writeFileSync(outputFile, JSON.stringify(payload, null, 2))
console.log(`Wrote ${outputFile} (${plaintext.length} bytes plaintext, base64 transport)`)
