// Part B on real PostgreSQL: ACTIVE Trust Anchor (admitted through the S001 service) → signed scoped capability →
// Org B request → ALLOW invokes the executor exactly once; every DENY leaves the executor untouched. Signers and the
// confidential verifier are the labeled FAKE adapters; the executor is a test spy (the Hedera adapter is separate).
import { verifyChain } from '@catenor-one/audit';
import { bootstrapConfigurationHash, parseBootstrapConfiguration } from '@catenor-one/authority';
import { policyHash } from '@catenor-one/policy';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeConfidentialVerifier } from '../../infrastructure/confidential-compute/fake-confidential-verifier.js';
import {
  FakeAssertionSigner,
  FakeBootstrapEndorsementSigner,
} from '../../infrastructure/key-management/fake-signers.js';
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
} from '../../infrastructure/runtime/runtime-adapters.js';
import { TrustAnchorAdmissionService } from '../trust-anchor-admission/application/trust-anchor-admission.service.js';
import {
  AssetTokenizationService,
  CapabilityGrantRefused,
  type AssetTokenizationExecutor,
} from './application/asset-tokenization.service.js';

const TD = 'trust-domain:catenor-one-demo';
const RESOURCE = 'spv:catenor-demo-001';

let container: StartedPostgreSqlContainer;
let client: PrismaClient;
let now = new Date('2026-09-12T10:00:00Z');
const clock = { now: () => now };
const executions: { resource: string; requester: string; grantId: string }[] = [];
const executor: AssetTokenizationExecutor = {
  network: 'test-spy',
  async tokenize(input) {
    executions.push(input);
    return { transactionId: `spy-tx-${executions.length}` };
  },
};
let admission: TrustAnchorAdmissionService;
let tokenization: AssetTokenizationService;
let trustAnchor: string;

beforeAll(async () => {
  container = await startPostgres();
  const deploy = await prisma(container.getConnectionUri(), ['migrate', 'deploy']);
  if (deploy.code !== 0) throw new Error(deploy.output);
  client = createPrismaClient(container.getConnectionUri());
  const uow = new PrismaUnitOfWork(client);
  const signer = new FakeAssertionSigner();
  const bootstrapSigner = new FakeBootstrapEndorsementSigner();
  const raw = {
    type: 'CatenorTrustDomainBootstrapConfiguration',
    profile: 'catenor-one/bootstrap-configuration/v1',
    trustDomain: TD,
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
  const configuration = pinnedBootstrapConfiguration(
    raw,
    bootstrapConfigurationHash(parseBootstrapConfiguration(raw)),
  );
  const verifier = new FakeConfidentialVerifier(configuration.load());
  admission = new TrustAnchorAdmissionService({
    uow,
    clock,
    ids: nodeIds,
    configuration,
    policy: packagedAdmissionPolicy,
    assertionSigner: signer,
    bootstrapSigner,
    verifier,
  });
  const started = await admission.startInitialAdmission({ operatorRef: 'operator-ref:test' });
  await admission.attachProviderReferences(started.sessionRef, {
    companyApplicantId: 'mock:company-fixture:MOCK_COMPANY_ACTIVE_GREEN',
    representativeApplicantId: 'sandbox-applicant-fixture',
  });
  await admission.provisionAssertionKey(started.sessionRef);
  await admission.issueKeyPossessionChallenge(started.sessionRef);
  await admission.proveKeyPossessionWithSecureSigner(started.sessionRef);
  const { runId } = await admission.requestConfidentialVerification(started.sessionRef);
  await admission.recordConfidentialVerificationResult(verifier.resultFor(runId, 'GREEN'));
  await admission.evaluateAdmission(started.sessionRef);
  await admission.endorseAndActivate(started.sessionRef);
  trustAnchor = started.did;
  tokenization = new AssetTokenizationService({
    uow,
    clock,
    ids: nodeIds,
    trustDomain: TD,
    assertionSigner: signer,
    verifyTrustAnchor: (did) => admission.verifyTrustAnchor(did),
    executor,
  });
});

afterAll(async () => {
  await client?.$disconnect();
  await container?.stop();
});

describe('Part B — scoped tokenization capability [REF-IMPL demo profile]', () => {
  it('ACTIVE Trust Anchor → grant to Org B → Org B request → ALLOW → executor invoked once', async () => {
    const orgB = await tokenization.registerOrganization();
    const grant = await tokenization.grantTokenizationCapability({
      issuer: trustAnchor,
      subject: orgB.did,
      resource: RESOURCE,
      validUntil: '2026-09-14T00:00:00Z',
    });
    expect(grant.capability).toEqual({
      subject: orgB.did,
      action: 'TOKENIZE_ASSET',
      resource: RESOURCE,
      constraints: { validUntil: '2026-09-14T00:00:00Z' },
    });
    const outcome = await tokenization.requestTokenization({
      requester: orgB.did,
      resource: RESOURCE,
      grant,
    });
    expect(outcome).toMatchObject({ decision: 'ALLOW', transactionId: 'spy-tx-1' });
    expect(executions).toHaveLength(1);

    // DENY cases — the executor is never invoked.
    const orgC = await tokenization.registerOrganization();
    const denials = [
      [
        await tokenization.requestTokenization({
          requester: orgB.did,
          resource: RESOURCE,
          grant: undefined,
        }),
        'CAPABILITY_MISSING',
      ],
      [
        await tokenization.requestTokenization({ requester: orgC.did, resource: RESOURCE, grant }),
        'SUBJECT_MISMATCH',
      ],
      [
        await tokenization.requestTokenization({
          requester: orgB.did,
          resource: 'spv:catenor-demo-002',
          grant,
        }),
        'RESOURCE_MISMATCH',
      ],
      [
        await tokenization.requestTokenization({
          requester: orgB.did,
          resource: 'spv:catenor-demo-002',
          grant: {
            ...grant,
            capability: { ...grant.capability, resource: 'spv:catenor-demo-002' },
          },
        }),
        'SIGNATURE_INVALID',
      ],
    ] as const;
    for (const [result, reason] of denials) {
      expect(result).toMatchObject({ decision: 'DENY', reasons: expect.arrayContaining([reason]) });
    }
    now = new Date('2026-09-15T00:00:00Z');
    expect(
      await tokenization.requestTokenization({ requester: orgB.did, resource: RESOURCE, grant }),
    ).toMatchObject({ decision: 'DENY', reasons: ['EXPIRED'] });
    now = new Date('2026-09-12T10:00:00Z');
    expect(executions).toHaveLength(1);

    // The issuer loses ACTIVE status (operational projection) → the same valid grant no longer authorizes.
    await client.trustAnchorStatusProjection.update({
      where: { trustDomain_did: { trustDomain: TD, did: trustAnchor } },
      data: { status: 'SUSPENDED', changedAt: new Date() },
    });
    expect(
      await tokenization.requestTokenization({ requester: orgB.did, resource: RESOURCE, grant }),
    ).toMatchObject({ decision: 'DENY', reasons: ['ISSUER_NOT_ACTIVE_TRUST_ANCHOR'] });
    await expect(
      tokenization.grantTokenizationCapability({
        issuer: trustAnchor,
        subject: orgB.did,
        resource: RESOURCE,
        validUntil: '2026-09-14T00:00:00Z',
      }),
    ).rejects.toBeInstanceOf(CapabilityGrantRefused);
    expect(executions).toHaveLength(1);

    const timeline = await new PrismaUnitOfWork(client).run((p) => p.audit.timeline(TD));
    expect(verifyChain(TD, timeline)).toEqual({ valid: true });
    const types = timeline.map((e) => e.type);
    for (const t of [
      'CAPABILITY_GRANTED',
      'ASSET_ACTION_AUTHORIZED',
      'ASSET_ACTION_EXECUTED',
      'ASSET_ACTION_DENIED',
    ]) {
      expect(types).toContain(t);
    }
  });

  it('a Subject that is not a Trust Anchor cannot grant the capability', async () => {
    const orgB = await tokenization.registerOrganization();
    const orgC = await tokenization.registerOrganization();
    await expect(
      tokenization.grantTokenizationCapability({
        issuer: orgC.did,
        subject: orgB.did,
        resource: RESOURCE,
        validUntil: '2026-09-14T00:00:00Z',
      }),
    ).rejects.toBeInstanceOf(CapabilityGrantRefused);
  });
});
