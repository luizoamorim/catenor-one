/**
 * Allowlisted safe logging (PLAN §17, T8.1).
 *
 * TEE logs are treated as PUBLIC — no context fields, applicant IDs,
 * bindingRefs, secrets or sensitive values may be logged.
 *
 * Only use `safeLog` from workflow code. The allowlisted events are defined here.
 */
import type { TeeRuntime } from '@chainlink/cre-sdk'

/** Events that may appear in TEE logs (public). */
type SafeEvent =
  | 'workflow_started'
  | 'secrets_fetched'
  | 'context_opened'
  | 'context_open_failed'
  | 'operation_routed'
  | 'operation_unknown'
  | 'handler_completed'
  | 'handler_error'
  | 'http_request_sent'
  | 'http_response_received'
  | 'callback_sent'
  | 'callback_failed'
  | 'tta_evaluated'
  | 'investor_evaluated'
  | 'offering_evaluated'
  | 'distribution_computed'

/** Safe field values — only primitives, never context-derived. */
type SafeFields = Record<string, string | number | boolean>

/**
 * Log a safe event. Only allowlisted event names and non-sensitive fields.
 * SIMULATION ONLY — remove or disable before production deployment.
 */
export function safeLog(
  runtime: TeeRuntime<unknown>,
  event: SafeEvent,
  fields?: SafeFields,
): void {
  const parts: string[] = [event]
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      parts.push(`${k}=${String(v)}`)
    }
  }
  runtime.log(parts.join(' '))
}
