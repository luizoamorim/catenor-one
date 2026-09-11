// trust-anchor-admission — the S001 operation of the identity-confidential workflow (PLAN §17.4 steps 4–11).
// Owned by the Catenor One main session (Catenor semantics); CRE mechanics (secrets, sealed context, HTTPClient,
// handlerInTee) live in ../../main.ts and ../shared/*. Pure TypeScript for the CRE QuickJS/WASM runtime.
//
// Legs: company = SYNTHETIC MOCK fixture (Hybrid Demo Profile, D31) or a real Sumsub company source (T8.3b,
// blocked by B11); representative = REAL Sumsub sandbox GET /resources/applicants/{id}/one (T0.8).
// Errors at any step → callback status ERROR with a code and NO facts (fail closed, PLAN §17.5).
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { callbackHeaders, evidenceCommitment, jcs, sumsubSignature } from './commitment.js';
import { bindingGatePasses, deriveFacts, reconcile } from './facts.js';
import { MOCK_COMPANY_REFERENCE, isMockScenario, mockCompanyEvidence } from './mock-company.js';
import { normalizeApplicant } from './normalize.js';
import {
  TtaError,
  type PrivateContext,
  type ResultEnvelope,
  type WorkflowConfig,
} from './types.js';

export * from './types.js';

export interface TtaRuntime {
  now(): Date;
  /** Synchronous: CRE SDK capability calls resolve with `.result()` inside the TEE handler (T8.2 finding). */
  httpGet(url: string, headers: Record<string, string>): { status: number; body: Uint8Array };
  httpPost(url: string, headers: Record<string, string>, body: Uint8Array): { status: number };
  log(event: string, fields?: Record<string, string | number | boolean>): void;
}

export interface TtaResult {
  status: 'DELIVERED' | 'FAILED' | 'ERROR';
  code: string;
}

export interface TtaSecrets {
  sumsubAppToken: string;
  sumsubSecretKey: string;
  callbackKey: Uint8Array;
  saltKey: Uint8Array;
}

const rfc3339 = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const CONTEXT_FIELDS = [
  'sessionRef',
  'runId',
  'trustDomain',
  'subjectDid',
  'companyApplicantId',
  'representativeApplicantId',
  'companyBindingRef',
  'representativeBindingRef',
  'notAfter',
] as const;

function parseContext(runId: string, raw: Record<string, unknown>): PrivateContext {
  for (const field of CONTEXT_FIELDS) {
    if (typeof raw[field] !== 'string' || (raw[field] as string).length === 0) {
      throw new TtaError('CONTEXT_INVALID');
    }
  }
  if (raw.runId !== runId) throw new TtaError('CONTEXT_INVALID');
  return raw as unknown as PrivateContext;
}

function parseConfig(raw: Record<string, unknown>): WorkflowConfig {
  const c = raw as unknown as WorkflowConfig;
  const a = c?.acceptedEvidence;
  if (
    typeof c?.callbackUrl !== 'string' ||
    typeof c.sumsubBaseUrl !== 'string' ||
    (c.executionMode !== 'SIMULATION' && c.executionMode !== 'DEPLOYED') ||
    typeof c.bootstrapConfigurationHash !== 'string' ||
    typeof a?.evidenceMaxAgeDays !== 'number' ||
    !Array.isArray(a.companyLevelNames) ||
    !Array.isArray(a.representativeLevelNames) ||
    !Array.isArray(a.authorityRoles) ||
    !Array.isArray(a.activeRegistryStatuses)
  ) {
    throw new TtaError('CONFIG_INVALID');
  }
  return c;
}

function fetchRepresentative(
  context: PrivateContext,
  config: WorkflowConfig,
  secrets: TtaSecrets,
  runtime: TtaRuntime,
): Uint8Array {
  const path = `/resources/applicants/${encodeURIComponent(context.representativeApplicantId)}/one`;
  const ts = String(Math.floor(runtime.now().getTime() / 1000));
  const response = runtime.httpGet(`${config.sumsubBaseUrl}${path}`, {
    accept: 'application/json',
    'X-App-Token': secrets.sumsubAppToken,
    'X-App-Access-Ts': ts,
    'X-App-Access-Sig': sumsubSignature(secrets.sumsubSecretKey, ts, 'GET', path),
  });
  if (response.status !== 200) throw new TtaError(`SUMSUB_HTTP_${response.status}`);
  return response.body;
}

/** Builds the result envelope for one run (no I/O except the representative GET). */
export function evaluateRun(input: {
  runId: string;
  context: Record<string, unknown>;
  config: Record<string, unknown>;
  secrets: TtaSecrets;
  runtime: TtaRuntime;
}): ResultEnvelope {
  const config = parseConfig(input.config);
  const accepted = config.acceptedEvidence;
  const base = {
    v: 1 as const,
    operation: 'TRUST_ANCHOR_ADMISSION' as const,
    runId: input.runId,
    sessionRef: typeof input.context.sessionRef === 'string' ? input.context.sessionRef : '',
    mode: config.executionMode,
    bootstrapConfigurationHash: config.bootstrapConfigurationHash,
    evidenceProfile: accepted.evidenceProfile,
    evidenceSources: accepted.evidenceSources,
  };
  try {
    const context = parseContext(input.runId, input.context);
    // The company source is fixed by public config and must equal the hash-pinned configuration (TV-B04).
    if (config.companyEvidence.source !== accepted.evidenceSources.company) {
      throw new TtaError('EVIDENCE_SOURCE_MISMATCH');
    }
    if (config.companyEvidence.source !== 'SYNTHETIC_MOCK') {
      throw new TtaError('COMPANY_SOURCE_NOT_AVAILABLE'); // real company KYB: T8.3b, blocked by B11
    }
    if (!isMockScenario(config.companyEvidence.scenario) || !MOCK_COMPANY_REFERENCE.test(context.companyApplicantId)) {
      throw new TtaError('MOCK_COMPANY_REFERENCE_INVALID');
    }
    const mock = mockCompanyEvidence(config.companyEvidence.scenario, {
      companyBindingRef: context.companyBindingRef,
      representativeApplicantId: context.representativeApplicantId,
      levelName: accepted.companyLevelNames[0] ?? '',
      authorityRole: accepted.authorityRoles[0] ?? '',
      activeRegistryStatus: accepted.activeRegistryStatuses[0] ?? '',
    });
    const representativeBytes = fetchRepresentative(context, config, input.secrets, input.runtime);
    let representativeRaw: unknown;
    try {
      representativeRaw = JSON.parse(new TextDecoder().decode(representativeBytes));
    } catch {
      throw new TtaError('SUMSUB_RESPONSE_UNPARSEABLE');
    }
    const company = normalizeApplicant(mock.applicant);
    const representative = normalizeApplicant(representativeRaw);
    if (!bindingGatePasses(company, representative, context)) {
      throw new TtaError('PROVIDER_BINDING_MISMATCH');
    }
    const now = input.runtime.now();
    const { facts, factReasons } = deriveFacts({
      company,
      registryStatus: mock.registryStatus,
      representative,
      context,
      accepted,
      now,
    });
    const { evidenceCommitment: commitment, commitmentInput } = evidenceCommitment(
      {
        runId: context.runId,
        sessionRef: context.sessionRef,
        trustDomain: context.trustDomain,
        subject: context.subjectDid,
        bootstrapConfigurationHash: config.bootstrapConfigurationHash,
        observedAt: rfc3339(now),
        accepted,
        companyReference: context.companyApplicantId,
        representativeApplicantId: context.representativeApplicantId,
        companyApplicantBytes: utf8ToBytes(jcs(mock.applicant)),
        representativeApplicantBytes: representativeBytes,
        reasonCodes: { company: company.reasonCodes, representative: representative.reasonCodes },
        facts,
      },
      input.secrets.saltKey,
    );
    return {
      ...base,
      status: 'OK',
      facts,
      factReasons,
      reconciliation: {
        company: reconcile(company, now, accepted.evidenceMaxAgeDays),
        representative: reconcile(representative, now, accepted.evidenceMaxAgeDays),
      },
      evidenceCommitment: commitment,
      commitmentInput,
    };
  } catch (error) {
    const code = error instanceof TtaError ? error.code : 'INTERNAL_ERROR';
    return { ...base, status: 'ERROR', code };
  }
}

/** Entry point called by main.ts inside handlerInTee: evaluate, then deliver the authenticated callback. */
export function runTrustAnchorAdmission(input: {
  runId: string;
  context: Record<string, unknown>;
  config: Record<string, unknown>;
  secrets: TtaSecrets;
  runtime: TtaRuntime;
}): TtaResult {
  const envelope = evaluateRun(input);
  input.runtime.log('tta_evaluated', { status: envelope.status, code: envelope.code ?? 'OK' });
  const body = utf8ToBytes(JSON.stringify(envelope));
  const timestamp = rfc3339(input.runtime.now());
  const config = input.config as unknown as WorkflowConfig;
  try {
    const { status } = input.runtime.httpPost(
      config.callbackUrl,
      callbackHeaders(input.secrets.callbackKey, timestamp, body),
      body,
    );
    return status >= 200 && status < 300
      ? { status: 'DELIVERED', code: envelope.code ?? 'OK' }
      : { status: 'FAILED', code: `CALLBACK_HTTP_${status}` };
  } catch {
    return { status: 'FAILED', code: 'CALLBACK_UNREACHABLE' };
  }
}
