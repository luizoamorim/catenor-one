// Prisma adapters for the S001 persistence ports (TASKS T3.3, minimum set). Infrastructure only: domain
// packages stay Prisma-free. Every adapter works on a transaction client supplied by the UnitOfWork.
import { randomUUID } from 'node:crypto';
import { GENESIS_PREV_HASH, chainEvent, type ChainedAuditEvent } from '@catenor-one/audit';
import type {
  BootstrapEndorsement,
  ChallengeRecord,
  TrustAnchorAdmissionRecord,
} from '@catenor-one/authority';
import type { DidDocument, KeyManagementReference } from '@catenor-one/identity';
import type { Decision, FactInput } from '@catenor-one/policy';
import { PrismaPg } from '@prisma/adapter-pg';
import type {
  AccountBinding,
  AccountBindingPurpose,
  AccountBindingRegistry,
  AdmissionRepository,
  AdmissionSession,
  AdmissionSessionUpdate,
  AuditLog,
  DecisionTraceEntry,
  DidStateRegistry,
  PersistencePorts,
  ProviderBinding,
  ProviderBindingRole,
  StoredDecision,
  StoredSubject,
  StoredVerificationRun,
  SubjectRegistry,
  TrustAnchorRegistry,
  UnitOfWork,
  VerificationRun,
  VerificationRunResult,
} from '../../../modules/trust-anchor-admission/application/persistence.ports.js';
import { Prisma, PrismaClient } from './generated/client.js';

type Db = Prisma.TransactionClient;

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const orNull = <T>(value: T | undefined): T | null => (value === undefined ? null : value);
const orUndefined = <T>(value: T | null): T | undefined => (value === null ? undefined : value);

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  run<T>(work: (ports: PersistencePorts) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(persistencePorts(tx)));
  }
}

export function persistencePorts(db: Db): PersistencePorts {
  return {
    subjects: new PrismaSubjectRegistry(db),
    accountBindings: new PrismaAccountBindingRegistry(db),
    didState: new PrismaDidStateRegistry(db),
    admissions: new PrismaAdmissionRepository(db),
    trustAnchors: new PrismaTrustAnchorRegistry(db),
    audit: new PrismaAuditLog(db),
  };
}

// ---- SubjectRegistry --------------------------------------------------------------------------------

class PrismaSubjectRegistry implements SubjectRegistry {
  constructor(private readonly db: Db) {}

  async createSubject(subject: StoredSubject): Promise<void> {
    await this.db.subject.create({ data: { ...subject } });
  }

  async findSubjectByDid(did: string): Promise<StoredSubject | undefined> {
    const row = await this.db.subject.findUnique({ where: { did } });
    return row ? { id: row.id, did: row.did, type: row.type, lifecycle: row.lifecycle } : undefined;
  }

  async findSubjectById(id: string): Promise<StoredSubject | undefined> {
    const row = await this.db.subject.findUnique({ where: { id } });
    return row ? { id: row.id, did: row.did, type: row.type, lifecycle: row.lifecycle } : undefined;
  }

  async createProviderBindings(
    bindings: readonly Omit<ProviderBinding, 'externalSubjectId' | 'status'>[],
  ): Promise<void> {
    await this.db.providerBinding.createMany({ data: bindings.map((b) => ({ ...b })) });
  }

  async listProviderBindings(subjectId: string): Promise<ProviderBinding[]> {
    const rows = await this.db.providerBinding.findMany({
      where: { subjectId },
      orderBy: { role: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      subjectId: r.subjectId,
      provider: r.provider,
      role: r.role,
      bindingRef: r.bindingRef,
      externalSubjectId: orUndefined(r.externalSubjectId),
      status: r.status,
    }));
  }

  async attachProviderReference(
    subjectId: string,
    role: ProviderBindingRole,
    externalSubjectId: string,
  ): Promise<void> {
    const { count } = await this.db.providerBinding.updateMany({
      where: { subjectId, role, status: { in: ['PENDING_ATTACHMENT', 'ATTACHED_UNVERIFIED'] } },
      data: { externalSubjectId, status: 'ATTACHED_UNVERIFIED' },
    });
    if (count !== 1) throw new Error(`${role} provider binding cannot be (re-)attached`);
  }

  async setProviderBindingStatus(
    subjectId: string,
    role: ProviderBindingRole,
    status: 'BINDING_VERIFIED' | 'BINDING_MISMATCH',
  ): Promise<void> {
    const { count } = await this.db.providerBinding.updateMany({
      where: { subjectId, role, externalSubjectId: { not: null } },
      data: { status },
    });
    if (count !== 1) throw new Error(`${role} provider binding is not attached`);
  }
}

// ---- DidStateRegistry -------------------------------------------------------------------------------

class PrismaAccountBindingRegistry implements AccountBindingRegistry {
  constructor(private readonly db: Db) {}

  async createAccountBinding(binding: AccountBinding): Promise<void> {
    await this.db.accountBinding.create({
      data: {
        id: binding.id,
        subjectId: binding.subjectId,
        purpose: binding.purpose,
        account: binding.account,
        walletProvider: binding.walletProvider,
        walletRef: binding.walletRef ?? null,
      },
    });
  }

  async findAccountBinding(
    subjectId: string,
    purpose: AccountBindingPurpose,
  ): Promise<AccountBinding | undefined> {
    const row = await this.db.accountBinding.findUnique({
      where: { subjectId_purpose: { subjectId, purpose } },
    });
    return row
      ? {
          id: row.id,
          subjectId: row.subjectId,
          purpose: row.purpose,
          account: row.account,
          walletProvider: row.walletProvider,
          ...(row.walletRef ? { walletRef: row.walletRef } : {}),
        }
      : undefined;
  }
}

class PrismaDidStateRegistry implements DidStateRegistry {
  constructor(private readonly db: Db) {}

  async publishAssertionKey(input: Parameters<DidStateRegistry['publishAssertionKey']>[0]) {
    const { document, lifecycle, verificationMethod: vm, subjectId, keyReference, adapter } = input;
    if (vm.controller !== document.id || keyReference.verificationMethod !== vm.id) {
      throw new TypeError('verification method, DID Document and key reference must match');
    }
    await this.db.didDocumentProjection.upsert({
      where: { did: document.id },
      create: { did: document.id, document: json(document), lifecycle },
      update: { document: json(document), lifecycle },
    });
    await this.db.verificationMethodProjection.create({
      data: {
        id: vm.id,
        did: vm.controller,
        type: vm.type,
        publicKeyMultibase: vm.publicKeyMultibase,
        relationships: (document.assertionMethod as readonly string[]).includes(vm.id)
          ? ['assertionMethod']
          : [],
        status: keyReference.status,
      },
    });
    await this.db.keyManagementReference.create({
      data: {
        verificationMethodId: vm.id,
        subjectId,
        signerRef: keyReference.signerRef,
        adapter,
        purpose: keyReference.purpose,
        status: keyReference.status,
      },
    });
  }

  async resolve(did: string) {
    const row = await this.db.didDocumentProjection.findUnique({ where: { did } });
    return row
      ? { document: row.document as unknown as DidDocument, lifecycle: row.lifecycle }
      : undefined;
  }

  async findKeyReference(
    verificationMethodId: string,
  ): Promise<KeyManagementReference | undefined> {
    const row = await this.db.keyManagementReference.findUnique({
      where: { verificationMethodId },
      include: { subject: { select: { did: true } } },
    });
    return row
      ? ({
          subject: row.subject.did,
          verificationMethod: row.verificationMethodId,
          signerRef: row.signerRef,
          purpose: row.purpose,
          status: row.status,
        } as KeyManagementReference)
      : undefined;
  }

  async verificationMethodStatus(verificationMethodId: string) {
    const row = await this.db.verificationMethodProjection.findUnique({
      where: { id: verificationMethodId },
      select: { status: true },
    });
    return row?.status;
  }
}

// ---- AdmissionRepository ----------------------------------------------------------------------------

class PrismaAdmissionRepository implements AdmissionRepository {
  constructor(private readonly db: Db) {}

  async createSession(session: AdmissionSession): Promise<void> {
    await this.db.admissionSession.create({
      data: {
        ...session,
        assertionVerificationMethod: orNull(session.assertionVerificationMethod),
        keyPossessionValid: orNull(session.keyPossessionValid),
        keyPurposeValid: orNull(session.keyPurposeValid),
        keyPossessionReasons: [...session.keyPossessionReasons],
      },
    });
  }

  async loadSession(sessionRef: string): Promise<AdmissionSession | undefined> {
    const r = await this.db.admissionSession.findUnique({ where: { sessionRef } });
    return r
      ? {
          id: r.id,
          sessionRef: r.sessionRef,
          trustDomain: r.trustDomain,
          subjectId: r.subjectId,
          operatorRef: r.operatorRef,
          state: r.state,
          providerRefsAttached: r.providerRefsAttached,
          assertionVerificationMethod: orUndefined(r.assertionVerificationMethod),
          keyPossessionValid: orUndefined(r.keyPossessionValid),
          keyPurposeValid: orUndefined(r.keyPurposeValid),
          keyPossessionReasons: r.keyPossessionReasons,
        }
      : undefined;
  }

  async updateSession(id: string, update: AdmissionSessionUpdate): Promise<void> {
    await this.db.admissionSession.update({
      where: { id },
      data: {
        ...update,
        keyPossessionReasons: update.keyPossessionReasons && [...update.keyPossessionReasons],
      },
    });
  }

  async issueChallenge(sessionId: string, record: ChallengeRecord): Promise<void> {
    const c = record.challenge;
    await this.db.keyPossessionChallenge.create({
      data: {
        challengeId: c.challengeId,
        sessionId,
        subject: c.subject,
        verificationMethod: c.verificationMethod,
        operation: c.operation,
        trustDomain: c.trustDomain,
        nonce: c.nonce,
        issuedAt: c.issuedAt,
        expiresAt: c.expiresAt,
        status: record.status,
      },
    });
  }

  async loadChallenge(challengeId: string): Promise<ChallengeRecord | undefined> {
    const r = await this.db.keyPossessionChallenge.findUnique({ where: { challengeId } });
    return r
      ? {
          status: r.status,
          challenge: {
            type: 'CatenorOneKeyPossessionChallenge',
            challengeId: r.challengeId,
            subject: r.subject,
            verificationMethod: r.verificationMethod,
            operation: r.operation as 'ADMIT_TRUST_ANCHOR',
            trustDomain: r.trustDomain,
            nonce: r.nonce,
            issuedAt: r.issuedAt,
            expiresAt: r.expiresAt,
          },
        }
      : undefined;
  }

  async consumeChallenge(challengeId: string, consumedAt: Date): Promise<boolean> {
    const { count } = await this.db.keyPossessionChallenge.updateMany({
      where: { challengeId, status: 'ISSUED' },
      data: { status: 'CONSUMED', consumedAt },
    });
    return count === 1;
  }

  async createVerificationRun(run: VerificationRun): Promise<void> {
    await this.db.confidentialVerificationRun.create({
      data: { ...run, evidenceSources: json(run.evidenceSources) },
    });
  }

  async loadVerificationRun(runId: string): Promise<StoredVerificationRun | undefined> {
    const row = await this.db.confidentialVerificationRun.findUnique({ where: { runId } });
    return row ? toStoredRun(row) : undefined;
  }

  async listVerificationRuns(sessionId: string): Promise<StoredVerificationRun[]> {
    const rows = await this.db.confidentialVerificationRun.findMany({
      where: { sessionId },
      orderBy: { attempt: 'asc' },
    });
    return rows.map(toStoredRun);
  }

  async recordVerificationResult(runId: string, result: VerificationRunResult): Promise<boolean> {
    const { count } = await this.db.confidentialVerificationRun.updateMany({
      where: { runId, status: 'PENDING' },
      data: {
        status: result.status,
        code: orNull(result.code),
        facts: result.facts ? json(result.facts) : Prisma.DbNull,
        evidenceCommitment: orNull(result.evidenceCommitment),
        commitmentInputs:
          result.commitmentInputs === undefined ? Prisma.DbNull : json(result.commitmentInputs),
        bootstrapConfigurationHashEcho: orNull(result.bootstrapConfigurationHashEcho),
        resultAuth: result.resultAuth === undefined ? Prisma.DbNull : json(result.resultAuth),
      },
    });
    return count === 1;
  }

  async recordDecision(input: Parameters<AdmissionRepository['recordDecision']>[0]): Promise<void> {
    const { decision } = input;
    await this.db.decisionRecord.create({
      data: {
        decisionRef: input.decisionRef,
        sessionId: input.sessionId,
        ...decision,
        decisionCommitment: input.decisionCommitment,
        policyHash: input.policyHash,
        errorReason: orNull(input.errorReason),
        trace: { createMany: { data: input.trace.map(traceRow) } },
      },
    });
    if (decision.decision === 'ALLOW') {
      await this.db.decisionProjection.create({
        data: {
          decisionRef: input.decisionRef,
          ...decision,
          decision: 'ALLOW',
          decisionCommitment: input.decisionCommitment,
        },
      });
    }
  }

  async loadDecision(sessionId: string): Promise<StoredDecision | undefined> {
    const r = await this.db.decisionRecord.findUnique({
      where: { sessionId },
      include: { trace: true },
    });
    if (r === null) return undefined;
    return {
      decisionRef: r.decisionRef,
      decision: {
        policy: r.policy,
        subject: r.subject,
        action: r.action,
        resource: r.resource,
        decision: r.decision,
        evaluatedAt: r.evaluatedAt,
        evidenceCommitment: r.evidenceCommitment as Decision['evidenceCommitment'],
      },
      decisionCommitment: r.decisionCommitment,
      policyHash: r.policyHash,
      errorReason: orUndefined(r.errorReason),
      trace: r.trace.map((t) => ({
        claim: t.claim,
        status: t.status,
        factValue: orUndefined(t.factValue),
        provenance:
          t.provenanceSource === null || t.provenanceRef === null
            ? undefined
            : { source: t.provenanceSource, ref: t.provenanceRef },
        reasons: t.reasons,
      })),
    };
  }

  async loadPublishedDecision(decisionRef: string): Promise<Decision | undefined> {
    const r = await this.db.decisionProjection.findUnique({ where: { decisionRef } });
    return r
      ? {
          policy: r.policy,
          subject: r.subject,
          action: r.action,
          resource: r.resource,
          decision: r.decision,
          evaluatedAt: r.evaluatedAt,
          evidenceCommitment: r.evidenceCommitment as Decision['evidenceCommitment'],
        }
      : undefined;
  }

  async loadEndorsement(id: string): Promise<BootstrapEndorsement | undefined> {
    const r = await this.db.bootstrapEndorsementProjection.findUnique({ where: { id } });
    return r ? (r.payload as unknown as BootstrapEndorsement) : undefined;
  }

  async loadAdmissionRecord(
    trustDomain: string,
    trustAnchor: string,
  ): Promise<TrustAnchorAdmissionRecord | undefined> {
    const r = await this.db.trustAnchorAdmissionRecord.findUnique({
      where: { trustDomain_trustAnchor: { trustDomain, trustAnchor } },
    });
    return r
      ? ({
          type: 'CatenorTrustAnchorAdmissionRecord',
          trustDomain: r.trustDomain,
          trustAnchor: r.trustAnchor,
          admissionPolicy: r.admissionPolicy,
          policyHash: r.policyHash,
          decision: 'ADMIT_TRUST_ANCHOR',
          verificationMethod: r.verificationMethod,
          evidenceCommitment: r.evidenceCommitment,
          createdAt: r.createdAt,
          decisionRef: r.decisionRef,
          bootstrapEndorsementRef: r.bootstrapEndorsementRef,
        } as TrustAnchorAdmissionRecord)
      : undefined;
  }

  async saveEndorsement(endorsement: BootstrapEndorsement): Promise<void> {
    await this.db.bootstrapEndorsementProjection.create({
      data: {
        id: endorsement.id,
        decisionRef: endorsement.decisionRef,
        payload: json(endorsement),
      },
    });
  }

  async saveAdmissionRecord(id: string, record: TrustAnchorAdmissionRecord): Promise<void> {
    await this.db.trustAnchorAdmissionRecord.create({
      data: {
        id,
        trustDomain: record.trustDomain,
        trustAnchor: record.trustAnchor,
        admissionPolicy: record.admissionPolicy,
        policyHash: record.policyHash,
        decision: record.decision,
        verificationMethod: record.verificationMethod,
        evidenceCommitment: record.evidenceCommitment,
        createdAt: record.createdAt,
        decisionRef: record.decisionRef,
        bootstrapEndorsementRef: record.bootstrapEndorsementRef,
      },
    });
  }
}

type RunRow = Awaited<ReturnType<Db['confidentialVerificationRun']['findUniqueOrThrow']>>;

function toStoredRun(r: RunRow): StoredVerificationRun {
  return {
    runId: r.runId,
    sessionId: r.sessionId,
    attempt: r.attempt,
    operation: r.operation,
    creWorkflowId: r.creWorkflowId,
    deadlineAt: r.deadlineAt,
    evidenceSources: r.evidenceSources as unknown as VerificationRun['evidenceSources'],
    status: r.status,
    code: orUndefined(r.code),
    facts: orUndefined(r.facts) as readonly FactInput[] | undefined,
    evidenceCommitment: orUndefined(r.evidenceCommitment),
    commitmentInputs: orUndefined(r.commitmentInputs),
  };
}

function traceRow(entry: DecisionTraceEntry) {
  return {
    claim: entry.claim,
    status: entry.status,
    factValue: orNull(entry.factValue),
    provenanceSource: orNull(entry.provenance?.source),
    provenanceRef: orNull(entry.provenance?.ref),
    reasons: [...entry.reasons],
  };
}

// ---- TrustAnchorRegistry ----------------------------------------------------------------------------

class PrismaTrustAnchorRegistry implements TrustAnchorRegistry {
  constructor(private readonly db: Db) {}

  async registerTrustDomain(id: string, bootstrapConfigurationHash: string): Promise<void> {
    const existing = await this.db.trustDomainProjection.findUnique({ where: { id } });
    if (existing === null) {
      await this.db.trustDomainProjection.create({ data: { id, bootstrapConfigurationHash } });
    } else if (existing.bootstrapConfigurationHash !== bootstrapConfigurationHash) {
      throw new Error(`trust domain ${id} is pinned to a different bootstrap configuration`);
    }
  }

  async establishInitialTrustAnchor(trustDomain: string, did: string, at: Date) {
    const { count } = await this.db.trustDomainProjection.updateMany({
      where: { id: trustDomain, initialTrustAnchorDid: null },
      data: { initialTrustAnchorDid: did },
    });
    if (count === 0) return 'INITIAL_TRUST_ANCHOR_EXISTS' as const;
    await this.db.trustAnchorStatusProjection.create({
      data: { trustDomain, did, status: 'ACTIVE', changedAt: at },
    });
    return 'ESTABLISHED' as const;
  }

  async initialTrustAnchor(trustDomain: string): Promise<string | undefined> {
    const row = await this.db.trustDomainProjection.findUnique({ where: { id: trustDomain } });
    return orUndefined(row?.initialTrustAnchorDid ?? null);
  }

  async status(trustDomain: string, did: string) {
    const row = await this.db.trustAnchorStatusProjection.findUnique({
      where: { trustDomain_did: { trustDomain, did } },
    });
    return row ? { status: row.status, changedAt: row.changedAt } : undefined;
  }
}

// ---- AuditLog ---------------------------------------------------------------------------------------

class PrismaAuditLog implements AuditLog {
  constructor(private readonly db: Db) {}

  async append(
    trustDomain: string,
    event: Parameters<AuditLog['append']>[1],
  ): Promise<ChainedAuditEvent> {
    // Serialize appends per Trust Domain for the rest of the transaction, so the head read below is
    // always the committed head and concurrent writers never race for the same prevHash.
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${trustDomain}))`;
    const head = await this.db.auditEvent.findFirst({
      where: { trustDomain },
      orderBy: { seq: 'desc' },
      select: { eventHash: true },
    });
    const chained = chainEvent(
      trustDomain,
      (head?.eventHash ?? GENESIS_PREV_HASH) as ChainedAuditEvent['prevHash'],
      event,
    );
    await this.db.auditEvent.create({
      data: {
        id: randomUUID(),
        trustDomain,
        type: chained.type,
        subject: orNull(chained.subject),
        issuer: orNull(chained.issuer),
        requestId: orNull(chained.requestId),
        timestamp: chained.timestamp,
        details: chained.details === undefined ? Prisma.DbNull : json(chained.details),
        prevHash: chained.prevHash,
        eventHash: chained.eventHash,
      },
    });
    return chained;
  }

  async timeline(trustDomain: string): Promise<ChainedAuditEvent[]> {
    const rows = await this.db.auditEvent.findMany({
      where: { trustDomain },
      orderBy: { seq: 'asc' },
    });
    // Rebuild the exact hashed shape: absent optional fields stay absent (never null).
    return rows.map((r) => ({
      type: r.type,
      ...(r.subject === null ? {} : { subject: r.subject }),
      ...(r.issuer === null ? {} : { issuer: r.issuer }),
      ...(r.requestId === null ? {} : { requestId: r.requestId }),
      timestamp: r.timestamp,
      ...(r.details === null ? {} : { details: r.details as ChainedAuditEvent['details'] }),
      trustDomain: r.trustDomain,
      prevHash: r.prevHash as ChainedAuditEvent['prevHash'],
      eventHash: r.eventHash as ChainedAuditEvent['eventHash'],
    }));
  }
}
