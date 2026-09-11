/**
 * Batched secret retrieval — ONE call for all 3 S001 secrets (PLAN §19.1).
 *
 * The Vault DON releases these only inside the attested enclave.
 */
import type { TeeRuntime } from '@chainlink/cre-sdk'

export interface WorkflowSecrets {
  sumsubAppToken: string
  sumsubSecretKey: string
  catenorInternalApiToken: string
}

/**
 * Fetch all 3 S001 secrets in a single batched getSecrets call.
 * Throws on any missing secret (fail closed).
 */
export function fetchSecrets(runtime: TeeRuntime<unknown>): WorkflowSecrets {
  const secrets = runtime.getSecrets([
    { id: 'SUMSUB_APP_TOKEN' },
    { id: 'SUMSUB_SECRET_KEY' },
    { id: 'CATENOR_INTERNAL_API_TOKEN' },
  ]).result()

  const sumsubAppToken = secrets.SUMSUB_APP_TOKEN?.value
  const sumsubSecretKey = secrets.SUMSUB_SECRET_KEY?.value
  const catenorInternalApiToken = secrets.CATENOR_INTERNAL_API_TOKEN?.value

  if (!sumsubAppToken || !sumsubSecretKey || !catenorInternalApiToken) {
    throw new Error('SECRETS_MISSING: one or more required secrets not resolved')
  }

  return { sumsubAppToken, sumsubSecretKey, catenorInternalApiToken }
}
