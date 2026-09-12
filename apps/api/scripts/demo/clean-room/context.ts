// Clean-room runtime context: builds the Catenor services for one stage process from the clean-room state. Every
// sponsor client is created lazily so READ-ONLY / LOCAL stages never touch a sponsor.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { bootstrapConfigurationHash, parseBootstrapConfiguration } from '@catenor-one/authority';
import {
  DISTRIBUTION_ELIGIBILITY_V2_POLICY,
  INVESTOR_ELIGIBILITY_CREDENTIAL,
  OFFERING_ELIGIBILITY_POLICY,
} from '@catenor-one/policy';
import { PrivyClient } from '@privy-io/node';
import {
  startCallbackReceiver,
  type CallbackReceiver,
} from '../../../src/infrastructure/confidential-compute/cre-callback-receiver.js';
import {
  deriveRelayKey,
  startRelayPoller,
  type RelayPoller,
} from '../../../src/infrastructure/confidential-compute/cre-callback-relay.js';
import { deriveChannelKeys } from '../../../src/infrastructure/confidential-compute/cre-channel.js';
import { CreGatewayConfidentialVerifier } from '../../../src/infrastructure/confidential-compute/cre-gateway-verifier.js';
import { CreSimulationConfidentialVerifier } from '../../../src/infrastructure/confidential-compute/cre-simulation-verifier.js';
import { SumsubSandboxOperator } from '../../../src/infrastructure/identity-providers/sumsub-sandbox.js';
import { PrivyDistributionAgentProvisioner } from '../../../src/infrastructure/key-management/privy-distribution-agent.js';
import { PrivySpvWalletProvisioner } from '../../../src/infrastructure/key-management/privy-spv-wallet.js';
import { selectSigners } from '../../../src/infrastructure/key-management/signer-selection.js';
import {
  PrismaUnitOfWork,
  createPrismaClient,
} from '../../../src/infrastructure/persistence/prisma/prisma-persistence.js';
import {
  nodeIds,
  packagedAdmissionPolicy,
  pinnedBootstrapConfiguration,
  systemClock,
} from '../../../src/infrastructure/runtime/runtime-adapters.js';
import {
  InvestorCredentialsService,
  type CredentialOperationResult,
} from '../../../src/modules/investor-credentials/application/investor-credentials.service.js';
import { SponsorAuthorizationService } from '../../../src/modules/sponsor-authorization/application/sponsor-authorization.service.js';
import { TrustAnchorAdmissionService } from '../../../src/modules/trust-anchor-admission/application/trust-anchor-admission.service.js';
import type { ConfidentialVerificationResult } from '../../../src/modules/trust-anchor-admission/application/admission.ports.js';
import {
  BOOTSTRAP_CONFIG_FILE,
  WORKFLOWS,
  WORKFLOW_ENV,
  env,
  need,
  setState,
  workflowSecret,
} from './state.js';

export const TRUST_DOMAIN = 'trust-domain:catenor-one-demo';
export const RESOURCE = 'spv:catenor-demo-001';
export const HBAR = 10n ** 18n;
export const rfc3339 = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
export const inDays = (days: number) => rfc3339(new Date(Date.now() + days * 86_400_000));

/** CRE executions seen by this process (for the judge record — never raw provider data). */
export interface CreEvent {
  readonly operation: string;
  readonly runId?: string;
  readonly accepted: boolean;
  readonly reason?: string;
}

export class Context {
  private _privy?: PrivyClient;
  private _client?: ReturnType<typeof createPrismaClient>;
  private _receiver?: CallbackReceiver;
  private _relay?: RelayPoller;
  private _sim?: CreSimulationConfidentialVerifier;
  private _services?: {
    admission: TrustAnchorAdmissionService;
    sponsor: SponsorAuthorizationService;
    investors: InvestorCredentialsService;
  };
  readonly creEvents: CreEvent[] = [];
  /** The verifier every service calls; the implementation is plugged in by startConfidential. */
  private readonly verifier = new VerifierSlot(() => this.creMode);

  get instance(): string {
    return need('DEMO_INSTANCE', 'scripts/demo/01-setup-env.sh');
  }

  get privy(): PrivyClient {
    this._privy ??= new PrivyClient({
      appId: env('PRIVY_APP_ID'),
      appSecret: env('PRIVY_APP_SECRET'),
    });
    return this._privy;
  }

  get db() {
    this._client ??= createPrismaClient(need('DEMO_DATABASE_URL', 'scripts/demo/01-setup-env.sh'));
    return this._client;
  }

  get uow() {
    return new PrismaUnitOfWork(this.db);
  }

  /** S001 signers of THIS Trust Domain (clean-room signer infrastructure, stage 10). */
  get signers() {
    const s = selectSigners({
      PRIVY_APP_ID: env('PRIVY_APP_ID'),
      PRIVY_APP_SECRET: env('PRIVY_APP_SECRET'),
      PRIVY_ASSERTION_OWNER_PUBLIC_KEY: env('DEMO_ASSERTION_OWNER_PUBLIC_KEY'),
      PRIVY_ASSERTION_RUNTIME_QUORUM_ID: env('DEMO_ASSERTION_RUNTIME_QUORUM_ID'),
      PRIVY_ASSERTION_POLICY_ID: env('DEMO_ASSERTION_POLICY_ID'),
      CATENOR_ASSERTION_RUNTIME_AUTHORIZATION_KEY: env('DEMO_ASSERTION_RUNTIME_AUTHORIZATION_KEY'),
      PRIVY_BOOTSTRAP_WALLET_ID: env('DEMO_BOOTSTRAP_WALLET_ID'),
      CATENOR_BOOTSTRAP_RUNTIME_AUTHORIZATION_KEY: env('DEMO_BOOTSTRAP_RUNTIME_AUTHORIZATION_KEY'),
    });
    if (s.kind !== 'PRIVY') {
      console.error(
        'BLOCKED: the clean-room Privy signer infrastructure is missing — run 10-create-trust-domain.sh',
      );
      process.exit(2);
    }
    return s;
  }

  get bootstrapConfiguration() {
    if (!existsSync(BOOTSTRAP_CONFIG_FILE)) {
      console.error('BLOCKED: no Bootstrap Configuration — run 10-create-trust-domain.sh');
      process.exit(2);
    }
    const raw = JSON.parse(readFileSync(BOOTSTRAP_CONFIG_FILE, 'utf8')) as unknown;
    const hash = bootstrapConfigurationHash(parseBootstrapConfiguration(raw));
    if (hash !== need('DEMO_BOOTSTRAP_CONFIGURATION_HASH', '10-create-trust-domain.sh')) {
      throw new Error('the Bootstrap Configuration file does not match its pinned hash');
    }
    return { raw, hash, source: pinnedBootstrapConfiguration(raw, hash) };
  }

  get sumsub(): SumsubSandboxOperator {
    return new SumsubSandboxOperator({
      appToken: workflowSecret('SUMSUB_APP_TOKEN_VAR'),
      secretKey: workflowSecret('SUMSUB_SECRET_KEY_VAR'),
    });
  }

  private get internalToken() {
    const token = workflowSecret('CATENOR_INTERNAL_API_TOKEN_VAR');
    if (!token) throw new Error('CATENOR_INTERNAL_API_TOKEN_VAR is missing — run 01-setup-env.sh');
    return token;
  }

  get channelKeys() {
    return deriveChannelKeys(this.internalToken);
  }

  /** Key that authenticates this runner's pulls from the Railway relay (cre-callback-relay.ts). */
  get relayKey() {
    return deriveRelayKey(this.internalToken);
  }

  get creMode(): 'SIMULATION' | 'DEPLOYED' {
    return env('DEMO_CRE_MODE') === 'DEPLOYED' ? 'DEPLOYED' : 'SIMULATION';
  }

  /** Public workflow config (the same fields a deployed workflow is configured with; see scripts/demo/cre/). */
  async workflowConfig(callbackUrl: string): Promise<Record<string, unknown>> {
    const { raw, hash } = this.bootstrapConfiguration;
    const trustAnchor = env('DEMO_TRUST_ANCHOR_DID');
    return {
      callbackUrl,
      sumsubBaseUrl: 'https://api.sumsub.com',
      httpRequestTimeout: '8s',
      executionMode: this.creMode,
      companyEvidence: {
        source: 'SYNTHETIC_MOCK',
        scenario: 'MOCK_COMPANY_ACTIVE_GREEN',
        label: 'MOCK — not Sumsub KYB',
      },
      bootstrapConfigurationHash: hash,
      acceptedEvidence: (raw as { acceptedEvidence: Record<string, unknown> }).acceptedEvidence,
      investorEvidence: { levelNames: ['id-only'], evidenceMaxAgeDays: 180 },
      ...(trustAnchor
        ? {
            credentialRules: {
              credentialType: INVESTOR_ELIGIBILITY_CREDENTIAL,
              acceptedIssuers: await this.services.investors.acceptedIssuers(trustAnchor),
              maxStatusAgeSeconds: 600,
              policies: {
                offering: OFFERING_ELIGIBILITY_POLICY,
                distribution: DISTRIBUTION_ELIGIBILITY_V2_POLICY,
              },
            },
          }
        : {}),
      authorizedTriggerAddress:
        env('DEMO_CRE_TRIGGER_ADDRESS') || '0x0000000000000000000000000000000000000000',
      authorizedKeys: [
        {
          type: 'KEY_TYPE_ECDSA_EVM',
          publicKey:
            env('DEMO_CRE_TRIGGER_ADDRESS') || '0x0000000000000000000000000000000000000000',
        },
      ],
    };
  }

  /** Starts the authenticated callback receiver and the CRE verifier (SIMULATION by default). */
  async startConfidential() {
    if (this._receiver) return;
    const keys = this.channelKeys;
    const deliver = (result: ConfidentialVerificationResult) => {
      const op = (result as { operation: string }).operation;
      return op === 'TRUST_ANCHOR_ADMISSION'
        ? this.services.admission.recordConfidentialVerificationResult(result)
        : this.services.investors.recordResult(result as unknown as CredentialOperationResult);
    };
    this._receiver = await startCallbackReceiver({
      port: Number(env('DEMO_CALLBACK_PORT') || 8787),
      keys,
      now: () => new Date(),
      deliver,
      onEvent: (e) => this.creEvents.push({ operation: 'callback', ...e }),
    });
    const callbackUrl =
      this.creMode === 'DEPLOYED'
        ? need('DEMO_CRE_CALLBACK_PUBLIC_URL', 'scripts/demo/cre/configure.sh')
        : this._receiver.url;
    const config = await this.workflowConfig(callbackUrl);
    if (this.creMode === 'DEPLOYED') {
      this.verifier.impl = new CreGatewayConfidentialVerifier({
        keys,
        workflowId: need('DEMO_CRE_WORKFLOW_ID', 'scripts/demo/cre/deploy.sh --live'),
        triggerPrivateKey: need('DEMO_CRE_TRIGGER_PRIVATE_KEY', 'scripts/demo/cre/configure.sh'),
      });
      // Railway relay (configure.sh --relay-url): the workflow calls back to the public API, and this process pulls
      // each of its results and delivers it through the same authenticateCallback → deliver path as the receiver.
      const relayUrl = env('DEMO_CRE_RELAY_URL');
      if (relayUrl) {
        this._relay = startRelayPoller({
          baseUrl: relayUrl,
          relayKey: this.relayKey,
          keys,
          runIds: () => this.verifier.requested.map((r) => r.runId),
          deliver,
          onEvent: (e) => this.creEvents.push({ operation: 'relay', ...e }),
        });
      }
    } else {
      this._sim = new CreSimulationConfidentialVerifier({
        keys,
        projectRoot: WORKFLOWS,
        workflowFolder: 'identity-confidential',
        target: 'staging-settings',
        envFile: WORKFLOW_ENV,
        limitsFile: `${WORKFLOWS}identity-confidential/test/limits.production-like.json`,
        creBinary: env('CRE_BIN') || `${homedir()}/.cre/bin/cre`,
        workflowConfig: config,
      });
      this.verifier.impl = this._sim;
    }
  }

  /**
   * The CRE executions this process requested: workflow ref, run/execution ref, operation, the handler's DON-visible
   * {status, code}, and ONLY the allowlisted TEE log events (shared/safe-log.ts) — never other simulator output.
   */
  async creExecutions() {
    const out = [];
    for (const r of this.verifier.requested) {
      const o = this._sim ? await this._sim.completion(r.runId).catch(() => undefined) : undefined;
      out.push({
        operation: r.operation,
        runId: r.runId,
        executionId: r.executionId ?? null,
        mode: this.creMode,
        workflow: this.verifier.workflowId,
        handler: o?.handlerResult ?? null,
        simulatorExitCode: o?.exitCode ?? null,
        teeLogs: allowlistedLogs(o?.outputTail ?? ''),
      });
    }
    return out;
  }

  /**
   * The last simulator outcome for a run (DON-visible {status, code} + allowlisted log tail). DEPLOYED through the
   * Railway relay: waits until the run's result was pulled and delivered (no simulator outcome exists).
   */
  async simulationOutcome(runId: string) {
    if (this._sim) return this._sim.completion(runId);
    await this._relay?.settled(runId);
    return undefined;
  }

  get services() {
    if (this._services) return this._services;
    const { source } = this.bootstrapConfiguration;
    const signers = this.signers;
    const common = { uow: this.uow, clock: systemClock, ids: nodeIds, trustDomain: TRUST_DOMAIN };
    const admission = new TrustAnchorAdmissionService({
      ...common,
      configuration: source,
      policy: packagedAdmissionPolicy,
      assertionSigner: signers.assertionSigner,
      bootstrapSigner: signers.bootstrapSigner,
      verifier: this.verifier as never,
    });
    const verifyTrustAnchor = (did: string) => admission.verifyTrustAnchor(did);
    const spvOwner = env('DEMO_SPV_OWNER_PUBLIC_KEY');
    const agentOwner = env('DEMO_AGENT_OWNER_PUBLIC_KEY');
    const sponsor = new SponsorAuthorizationService({
      ...common,
      assertionSigner: signers.assertionSigner,
      verifyTrustAnchor,
      ...(spvOwner
        ? {
            spvProvisioner: new PrivySpvWalletProvisioner(this.privy, {
              ownerPublicKey: spvOwner,
              runtimeSignerQuorumId: env('DEMO_SPV_RUNTIME_QUORUM_ID'),
            }),
          }
        : {}),
      ...(agentOwner
        ? {
            agentProvisioner: new PrivyDistributionAgentProvisioner(this.privy, {
              ownerPublicKey: agentOwner,
              runtimeSignerQuorumId: env('DEMO_AGENT_RUNTIME_QUORUM_ID'),
            }),
          }
        : {}),
    });
    const investors = new InvestorCredentialsService({
      ...common,
      assertionSigner: signers.assertionSigner,
      verifyTrustAnchor,
      verifier: this.verifier as never,
      sponsor,
      resultTimeoutMs: 300_000,
    });
    this._services = { admission, sponsor, investors };
    return this._services;
  }

  async close() {
    this._relay?.stop();
    this._sim?.dispose();
    await this._receiver?.close();
    await this._client?.$disconnect();
  }
}

const SAFE_EVENTS = [
  'workflow_started',
  'secrets_fetched',
  'context_opened',
  'context_open_failed',
  'operation_routed',
  'operation_unknown',
  'handler_completed',
  'handler_error',
  'tta_evaluated',
  'investor_evaluated',
  'offering_evaluated',
  'distribution_computed',
];
/** Allowlisted TEE events with their primitive fields (e.g. `handler_completed status=DELIVERED code=OK`). */
function allowlistedLogs(output: string): string[] {
  const re = new RegExp(
    `\\b(${SAFE_EVENTS.join('|')})((?: [a-zA-Z]+=[A-Za-z0-9_.:-]{1,64})*)`,
    'g',
  );
  return [...output.matchAll(re)].map((m) => `${m[1]}${m[2]}`).slice(0, 40);
}

/** The deployed HTTP trigger accepts one execution per 60 s (`every60s:1`); keep a margin. */
const DEPLOYED_TRIGGER_SPACING_MS = 61_000;

/**
 * DEPLOYED only: waits until DEPLOYED_TRIGGER_SPACING_MS have passed since the last gateway trigger of this instance
 * (recorded in state.env, so separate stage processes are paced too).
 */
async function paceDeployedTrigger(): Promise<void> {
  const last = Number(env('DEMO_CRE_LAST_TRIGGER_AT') || 0);
  const wait = last + DEPLOYED_TRIGGER_SPACING_MS - Date.now();
  if (wait > 0) {
    console.log(
      `  waiting ${Math.ceil(wait / 1000)} s — deployed CRE trigger rate limit (1 per 60 s)`,
    );
    await new Promise((r) => setTimeout(r, wait));
  }
}

/** A stable verifier handle for the services, whose implementation (simulation or gateway) is plugged in later. */
class VerifierSlot {
  impl?: CreSimulationConfidentialVerifier | CreGatewayConfidentialVerifier;
  readonly requested: { operation: string; runId: string; executionId?: string }[] = [];

  constructor(private readonly fallbackMode: () => 'SIMULATION' | 'DEPLOYED') {}

  get mode() {
    return this.impl?.mode ?? this.fallbackMode();
  }

  get workflowId() {
    return this.impl?.workflowId ?? 'identity-confidential (not started)';
  }

  async request(input: { operation: string; runId: string; context: unknown }) {
    if (!this.impl) throw new Error('confidential verifier not started');
    const deployed = this.impl.mode === 'DEPLOYED';
    if (deployed) await paceDeployedTrigger();
    const out = await this.impl.request(input as never).finally(() => {
      if (deployed) setState({ DEMO_CRE_LAST_TRIGGER_AT: String(Date.now()) });
    });
    this.requested.push({
      operation: input.operation,
      runId: input.runId,
      executionId: out.executionId,
    });
    return out;
  }
}
