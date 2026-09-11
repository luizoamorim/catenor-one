// Catenor One — ETHOnline demo run: S001 Trust Anchor Admission (+ Part B when configured). Operator-initiated
// (the Privy-verified bootstrap gate, AC-001–003, is NOT implemented — never present this as production access
// control). Every step is labeled by what really ran:
//
//   REAL        Privy development app signers · Sumsub SANDBOX representative (synthetic applicant) · PostgreSQL
//   SIMULATION  Chainlink CRE confidential workflow via `cre workflow simulate` (deployment gated by B1)
//   MOCK        company / KYB evidence (SYNTHETIC MOCK fixture — Sumsub company KYB is not entitled, B11)
//
// Run: pnpm demo:s001 [--representative GREEN|RED]
// Needs: Docker (or DATABASE_URL), the CRE CLI + `bun install` in the workflow, apps/api/.env with the Privy values,
// workflows/.env with SUMSUB_APP_TOKEN_VAR / SUMSUB_SECRET_KEY_VAR (sandbox) and CATENOR_INTERNAL_API_TOKEN_VAR.
// Secret values are read by this process only and never printed. Output: artifacts/demo/s001-run-<time>.json
// (sanitized: no applicant IDs, bindingRefs, wallet IDs or keys).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { verifyChain } from '@catenor-one/audit';
import { bootstrapConfigurationHash, parseBootstrapConfiguration } from '@catenor-one/authority';
import { policyHash } from '@catenor-one/policy';
import { startCallbackReceiver } from '../../src/infrastructure/confidential-compute/cre-callback-receiver.js';
import { deriveChannelKeys } from '../../src/infrastructure/confidential-compute/cre-channel.js';
import { CreSimulationConfidentialVerifier } from '../../src/infrastructure/confidential-compute/cre-simulation-verifier.js';
import { SumsubSandboxOperator } from '../../src/infrastructure/identity-providers/sumsub-sandbox.js';
import { selectSigners } from '../../src/infrastructure/key-management/signer-selection.js';
import {
  PrismaUnitOfWork,
  createPrismaClient,
} from '../../src/infrastructure/persistence/prisma/prisma-persistence.js';
import {
  nodeIds,
  packagedAdmissionPolicy,
  pinnedBootstrapConfiguration,
  systemClock,
} from '../../src/infrastructure/runtime/runtime-adapters.js';
import { TrustAnchorAdmissionService } from '../../src/modules/trust-anchor-admission/application/trust-anchor-admission.service.js';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const WORKFLOWS = `${ROOT}workflows/`;
const API_ENV = `${ROOT}apps/api/.env`;
const WORKFLOW_ENV = `${WORKFLOWS}.env`;
const TD = 'trust-domain:catenor-one-demo';
const representativeAnswer = process.argv.includes('RED') ? 'RED' : 'GREEN';

const steps: { step: string; label: 'REAL' | 'SIMULATION' | 'MOCK' | 'LOCAL'; result: unknown }[] =
  [];
const say = (step: string, label: (typeof steps)[number]['label'], result: unknown) => {
  steps.push({ step, label, result });
  console.log(
    `[${label.padEnd(10)}] ${step}: ${typeof result === 'string' ? result : JSON.stringify(result)}`,
  );
};

function envValue(file: string, name: string): string {
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  return line
    ? line
        .slice(name.length + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
    : '';
}

function blocked(message: string): never {
  console.error(`BLOCKED: ${message}`);
  process.exit(2);
}

if (!existsSync(WORKFLOW_ENV)) {
  blocked('workflows/.env is missing (Sumsub sandbox values — maintainer action)');
}
if (existsSync(API_ENV)) process.loadEnvFile(API_ENV);
const signers = selectSigners();
if (signers.kind !== 'PRIVY') blocked('Privy signer values are missing from apps/api/.env (T0.4)');
const sumsub = {
  appToken: envValue(WORKFLOW_ENV, 'SUMSUB_APP_TOKEN_VAR'),
  secretKey: envValue(WORKFLOW_ENV, 'SUMSUB_SECRET_KEY_VAR'),
};
const channelToken = envValue(WORKFLOW_ENV, 'CATENOR_INTERNAL_API_TOKEN_VAR');
if (!sumsub.appToken || !sumsub.secretKey || !channelToken) {
  blocked(
    'workflows/.env needs SUMSUB_APP_TOKEN_VAR, SUMSUB_SECRET_KEY_VAR and CATENOR_INTERNAL_API_TOKEN_VAR',
  );
}
const operator = new SumsubSandboxOperator(sumsub); // refuses non-sandbox tokens

// Database: DATABASE_URL, or a throwaway Testcontainers PostgreSQL with the migrations deployed.
let databaseUrl = process.env['DATABASE_URL'] ?? '';
let stopDatabase = async () => {};
if (!databaseUrl) {
  const { startPostgres, prisma } =
    await import('../../src/infrastructure/persistence/prisma/postgres.test-fixtures.js');
  const container = await startPostgres();
  databaseUrl = container.getConnectionUri();
  const deploy = await prisma(databaseUrl, ['migrate', 'deploy']);
  if (deploy.code !== 0) blocked('prisma migrate deploy failed');
  stopDatabase = async () => void (await container.stop());
  say('database', 'LOCAL', 'throwaway PostgreSQL (Testcontainers), migrations deployed');
}
const client = createPrismaClient(databaseUrl);
const keys = deriveChannelKeys(channelToken);

const raw = {
  type: 'CatenorTrustDomainBootstrapConfiguration',
  profile: 'catenor-one/bootstrap-configuration/v1',
  trustDomain: TD,
  admissionPolicy: 'policy:trust-anchor-admission:v1',
  admissionPolicyHash: policyHash(packagedAdmissionPolicy.load()),
  bootstrapVerificationMethod: 'bootstrap-verification-method:1',
  bootstrapPublicKeyMultibase: await signers.bootstrapSigner.publicKeyMultibase(),
  commitmentProfile: { canonicalization: 'RFC8785', hash: 'SHA-256', encoding: '0x-hex' },
  acceptedEvidence: {
    profileNote:
      '[REF-IMPL] Catenor One reference/demo evidence-acceptance rules; not a Catenor Protocol rule',
    provider: 'sumsub',
    environment: 'sandbox',
    evidenceProfile: 'HYBRID_DEMO',
    evidenceSources: { company: 'SYNTHETIC_MOCK', representative: 'REAL_SUMSUB_SANDBOX' },
    companyLevelNames: ['MOCK_KYB_LEVEL'],
    representativeLevelNames: ['id-only'],
    authorityRoles: ['MOCK_AUTHORIZED_SIGNATORY'],
    activeRegistryStatuses: ['MOCK_ACTIVE'],
    evidenceMaxAgeDays: 180,
  },
};
const hash = bootstrapConfigurationHash(parseBootstrapConfiguration(raw));
const configuration = pinnedBootstrapConfiguration(raw, hash);
say('bootstrap configuration', 'LOCAL', { hash, evidenceProfile: 'HYBRID_DEMO' });

const deliveries: { accepted: boolean; reason?: string; runId?: string }[] = [];
// The receiver is created before the service it delivers to (the verifier needs the receiver URL).
const wiring: { service?: TrustAnchorAdmissionService } = {};
const receiver = await startCallbackReceiver({
  port: 8787,
  keys,
  now: () => new Date(),
  deliver: (result) => wiring.service!.recordConfidentialVerificationResult(result),
  onEvent: (e) => deliveries.push(e),
});
const verifier = new CreSimulationConfidentialVerifier({
  keys,
  projectRoot: WORKFLOWS,
  workflowFolder: 'identity-confidential',
  target: 'staging-settings',
  envFile: WORKFLOW_ENV,
  limitsFile: `${WORKFLOWS}identity-confidential/test/limits.production-like.json`,
  creBinary: process.env['CRE_BIN'] ?? `${homedir()}/.cre/bin/cre`,
  workflowConfig: {
    callbackUrl: receiver.url,
    sumsubBaseUrl: 'https://api.sumsub.com',
    httpRequestTimeout: '8s',
    executionMode: 'SIMULATION',
    companyEvidence: {
      source: 'SYNTHETIC_MOCK',
      scenario: 'MOCK_COMPANY_ACTIVE_GREEN',
      label: 'MOCK — not Sumsub KYB',
    },
    bootstrapConfigurationHash: hash,
    acceptedEvidence: configuration.load().config.acceptedEvidence,
    authorizedTriggerAddress: '0x0000000000000000000000000000000000000000',
    authorizedKeys: [
      { type: 'KEY_TYPE_ECDSA_EVM', publicKey: '0x0000000000000000000000000000000000000000' },
    ],
  },
});
const service = new TrustAnchorAdmissionService({
  uow: new PrismaUnitOfWork(client),
  clock: systemClock,
  ids: nodeIds,
  configuration,
  policy: packagedAdmissionPolicy,
  assertionSigner: signers.assertionSigner,
  bootstrapSigner: signers.bootstrapSigner,
  verifier,
});
wiring.service = service;

try {
  const started = await service.startInitialAdmission({
    operatorRef: 'operator-ref:maintainer-demo',
  });
  say('U2 candidate organization', 'LOCAL', { did: started.did });

  const applicantId = await operator.createRepresentative(
    started.providerSetup.representativeBindingRef,
  );
  await operator.forceReview(applicantId, representativeAnswer);
  say(
    'operator onboarding',
    'REAL',
    `Sumsub SANDBOX representative created with externalUserId = bindingRef; review forced ${representativeAnswer} (synthetic applicant)`,
  );

  await service.attachProviderReferences(started.sessionRef, {
    companyApplicantId: 'mock:company-fixture:MOCK_COMPANY_ACTIVE_GREEN',
    representativeApplicantId: applicantId,
  });
  say(
    'U3 provider references',
    'MOCK',
    'company = SYNTHETIC MOCK fixture reference; representative = REAL Sumsub sandbox applicant',
  );

  const key = await service.provisionAssertionKey(started.sessionRef);
  say('U4 Credential Assertion Key', 'REAL', {
    verificationMethod: key.verificationMethod.id,
    signer: 'Privy Solana Ed25519 wallet (dev app)',
  });

  await service.issueKeyPossessionChallenge(started.sessionRef);
  const proof = await service.proveKeyPossessionWithSecureSigner(started.sessionRef);
  say('U5/U6 proof of key possession', 'REAL', {
    possessionValid: proof.possessionValid,
    purposeValid: proof.purposeValid,
    cryptosuite: 'eddsa-jcs-2022 via Privy signMessage',
  });

  const { runId } = await service.requestConfidentialVerification(started.sessionRef);
  const outcome = await verifier.completion(runId);
  const delivery = deliveries.find((d) => d.runId === runId);
  say('U7/U8 confidential verification', 'SIMULATION', {
    handler: outcome.handlerResult ?? 'no result',
    callback: delivery ?? 'not delivered',
  });

  const run = await client.confidentialVerificationRun.findUnique({ where: { runId } });
  say('facts + reconciliation', 'SIMULATION', {
    status: run?.status,
    facts: run?.facts,
    reconciliation: (run?.commitmentInputs as { reconciliation?: unknown } | null)?.reconciliation,
    evidenceCommitment: run?.evidenceCommitment,
  });

  const decision = await service.evaluateAdmission(started.sessionRef);
  say('U9 policy:trust-anchor-admission:v1', 'LOCAL', decision);

  if (decision.outcome === 'ALLOW') {
    const { record } = await service.endorseAndActivate(started.sessionRef);
    say('U10 bootstrap endorsement + activation', 'REAL', {
      signer: 'separate Privy Bootstrap Endorsement Key wallet',
      trustAnchor: record.trustAnchor,
      status: 'ACTIVE (operational projection)',
    });
    const verification = await service.verifyTrustAnchor(started.did);
    say('U13 Trust Anchor verification', 'LOCAL', {
      TRUST_ANCHOR_VALID: verification.TRUST_ANCHOR_VALID,
      failedChecks: verification.checks.filter((c) => !c.passed).map((c) => c.id),
    });
  }

  const timeline = await new PrismaUnitOfWork(client).run((p) => p.audit.timeline(TD));
  say('audit chain', 'LOCAL', {
    events: timeline.map((e) => e.type),
    chain: verifyChain(TD, timeline),
  });
} finally {
  const out = `${ROOT}artifacts/demo/`;
  mkdirSync(out, { recursive: true });
  const file = `${out}s001-run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        demo: 'Catenor One — S001 Trust Anchor Admission',
        profile:
          'HYBRID_DEMO — Company evidence: SYNTHETIC MOCK · Representative verification: REAL SUMSUB SANDBOX',
        cre: 'SIMULATION (cre workflow simulate) — not a deployed Confidential Workflow',
        access:
          'maintainer/operator-initiated; the bootstrap access gate (AC-001–003) is not implemented',
        steps,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nRun record: ${file}`);
  verifier.dispose();
  await receiver.close();
  await client.$disconnect();
  await stopDatabase();
}
