// T3.3 (minimum) — S001 persistence ports on real PostgreSQL: the demo path end to end, plus the critical
// invariants only (atomic rollback, single initial root, single-use challenge, one result per run, a
// linear audit chain under concurrency, DENY kept private).
import { verifyChain, type AuditEvent } from '@catenor-one/audit';
import {
  issueChallenge,
  type BootstrapEndorsement,
  type TrustAnchorAdmissionRecord,
} from '@catenor-one/authority';
import type { DidDocument, KeyManagementReference } from '@catenor-one/identity';
import { FACT_NAMES, type Decision } from '@catenor-one/policy';
import { loadVector } from '@catenor-one/test-vectors';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  DecisionTraceEntry,
  PersistencePorts,
} from '../../../modules/trust-anchor-admission/application/persistence.ports.js';
import type { PrismaClient } from './generated/client.js';
import { did, hash, prisma, startPostgres } from './postgres.test-fixtures.js';
import { PrismaUnitOfWork, createPrismaClient } from './prisma-persistence.js';

// Deterministic S001 golden admission (TEST-ONLY keys; test-vectors/s001/admission.json).
const golden = loadVector<{
  bootstrapConfigurationHash: string;
  didDocument: DidDocument;
  decision: Decision;
  decisionRef: string;
  decisionCommitment: string;
  endorsement: BootstrapEndorsement;
  admissionRecord: TrustAnchorAdmissionRecord;
}>('s001', 'admission');
const TD = golden.admissionRecord.trustDomain;
const DID = golden.didDocument.id;
const VM = golden.didDocument.verificationMethod[0]!;
const NONCE = Buffer.alloc(32, 7).toString('base64url');

let container: StartedPostgreSqlContainer;
let client: PrismaClient;
let uow: PrismaUnitOfWork;

beforeAll(async () => {
  container = await startPostgres();
  const deploy = await prisma(container.getConnectionUri(), ['migrate', 'deploy']);
  if (deploy.code !== 0) throw new Error(deploy.output);
  client = createPrismaClient(container.getConnectionUri());
  uow = new PrismaUnitOfWork(client);
});

afterAll(async () => {
  await client?.$disconnect();
  await container?.stop();
});

const satisfiedTrace: DecisionTraceEntry[] = FACT_NAMES.map((claim) => ({
  claim,
  status: 'SATISFIED',
  factValue: true,
  provenance: {
    source: claim.startsWith('ASSERTION_KEY_')
      ? 'KEY_POSSESSION_VERIFIER'
      : 'CONFIDENTIAL_VERIFICATION',
    ref: claim.startsWith('ASSERTION_KEY_') ? 'challenge:happy' : 'run:happy',
  },
  reasons: [],
}));

const event = (type: AuditEvent['type'], at: string, extra: Partial<AuditEvent> = {}) =>
  ({ type, subject: DID, timestamp: at, requestId: 'sref:happy', ...extra }) as AuditEvent;

describe('S001 demo path through the persistence ports (one UnitOfWork)', () => {
  it('persists subject, bindings, DID state, session, challenge, run, decision, endorsement, record and root', async () => {
    await uow.run(async (p) => {
      await p.trustAnchors.registerTrustDomain(TD, golden.bootstrapConfigurationHash);
      await p.subjects.createSubject({
        id: 'subject:happy',
        did: DID,
        type: 'ORGANIZATION',
        lifecycle: 'ACTIVE',
      });
      await p.audit.append(TD, event('SUBJECT_CREATED', '2026-09-09T21:59:00Z'));
      await p.subjects.createProviderBindings([
        {
          id: 'binding:c',
          subjectId: 'subject:happy',
          provider: 'sumsub',
          role: 'COMPANY',
          bindingRef: 'cbr-company-1',
        },
        {
          id: 'binding:r',
          subjectId: 'subject:happy',
          provider: 'sumsub',
          role: 'REPRESENTATIVE',
          bindingRef: 'cbr-rep-1',
        },
      ]);
      await p.subjects.attachProviderReference(
        'subject:happy',
        'COMPANY',
        'mock:company-fixture:happy',
      );
      await p.subjects.attachProviderReference(
        'subject:happy',
        'REPRESENTATIVE',
        'applicant-fixture-1',
      );
      const keyReference: KeyManagementReference = {
        subject: DID,
        verificationMethod: VM.id,
        signerRef: 'signer:fixture:assertion-key-1',
        purpose: 'CREDENTIAL_ASSERTION',
        status: 'ACTIVE',
      };
      await p.didState.publishAssertionKey({
        document: golden.didDocument,
        lifecycle: 'ACTIVE',
        verificationMethod: VM,
        subjectId: 'subject:happy',
        keyReference,
        adapter: 'fake',
      });
      await p.admissions.createSession({
        id: 'session:happy',
        sessionRef: 'sref:happy',
        trustDomain: TD,
        subjectId: 'subject:happy',
        operatorRef: 'operator-ref',
        state: 'KEY_PROVISIONED',
        providerRefsAttached: true,
        assertionVerificationMethod: VM.id,
        keyPossessionReasons: [],
      });
      await p.admissions.issueChallenge(
        'session:happy',
        issueChallenge({
          challengeId: 'challenge:happy',
          subject: DID,
          verificationMethod: VM.id,
          trustDomain: TD,
          nonce: NONCE,
          issuedAt: new Date('2026-09-09T22:00:00Z'),
        }),
      );
      expect(await p.admissions.consumeChallenge('challenge:happy', new Date())).toBe(true);
      expect(await p.admissions.consumeChallenge('challenge:happy', new Date())).toBe(false);
      await p.admissions.updateSession('session:happy', {
        state: 'KEY_PROOF_VALID',
        keyPossessionValid: true,
        keyPurposeValid: true,
      });
      await p.admissions.createVerificationRun({
        runId: 'run:happy',
        sessionId: 'session:happy',
        attempt: 1,
        operation: 'TRUST_ANCHOR_ADMISSION',
        creWorkflowId: 'workflow:simulation',
        deadlineAt: new Date('2026-09-09T22:10:00Z'),
        evidenceSources: { company: 'SYNTHETIC_MOCK', representative: 'REAL_SUMSUB_SANDBOX' },
      });
      const result = {
        status: 'EVIDENCE_RECEIVED' as const,
        facts: [],
        evidenceCommitment: golden.decision.evidenceCommitment,
      };
      expect(await p.admissions.recordVerificationResult('run:happy', result)).toBe(true);
      expect(await p.admissions.recordVerificationResult('run:happy', result)).toBe(false);
      await p.subjects.setProviderBindingStatus(
        'subject:happy',
        'REPRESENTATIVE',
        'BINDING_VERIFIED',
      );
      await p.admissions.recordDecision({
        sessionId: 'session:happy',
        decisionRef: golden.decisionRef,
        decision: golden.decision,
        decisionCommitment: golden.decisionCommitment,
        policyHash: golden.admissionRecord.policyHash,
        trace: satisfiedTrace,
      });
      await p.audit.append(
        TD,
        event('POLICY_EVALUATED', '2026-09-09T22:10:00Z', {
          details: { decision: 'ALLOW', falseRequirements: [], missingRequirements: [] },
        }),
      );
      await p.admissions.saveEndorsement(golden.endorsement);
      await p.admissions.saveAdmissionRecord('record:happy', golden.admissionRecord);
      expect(await p.trustAnchors.establishInitialTrustAnchor(TD, DID, new Date())).toBe(
        'ESTABLISHED',
      );
      await p.audit.append(TD, event('TRUST_ANCHOR_ADMITTED', '2026-09-10T00:00:02Z'));
    });

    await uow.run(async (p) => {
      expect(await p.subjects.findSubjectByDid(DID)).toMatchObject({
        id: 'subject:happy',
        type: 'ORGANIZATION',
      });
      expect(await p.subjects.listProviderBindings('subject:happy')).toMatchObject([
        {
          role: 'COMPANY',
          status: 'ATTACHED_UNVERIFIED',
          externalSubjectId: 'mock:company-fixture:happy',
        },
        {
          role: 'REPRESENTATIVE',
          status: 'BINDING_VERIFIED',
          externalSubjectId: 'applicant-fixture-1',
        },
      ]);
      expect(await p.didState.resolve(DID)).toEqual({
        document: golden.didDocument,
        lifecycle: 'ACTIVE',
      });
      expect(await p.didState.findKeyReference(VM.id)).toMatchObject({
        subject: DID,
        purpose: 'CREDENTIAL_ASSERTION',
      });
      expect(await p.didState.verificationMethodStatus(VM.id)).toBe('ACTIVE');
      expect(await p.admissions.loadSession('sref:happy')).toMatchObject({
        state: 'KEY_PROOF_VALID',
        keyPossessionValid: true,
        keyPurposeValid: true,
      });
      const challenge = await p.admissions.loadChallenge('challenge:happy');
      expect(challenge).toMatchObject({
        status: 'CONSUMED',
        challenge: { nonce: NONCE, subject: DID },
      });
      expect(await p.admissions.loadVerificationRun('run:happy')).toMatchObject({
        status: 'EVIDENCE_RECEIVED',
        evidenceSources: { company: 'SYNTHETIC_MOCK', representative: 'REAL_SUMSUB_SANDBOX' },
      });
      expect(await p.trustAnchors.status(TD, DID)).toMatchObject({ status: 'ACTIVE' });
      const timeline = await p.audit.timeline(TD);
      expect(timeline.map((e) => e.type)).toEqual([
        'SUBJECT_CREATED',
        'POLICY_EVALUATED',
        'TRUST_ANCHOR_ADMITTED',
      ]);
      expect(verifyChain(TD, timeline)).toEqual({ valid: true });
    });
    expect(
      await client.decisionProjection.count({ where: { decisionRef: golden.decisionRef } }),
    ).toBe(1);
  });

  it('a second initial root for the same Trust Domain is refused', async () => {
    const outcome = await uow.run((p) =>
      p.trustAnchors.establishInitialTrustAnchor(TD, DID, new Date()),
    );
    expect(outcome).toBe('INITIAL_TRUST_ANCHOR_EXISTS');
  });

  it('a Trust Domain cannot be re-registered with another bootstrap configuration hash', async () => {
    await expect(uow.run((p) => p.trustAnchors.registerTrustDomain(TD, hash('9')))).rejects.toThrow(
      'different bootstrap configuration',
    );
  });
});

describe('critical invariants', () => {
  it('UnitOfWork is atomic: a failing step rolls every earlier write back', async () => {
    await expect(
      uow.run(async (p) => {
        await p.subjects.createSubject({
          id: 'subject:rollback',
          did: did('5'),
          type: 'ORGANIZATION',
          lifecycle: 'ACTIVE',
        });
        await p.audit.append(
          TD,
          event('SUBJECT_CREATED', '2026-09-11T00:00:00Z', { subject: did('5') }),
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await uow.run((p) => p.subjects.findSubjectByDid(did('5')))).toBeUndefined();
    expect((await uow.run((p) => p.audit.timeline(TD))).map((e) => e.type)).toHaveLength(3);
  });

  it('single initial root under concurrency: two racing admissions → exactly one ESTABLISHED (TV-S001-K01)', async () => {
    const td = 'trust-domain:race-root';
    await uow.run((p) => p.trustAnchors.registerTrustDomain(td, hash('b')));
    await uow.run((p) => seedAdmission(p, td, did('2'), '2'));
    await uow.run((p) => seedAdmission(p, td, did('3'), '3'));
    const outcomes = await Promise.all([
      uow.run((p) => p.trustAnchors.establishInitialTrustAnchor(td, did('2'), new Date())),
      uow.run((p) => p.trustAnchors.establishInitialTrustAnchor(td, did('3'), new Date())),
    ]);
    expect(outcomes.sort()).toEqual(['ESTABLISHED', 'INITIAL_TRUST_ANCHOR_EXISTS']);
  });

  it('single-use challenge under concurrency: exactly one consume wins (TV-S001-D04)', async () => {
    const consumeTwice = await Promise.all([
      uow.run((p) => p.admissions.consumeChallenge('challenge:session-2', new Date())),
      uow.run((p) => p.admissions.consumeChallenge('challenge:session-2', new Date())),
    ]);
    expect(consumeTwice.sort()).toEqual([false, true]);
  });

  it('concurrent audit appends stay one linear, verifiable chain per Trust Domain', async () => {
    const td = 'trust-domain:audit-race';
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        uow.run((p) =>
          p.audit.append(
            td,
            event('ADMISSION_REQUESTED', `2026-09-11T00:00:${String(i).padStart(2, '0')}Z`),
          ),
        ),
      ),
    );
    const timeline = await uow.run((p) => p.audit.timeline(td));
    expect(timeline).toHaveLength(12);
    expect(verifyChain(td, timeline)).toEqual({ valid: true });
  });

  it('a DENY Decision stays private: recorded with its trace, never published', async () => {
    await uow.run(async (p) => {
      await p.subjects.createSubject({
        id: 'subject:deny',
        did: did('6'),
        type: 'ORGANIZATION',
        lifecycle: 'ACTIVE',
      });
      await p.admissions.createSession(session('session:deny', 'subject:deny', TD));
      await p.admissions.recordDecision({
        sessionId: 'session:deny',
        decisionRef: 'decision:deny',
        decision: { ...golden.decision, subject: did('6'), decision: 'DENY' },
        decisionCommitment: hash('6'),
        policyHash: golden.admissionRecord.policyHash,
        trace: [
          {
            claim: 'ASSERTION_KEY_POSSESSION_VALID',
            status: 'FALSE',
            factValue: false,
            provenance: { source: 'KEY_POSSESSION_VERIFIER', ref: 'challenge:deny' },
            reasons: ['CHALLENGE_EXPIRED'],
          },
          {
            claim: 'ASSERTION_KEY_PURPOSE_VALID',
            status: 'MISSING',
            reasons: ['CHALLENGE_EXPIRED'],
          },
        ],
      });
    });
    expect(await client.decisionRecord.count({ where: { decisionRef: 'decision:deny' } })).toBe(1);
    expect(await client.decisionTrace.count({ where: { decisionRef: 'decision:deny' } })).toBe(2);
    expect(await client.decisionProjection.count({ where: { decisionRef: 'decision:deny' } })).toBe(
      0,
    );
  });
});

function session(id: string, subjectId: string, trustDomain: string) {
  return {
    id,
    sessionRef: `sref:${id}`,
    trustDomain,
    subjectId,
    operatorRef: 'operator-ref',
    state: 'STARTED' as const,
    providerRefsAttached: false,
    keyPossessionReasons: [],
  };
}

/**
 * Persistence-only fixture: a second admitted candidate cloned from the golden objects (not re-signed —
 * these tests exercise storage invariants, never signature verification).
 */
async function seedAdmission(p: PersistencePorts, td: string, candidate: string, n: string) {
  await p.subjects.createSubject({
    id: `subject:${n}`,
    did: candidate,
    type: 'ORGANIZATION',
    lifecycle: 'ACTIVE',
  });
  await p.admissions.createSession(session(`session-${n}`, `subject:${n}`, td));
  await p.admissions.issueChallenge(
    `session-${n}`,
    issueChallenge({
      challengeId: `challenge:session-${n}`,
      subject: candidate,
      verificationMethod: `${candidate}#assertion-key-1`,
      trustDomain: td,
      nonce: Buffer.alloc(32, Number(n)).toString('base64url'),
      issuedAt: new Date('2026-09-09T22:00:00Z'),
    }),
  );
  const decisionRef = `decision:${n}`;
  await p.admissions.recordDecision({
    sessionId: `session-${n}`,
    decisionRef,
    decision: { ...golden.decision, subject: candidate, resource: td },
    decisionCommitment: hash(n),
    policyHash: golden.admissionRecord.policyHash,
    trace: satisfiedTrace,
  });
  await p.admissions.saveEndorsement({
    ...golden.endorsement,
    id: `endorsement:${n}`,
    decisionRef,
  });
  await p.admissions.saveAdmissionRecord(`record:${n}`, {
    ...golden.admissionRecord,
    trustDomain: td,
    trustAnchor: candidate,
    verificationMethod: `${candidate}#assertion-key-1`,
    decisionRef,
    bootstrapEndorsementRef: `endorsement:${n}`,
  });
}
