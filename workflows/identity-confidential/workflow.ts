/**
 * identity-confidential — Catenor One CRE Confidential Workflow
 *
 * Single HTTP trigger → handlerInTee → operation router.
 *
 * Operations:
 *   TRUST_ANCHOR_ADMISSION → src/trust-anchor-admission/index.ts
 *   INVESTOR_ELIGIBILITY   → src/investor-eligibility/index.ts (final demo [REF-IMPL])
 *   (future S002: SUBJECT_CONTINUITY)
 *
 * The handler's return value is DON-visible: only {status, code}.
 * No facts, PII, applicant IDs, secrets or raw provider data in the return.
 */
import { cre, type TeeRuntime, type HTTPPayload } from '@chainlink/cre-sdk'
import { z } from 'zod'

import { fetchSecrets } from './shared/secrets.js'
import { deriveKeys } from './shared/keys.js'
import { openSealedContext, type TriggerPayload } from './shared/sealed-context.js'
import { safeLog } from './shared/safe-log.js'
import { base64Encode } from './shared/base64.js'
import { runTrustAnchorAdmission, type TtaRuntime } from './src/trust-anchor-admission/index.js'
import { runInvestorEligibility } from './src/investor-eligibility/index.js'

// ── Config Schema (validated by the SDK at startup) ──────────────────

export const configSchema = z.object({
  callbackUrl: z.string(),
  sumsubBaseUrl: z.string(),
  httpRequestTimeout: z.string(),
  companyEvidence: z.object({
    source: z.string(),
    scenario: z.string(),
    label: z.string(),
  }),
  bootstrapConfigurationHash: z.string(),
  // Execution label echoed in every result (SIMULATION for `cre workflow simulate`, DEPLOYED only in a real
  // Confidential Workflows deployment).
  executionMode: z.enum(['SIMULATION', 'DEPLOYED']),
  // Identical to the hash-pinned Bootstrap Configuration's acceptedEvidence (PLAN §16.1, §17.6).
  acceptedEvidence: z.object({
    evidenceProfile: z.enum(['HYBRID_DEMO', 'FULL_SUMSUB_SANDBOX']),
    evidenceSources: z.object({
      company: z.enum(['SYNTHETIC_MOCK', 'REAL_SUMSUB_SANDBOX']),
      representative: z.enum(['SYNTHETIC_MOCK', 'REAL_SUMSUB_SANDBOX']),
    }),
    companyLevelNames: z.array(z.string()),
    representativeLevelNames: z.array(z.string()),
    authorityRoles: z.array(z.string()),
    activeRegistryStatuses: z.array(z.string()),
    evidenceMaxAgeDays: z.number(),
  }),
  // [REF-IMPL] individual-investor evidence rules for INVESTOR_ELIGIBILITY (final demo); absent → that operation
  // fails closed with CONFIG_INVALID.
  investorEvidence: z.object({
    levelNames: z.array(z.string()),
    evidenceMaxAgeDays: z.number(),
  }).optional(),
  authorizedTriggerAddress: z.string(),
  // T0.7: use z.enum for KeyType so type checks stay on
  authorizedKeys: z.array(z.object({
    type: z.enum(['KEY_TYPE_UNSPECIFIED', 'KEY_TYPE_ECDSA_EVM']).optional(),
    publicKey: z.string().optional(),
  })),
})
type Config = z.infer<typeof configSchema>

// ── Result type (DON-visible — never include facts or PII) ──────────
interface WorkflowResult {
  status: 'DELIVERED' | 'FAILED' | 'ERROR'
  code: string
}

// ── TEE handler ──────────────────────────────────────────────────────

const onHttpTrigger = (
  runtime: TeeRuntime<Config>,
  triggerOutput: HTTPPayload,
): string => {
  safeLog(runtime, 'workflow_started')

  // ── 1. Fetch secrets (one batched call) ──
  const secrets = fetchSecrets(runtime)
  safeLog(runtime, 'secrets_fetched')

  // ── 2. Derive keys ──
  const keys = deriveKeys(secrets.catenorInternalApiToken)

  // ── 3. Parse trigger payload ──
  let payload: TriggerPayload
  try {
    const raw = new TextDecoder().decode(triggerOutput.input)
    payload = JSON.parse(raw) as TriggerPayload
  } catch {
    safeLog(runtime, 'handler_error', { code: 'INVALID_TRIGGER_PAYLOAD' })
    return JSON.stringify({ status: 'ERROR', code: 'INVALID_TRIGGER_PAYLOAD' } satisfies WorkflowResult)
  }

  // ── 4. Open sealed context ──
  let context: Record<string, unknown>
  try {
    context = openSealedContext(payload, keys.contextKey, runtime.now())
    safeLog(runtime, 'context_opened')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    safeLog(runtime, 'context_open_failed', { error: msg })
    return JSON.stringify({ status: 'ERROR', code: 'SEALED_CONTEXT_OPEN_FAILED' } satisfies WorkflowResult)
  }

  // ── 5. Route by operation ──
  const operation = payload.operation
  safeLog(runtime, 'operation_routed', { operation })

  let result: WorkflowResult

  if (operation === 'TRUST_ANCHOR_ADMISSION' || operation === 'INVESTOR_ELIGIBILITY') {
    // Build the TtaRuntime adapter wrapping CRE SDK calls
    const config = runtime.config
    const httpClient = new cre.capabilities.HTTPClient()

    const ttaRuntime: TtaRuntime = {
      now: () => runtime.now(),
      httpGet: (url: string, headers: Record<string, string>) => {
        const response = httpClient.sendRequest(runtime, {
          url,
          method: 'GET',
          multiHeaders: Object.fromEntries(
            Object.entries(headers).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, { values: [v] }])
          ),
          timeout: config.httpRequestTimeout,
        }).result()
        return { status: response.statusCode, body: response.body }
      },
      httpPost: (url: string, headers: Record<string, string>, body: Uint8Array) => {
        const response = httpClient.sendRequest(runtime, {
          url,
          method: 'POST',
          multiHeaders: Object.fromEntries(
            Object.entries(headers).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, { values: [v] }])
          ),
          // Request body is a proto bytes field → base64 string (T0.7 R13)
          body: base64Encode(body),
          timeout: config.httpRequestTimeout,
        }).result()
        return { status: response.statusCode }
      },
      log: (event: string, fields?: Record<string, string | number | boolean>) => {
        safeLog(runtime, event as Parameters<typeof safeLog>[1], fields)
      },
    }

    // The CRE TEE handler is synchronous (returns string, not Promise<string>).
    // runTrustAnchorAdmission returns TtaResult synchronously. All CRE SDK calls
    // (.result()) resolve synchronously in QuickJS, so the handler runs to
    // completion in a single turn.
    try {
      const run = operation === 'TRUST_ANCHOR_ADMISSION' ? runTrustAnchorAdmission : runInvestorEligibility
      result = run({
        runId: payload.runId,
        context,
        config: runtime.config as unknown as Record<string, unknown>,
        secrets: {
          sumsubAppToken: secrets.sumsubAppToken,
          sumsubSecretKey: secrets.sumsubSecretKey,
          callbackKey: keys.callbackKey,
          saltKey: keys.commitmentSaltKey,
        },
        runtime: ttaRuntime,
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown'
      safeLog(runtime, 'handler_error', { error: msg })
      result = { status: 'ERROR', code: 'HANDLER_THREW' }
    }
  } else {
    // Unknown operation → ERROR, zero HTTP calls
    safeLog(runtime, 'operation_unknown', { operation })
    result = { status: 'ERROR', code: 'UNKNOWN_OPERATION' }
  }

  safeLog(runtime, 'handler_completed', { status: result.status, code: result.code })

  // Return only {status, code} — DON-visible, no facts or PII
  return JSON.stringify(result)
}

// ── Workflow Init ──────────────────────────────────────────────────────

export function initWorkflow(config: Config) {
  const httpTrigger = new cre.capabilities.HTTPCapability()

  return [
    cre.handlerInTee(
      httpTrigger.trigger({
        authorizedKeys: config.authorizedKeys,
      }),
      onHttpTrigger,
      [{ tee: 'nitro', regions: ['us-west-2'] }],
    ),
  ]
}
