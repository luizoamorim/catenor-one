// S001 vertical path on real PostgreSQL through the application service. Signers and the confidential
// verifier are the labeled FAKE adapters (no Privy, no Sumsub, no CRE here) — this proves the orchestration,
// persistence and domain rules end to end, not any sponsor integration.
import { commit, verifyChain } from '@catenor-one/audit';
import {
  bootstrapConfigurationHash,
  parseBootstrapConfiguration,
  type TrustAnchorVerificationResult,
} from '@catenor-one/authority';
import { attachProofValue, prepareProof } from '@catenor-one/credentials';
import {
  assertionKeyId,
  createDidDocument,
  createVerificationMethod,
  type CatenorDid,
} from '@catenor-one/identity';
import { policyHash } from '@catenor-one/policy';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ed25519 } from '@noble/curves/ed25519.js';
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
  systemClock,
} from '../../infrastructure/runtime/runtime-adapters.js';
import {
  AdmissionError,
  TrustAnchorAdmissionService,
} from './application/trust-anchor-admission.service.js';

let container: StartedPostgreSqlContainer;
let client: PrismaClient;

beforeAll(async () => {
  container = await startPostgres();
  const deploy = await prisma(container.getConnectionUri(), ['migrate', 'deploy']);
  if (deploy.code !== 0) throw new Error(deploy.output);
  client = createPrismaClient(container.getConnectionUri());
});

afterAll(async () => {
  await client?.$disconnect();
  await container?.stop();
});

/** A service for one Trust Domain, with a Bootstrap Configuration pinned to the FAKE bootstrap key. */
async function harness(trustDomain: string) {
  const bootstrapSigner = new FakeBootstrapEndorsementSigner();
  const raw = {
    type: 'CatenorTrustDomainBootstrapConfiguration',
    profile: 'catenor-one/bootstrap-configuration/v1',
    trustDomain,
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
  const service = new TrustAnchorAdmissionService({
    uow: new PrismaUnitOfWork(client),
    clock: systemClock,
    ids: nodeIds,
    configuration,
    policy: packagedAdmissionPolicy,
    assertionSigner: new FakeAssertionSigner(),
    bootstrapSigner,
    verifier,
  });
  return { service, verifier, trustDomain };
}

/** Steps shared by every scenario up to a valid key proof. */
async function throughKeyProof(h: Awaited<ReturnType<typeof harness>>) {
  const started = await h.service.startInitialAdmission({ operatorRef: 'operator-ref:test' });
  await h.service.attachProviderReferences(started.sessionRef, {
    companyApplicantId: 'mock:company-fixture:MOCK_COMPANY_ACTIVE_GREEN',
    representativeApplicantId: 'sandbox-applicant-fixture',
  });
  await h.service.provisionAssertionKey(started.sessionRef);
  await h.service.issueKeyPossessionChallenge(started.sessionRef);
  return started;
}

const traceOf = (sessionRef: string) =>
  client.decisionTrace.findMany({
    where: { decisionRecord: { session: { sessionRef } } },
    select: { claim: true, status: true, reasons: true },
  });

describe('S001 Trust Anchor Admission — happy path (FAKE signers, FAKE verifier)', () => {
  it('candidate → did:catenor → key proof → evidence → ALLOW → endorsement → ACTIVE → TRUST_ANCHOR_VALID', async () => {
    const h = await harness('trust-domain:catenor-one-demo');
    const started = await throughKeyProof(h);
    expect(started.did).toMatch(/^did:catenor:[0-9a-f]{32}$/);
    expect(started.providerSetup.companyBindingRef).toMatch(/^cbr-[0-9a-f]{32}$/);

    const proof = await h.service.proveKeyPossessionWithSecureSigner(started.sessionRef);
    expect(proof).toMatchObject({ possessionValid: true, purposeValid: true, reasons: [] });

    const { runId, mode } = await h.service.requestConfidentialVerification(started.sessionRef);
    expect(mode).toBe('FAKE');
    expect(
      await h.service.recordConfidentialVerificationResult(h.verifier.resultFor(runId, 'GREEN')),
    ).toEqual({ accepted: true });
    // one result per run: a duplicate delivery is refused
    expect(
      await h.service.recordConfidentialVerificationResult(h.verifier.resultFor(runId, 'GREEN')),
    ).toEqual({
      accepted: false,
      reason: 'LATE_OR_DUPLICATE_RESULT',
    });

    expect(await h.service.evaluateAdmission(started.sessionRef)).toMatchObject({
      outcome: 'ALLOW',
    });
    const { record, endorsement } = await h.service.endorseAndActivate(started.sessionRef);
    expect(record).toMatchObject({
      trustAnchor: started.did,
      trustDomain: h.trustDomain,
      decision: 'ADMIT_TRUST_ANCHOR',
    });
    expect(endorsement.proof.cryptosuite).toBe('eddsa-jcs-2022');

    const verification: TrustAnchorVerificationResult = await h.service.verifyTrustAnchor(
      started.did,
    );
    expect(verification.checks.filter((c) => !c.passed)).toEqual([]);
    expect(verification.TRUST_ANCHOR_VALID).toBe(true);
    expect(verification.lifecycleStatusSource).toBe('catenor-one-operational-projection');

    const timeline = await new PrismaUnitOfWork(client).run((p) => p.audit.timeline(h.trustDomain));
    expect(verifyChain(h.trustDomain, timeline)).toEqual({ valid: true });
    expect(timeline.map((e) => e.type)).toEqual([
      'SUBJECT_CREATED',
      'ADMISSION_REQUESTED',
      'PROVIDER_REFERENCES_ATTACHED',
      'KEY_ADDED',
      'DID_DOCUMENT_CREATED',
      'KEY_POSSESSION_VERIFIED',
      'CONFIDENTIAL_VERIFICATION_REQUESTED',
      'CONFIDENTIAL_EVIDENCE_VERIFIED',
      'POLICY_EVALUATED',
      'BOOTSTRAP_ENDORSEMENT_CREATED',
      'TRUST_ANCHOR_ADMITTED',
    ]);

    // the MOCK company binding is never recorded as a verified provider binding
    const bindings = await client.providerBinding.findMany({
      where: { subject: { did: started.did } },
      orderBy: { role: 'asc' },
      select: { role: true, status: true },
    });
    expect(bindings).toEqual([
      { role: 'COMPANY', status: 'ATTACHED_UNVERIFIED' },
      { role: 'REPRESENTATIVE', status: 'BINDING_VERIFIED' },
    ]);

    // a second initial admission for this Trust Domain is refused
    await expect(
      h.service.startInitialAdmission({ operatorRef: 'operator-ref:test' }),
    ).rejects.toMatchObject({
      code: 'INITIAL_TRUST_ANCHOR_EXISTS',
    });
  });
});

describe('S001 DENY paths', () => {
  it('wrong key signs the challenge → POSSESSION FALSE → immediate DENY, no confidential call (TV-D02, D23)', async () => {
    const h = await harness('trust-domain:deny-wrong-key');
    const started = await throughKeyProof(h);
    const challenge = await new PrismaUnitOfWork(client).run(async (p) => {
      const s = await p.admissions.loadSession(started.sessionRef);
      return (await p.admissions.loadChallenge(`challenge:${s!.id}`))!.challenge;
    });
    const wrongKey = ed25519.utils.randomSecretKey();
    const { proofOptions, hashData } = prepareProof(
      { ...challenge },
      {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: challenge.verificationMethod,
        proofPurpose: 'assertionMethod',
        created: '2026-09-11T00:00:00Z',
        challenge: challenge.nonce,
        domain: challenge.trustDomain,
      },
    );
    const outcome = await h.service.submitKeyPossessionProof(
      started.sessionRef,
      attachProofValue(proofOptions, ed25519.sign(hashData, wrongKey)),
    );
    expect(outcome).toMatchObject({
      possessionValid: false,
      reasons: ['SIGNATURE_INVALID'],
      decision: { outcome: 'DENY' },
    });
    await expect(h.service.requestConfidentialVerification(started.sessionRef)).rejects.toThrow();
    await expect(h.service.endorseAndActivate(started.sessionRef)).rejects.toMatchObject({
      code: 'ENDORSEMENT_REFUSED',
    });
    expect(await traceOf(started.sessionRef)).toEqual(
      expect.arrayContaining([
        {
          claim: 'ASSERTION_KEY_POSSESSION_VALID',
          status: 'FALSE',
          reasons: ['SIGNATURE_INVALID'],
        },
        { claim: 'ORGANIZATION_KYB_VERIFIED', status: 'MISSING', reasons: [] },
      ]),
    );
    // [REF-IMPL] local decision evidence — no confidential/provider evidence is claimed
    const record = await client.decisionRecord.findFirst({
      where: { session: { sessionRef: started.sessionRef } },
    });
    expect(record?.evidenceCommitment).toBe(
      commit({
        profile: 'catenor-one/local-decision-evidence/v1',
        subject: started.did,
        trustDomain: h.trustDomain,
        verificationMethod: challenge.verificationMethod,
        keyPossessionResult: 'INVALID',
        keyPurposeResult: 'VALID',
        reason: ['SIGNATURE_INVALID'],
        confidentialVerification: 'NOT_REQUESTED',
      }),
    );
  });

  it('REAL-shaped representative RED → AUTHORIZED_REPRESENTATIVE_VERIFIED FALSE → DENY; endorsement refused', async () => {
    const h = await harness('trust-domain:deny-red');
    const started = await throughKeyProof(h);
    await h.service.proveKeyPossessionWithSecureSigner(started.sessionRef);
    const { runId } = await h.service.requestConfidentialVerification(started.sessionRef);
    await h.service.recordConfidentialVerificationResult(
      h.verifier.resultFor(runId, 'REPRESENTATIVE_RED'),
    );
    expect(await h.service.evaluateAdmission(started.sessionRef)).toMatchObject({
      outcome: 'DENY',
    });
    await expect(h.service.endorseAndActivate(started.sessionRef)).rejects.toBeInstanceOf(
      AdmissionError,
    );
    expect(await traceOf(started.sessionRef)).toEqual(
      expect.arrayContaining([
        {
          claim: 'AUTHORIZED_REPRESENTATIVE_VERIFIED',
          status: 'FALSE',
          reasons: ['SANCTIONS', 'FINAL'],
        },
      ]),
    );
    expect(await client.decisionProjection.count({ where: { subject: started.did } })).toBe(0);
  });

  it('stale evidence → EVIDENCE_FRESH FALSE → DENY', async () => {
    const h = await harness('trust-domain:deny-stale');
    const started = await throughKeyProof(h);
    await h.service.proveKeyPossessionWithSecureSigner(started.sessionRef);
    const { runId } = await h.service.requestConfidentialVerification(started.sessionRef);
    await h.service.recordConfidentialVerificationResult(
      h.verifier.resultFor(runId, 'STALE_EVIDENCE'),
    );
    expect(await h.service.evaluateAdmission(started.sessionRef)).toMatchObject({
      outcome: 'DENY',
    });
  });

  it('provider-binding mismatch → run BINDING_MISMATCH, no facts → never ALLOW (TV-E11)', async () => {
    const h = await harness('trust-domain:deny-binding');
    const started = await throughKeyProof(h);
    await h.service.proveKeyPossessionWithSecureSigner(started.sessionRef);
    const { runId } = await h.service.requestConfidentialVerification(started.sessionRef);
    await h.service.recordConfidentialVerificationResult(
      h.verifier.resultFor(runId, 'BINDING_MISMATCH'),
    );
    const run = await client.confidentialVerificationRun.findUnique({ where: { runId } });
    expect(run).toMatchObject({ status: 'BINDING_MISMATCH', facts: null });
    await expect(h.service.evaluateAdmission(started.sessionRef)).rejects.toMatchObject({
      code: 'EVIDENCE_COMMITMENT_UNDEFINED',
    });
    expect(
      await client.decisionRecord.count({
        where: { session: { sessionRef: started.sessionRef } },
      }),
    ).toBe(0);
  });

  it('a result whose evidence sources differ from the pinned configuration is rejected with no facts (TV-B04)', async () => {
    const h = await harness('trust-domain:deny-source');
    const started = await throughKeyProof(h);
    await h.service.proveKeyPossessionWithSecureSigner(started.sessionRef);
    const { runId } = await h.service.requestConfidentialVerification(started.sessionRef);
    const forged = {
      ...h.verifier.resultFor(runId, 'GREEN'),
      evidenceSources: { company: 'REAL_SUMSUB_SANDBOX', representative: 'REAL_SUMSUB_SANDBOX' },
    } as const;
    expect(await h.service.recordConfidentialVerificationResult(forged)).toEqual({
      accepted: false,
      reason: 'EVIDENCE_SOURCE_MISMATCH',
    });
    await expect(h.service.evaluateAdmission(started.sessionRef)).rejects.toMatchObject({
      code: 'EVIDENCE_COMMITMENT_UNDEFINED',
    });
    expect(
      await client.decisionRecord.count({
        where: { session: { sessionRef: started.sessionRef } },
      }),
    ).toBe(0);
  });
});

describe('U4 assertion key provisioning', () => {
  it('reuses an existing ACTIVE assertion key of the Subject instead of creating another wallet', async () => {
    const h = await harness('trust-domain:reuse-key');
    const started = await h.service.startInitialAdmission({ operatorRef: 'operator-ref:test' });
    const signer = new FakeAssertionSigner();
    const existing = await signer.createKey();
    const vm = createVerificationMethod(
      assertionKeyId(started.did as CatenorDid, 1),
      started.did as CatenorDid,
      existing.publicKeyMultibase,
    );
    await new PrismaUnitOfWork(client).run(async (p) => {
      const subject = await p.subjects.findSubjectByDid(started.did);
      await p.didState.publishAssertionKey({
        document: createDidDocument(started.did as CatenorDid, [vm], [vm.id]),
        lifecycle: 'ACTIVE',
        verificationMethod: vm,
        subjectId: subject!.id,
        keyReference: {
          subject: started.did as CatenorDid,
          verificationMethod: vm.id,
          signerRef: existing.signerRef,
          purpose: 'CREDENTIAL_ASSERTION',
          status: 'ACTIVE',
        },
        adapter: 'fake',
      });
    });
    const walletsBefore = await client.keyManagementReference.count();
    const provisioned = await h.service.provisionAssertionKey(started.sessionRef);
    expect(provisioned.verificationMethod).toEqual(vm);
    expect(await client.keyManagementReference.count()).toBe(walletsBefore);
    const session = await client.admissionSession.findUnique({
      where: { sessionRef: started.sessionRef },
    });
    expect(session).toMatchObject({ state: 'KEY_PROVISIONED', assertionVerificationMethod: vm.id });
  });
});
