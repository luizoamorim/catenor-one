// STEP A — S001 through a REAL `cre workflow simulate` run of workflows/identity-confidential, with a local MOCK
// Sumsub server (synthetic applicant, signature verified) and the SYNTHETIC MOCK company fixture. Opt-in:
// `pnpm test:cre-sim` (needs the CRE CLI, `bun install` in the workflow and workflows/.env.simulation-synthetic).
//
// Truthfulness: every CRE result here is SIMULATION. The representative data comes from the MOCK Sumsub server,
// so this runs ONLY against a throwaway Testcontainers database — the pinned HYBRID_DEMO profile labels the
// representative source REAL_SUMSUB_SANDBOX, which is true only for step B (the real Sumsub sandbox).
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { verifyChain } from '@catenor-one/audit';
import { bootstrapConfigurationHash, parseBootstrapConfiguration } from '@catenor-one/authority';
import { policyHash } from '@catenor-one/policy';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  startCallbackReceiver,
  type CallbackReceiver,
} from '../../infrastructure/confidential-compute/cre-callback-receiver.js';
import { deriveChannelKeys } from '../../infrastructure/confidential-compute/cre-channel.js';
import { CreSimulationConfidentialVerifier } from '../../infrastructure/confidential-compute/cre-simulation-verifier.js';
import {
  startMockSumsubServer,
  type MockSumsubServer,
} from '../../infrastructure/identity-providers/sumsub-sandbox.js';
import { selectSigners } from '../../infrastructure/key-management/signer-selection.js';
import type { PrismaClient } from '../../infrastructure/persistence/prisma/generated/client.js';
import {
  prisma,
  startPostgres,
} from '../../infrastructure/persistence/prisma/postgres.test-fixtures.js';
import {
  PrismaUnitOfWork,
  createPrismaClient,
} from '../../infrastructure/persistence/prisma/prisma-persistence.js';
import {
  nodeIds,
  packagedAdmissionPolicy,
  pinnedBootstrapConfiguration,
  systemClock,
} from '../../infrastructure/runtime/runtime-adapters.js';
import { TrustAnchorAdmissionService } from './application/trust-anchor-admission.service.js';

const WORKFLOWS = fileURLToPath(new URL('../../../../../workflows/', import.meta.url));
const API_ENV = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(API_ENV)) process.loadEnvFile(API_ENV); // Privy values, if provisioned (never printed)
const signers = selectSigners();
const ENV_FILE = `${WORKFLOWS}.env.simulation-synthetic`;
const CRE = process.env.CRE_BIN ?? `${homedir()}/.cre/bin/cre`;
const ready =
  existsSync(CRE) &&
  existsSync(ENV_FILE) &&
  existsSync(`${WORKFLOWS}identity-confidential/node_modules`);

/** Reads one variable from the SYNTHETIC simulation env file (values are never printed). */
const synthetic = (name: string) =>
  readFileSync(ENV_FILE, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`))
    ?.slice(name.length + 1)
    .trim() ?? '';

let container: StartedPostgreSqlContainer;
let client: PrismaClient;
let mockSumsub: MockSumsubServer;
let receiver: CallbackReceiver;

describe.skipIf(!ready)(
  `STEP A — S001 through cre workflow simulate (SIMULATION, MOCK Sumsub server, ${signers.kind} signers)`,
  () => {
    const keys = deriveChannelKeys(
      ready ? synthetic('CATENOR_INTERNAL_API_TOKEN_VAR') : 'a1'.repeat(32),
    );
    const deliveries: { accepted: boolean; reason?: string; runId?: string }[] = [];
    let service: TrustAnchorAdmissionService;
    let verifier: CreSimulationConfidentialVerifier;

    beforeAll(async () => {
      container = await startPostgres();
      const deploy = await prisma(container.getConnectionUri(), ['migrate', 'deploy']);
      if (deploy.code !== 0) throw new Error(deploy.output);
      client = createPrismaClient(container.getConnectionUri());
      mockSumsub = await startMockSumsubServer({
        port: 18788,
        secretKey: synthetic('SUMSUB_SECRET_KEY_VAR'),
      });

      const bootstrapSigner = signers.bootstrapSigner;
      const raw = {
        type: 'CatenorTrustDomainBootstrapConfiguration',
        profile: 'catenor-one/bootstrap-configuration/v1',
        trustDomain: 'trust-domain:catenor-one-demo',
        admissionPolicy: 'policy:trust-anchor-admission:v1',
        admissionPolicyHash: policyHash(packagedAdmissionPolicy.load()),
        bootstrapVerificationMethod: 'bootstrap-verification-method:1',
        bootstrapPublicKeyMultibase: await bootstrapSigner.publicKeyMultibase(),
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
      receiver = await startCallbackReceiver({
        port: 18787,
        keys,
        now: () => new Date(),
        deliver: (result) => service.recordConfidentialVerificationResult(result),
        onEvent: (e) => deliveries.push(e),
      });
      verifier = new CreSimulationConfidentialVerifier({
        keys,
        projectRoot: WORKFLOWS,
        workflowFolder: 'identity-confidential',
        target: 'staging-settings',
        envFile: ENV_FILE,
        limitsFile: `${WORKFLOWS}identity-confidential/test/limits.production-like.json`,
        creBinary: CRE,
        workflowConfig: {
          callbackUrl: receiver.url,
          sumsubBaseUrl: mockSumsub.baseUrl,
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
      service = new TrustAnchorAdmissionService({
        uow: new PrismaUnitOfWork(client),
        clock: systemClock,
        ids: nodeIds,
        configuration,
        policy: packagedAdmissionPolicy,
        assertionSigner: signers.assertionSigner,
        bootstrapSigner,
        verifier,
      });
    }, 300_000);

    afterAll(async () => {
      verifier?.dispose();
      await receiver?.close();
      await mockSumsub?.close();
      await client?.$disconnect();
      await container?.stop();
    });

    async function throughConfidentialRun(representativeAnswer: 'GREEN' | 'RED') {
      const started = await service.startInitialAdmission({ operatorRef: 'operator-ref:step-a' });
      const applicantId = `mocksumsub-${nodeIds.id('a').slice(2, 14)}`;
      mockSumsub.register(
        applicantId,
        started.providerSetup.representativeBindingRef,
        representativeAnswer,
      );
      await service.attachProviderReferences(started.sessionRef, {
        companyApplicantId: 'mock:company-fixture:MOCK_COMPANY_ACTIVE_GREEN',
        representativeApplicantId: applicantId,
      });
      await service.provisionAssertionKey(started.sessionRef);
      await service.issueKeyPossessionChallenge(started.sessionRef);
      await service.proveKeyPossessionWithSecureSigner(started.sessionRef);
      const { runId, mode } = await service.requestConfidentialVerification(started.sessionRef);
      expect(mode).toBe('SIMULATION');
      const outcome = await verifier.completion(runId);
      expect(outcome.handlerResult ?? outcome.outputTail).toMatch(/"status":\s*"DELIVERED"/);
      expect(deliveries.find((d) => d.runId === runId)).toMatchObject({ accepted: true });
      return { started, runId };
    }

    // DENY first: after the GREEN admission the Trust Domain's single initial root exists.
    it('representative RED (SANCTIONS, FINAL) → AUTHORIZED_REPRESENTATIVE_VERIFIED false → DENY', async () => {
      const { started } = await throughConfidentialRun('RED');
      expect(await service.evaluateAdmission(started.sessionRef)).toMatchObject({
        outcome: 'DENY',
      });
      const trace = await client.decisionTrace.findUnique({
        where: {
          decisionRef_claim: {
            decisionRef: (await client.decisionRecord.findFirst({
              where: { session: { sessionRef: started.sessionRef } },
            }))!.decisionRef,
            claim: 'AUTHORIZED_REPRESENTATIVE_VERIFIED',
          },
        },
      });
      expect(trace).toMatchObject({ status: 'FALSE', reasons: ['SANCTIONS', 'FINAL'] });
    });

    it('representative GREEN → the simulated TEE derives six true facts → ALLOW → ACTIVE → TRUST_ANCHOR_VALID', async () => {
      const { started, runId } = await throughConfidentialRun('GREEN');
      expect(mockSumsub.requests.some((r) => r.signatureValid)).toBe(true);
      const run = await client.confidentialVerificationRun.findUnique({ where: { runId } });
      expect(run).toMatchObject({ status: 'EVIDENCE_RECEIVED' });
      expect(run?.commitmentInputs).toMatchObject({
        mode: 'SIMULATION',
        reconciliation: { company: 'CONSISTENT', representative: 'CONSISTENT' },
      });
      expect(await service.evaluateAdmission(started.sessionRef)).toMatchObject({
        outcome: 'ALLOW',
      });
      await service.endorseAndActivate(started.sessionRef);
      const verification = await service.verifyTrustAnchor(started.did);
      expect(verification.TRUST_ANCHOR_VALID).toBe(true);
      expect(
        await client.keyManagementReference.findFirst({ where: { subject: { did: started.did } } }),
      ).toMatchObject({ adapter: signers.kind === 'PRIVY' ? 'privy' : 'fake' });
      const timeline = await new PrismaUnitOfWork(client).run((p) =>
        p.audit.timeline('trust-domain:catenor-one-demo'),
      );
      expect(verifyChain('trust-domain:catenor-one-demo', timeline)).toEqual({ valid: true });
    });
  },
);
