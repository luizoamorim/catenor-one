// S001 application service — the Trust Anchor Admission process manager (PLAN §4.1, U2–U10, U13), split at
// the asynchronous boundaries (signature, confidential run, endorsement). Domain rules come from
// @catenor-one/* (the TrustAnchorAdmission aggregate is rebuilt from persisted state for every command);
// this layer only orchestrates ports inside UnitOfWork transactions. No framework, no Prisma, no SDK.
import { commit, type AuditEvent } from '@catenor-one/audit';
import {
  ADMIT_TRUST_ANCHOR,
  TrustAnchorAdmission,
  buildEndorsementPayload,
  createAdmissionRecord,
  issueChallenge,
  verifyEndorsement,
  verifyKeyPossession,
  verifyTrustAnchor,
  type KeyPossessionChallenge,
  type TrustAnchorVerificationResult,
} from '@catenor-one/authority';
import type { DataIntegrityProof } from '@catenor-one/credentials';
import {
  assertionKeyId,
  createDidDocument,
  createVerificationMethod,
  findVerificationMethod,
  generateCatenorDid,
  type CatenorDid,
} from '@catenor-one/identity';
import {
  FactSet,
  createDecision,
  evaluatePolicy,
  type FactInput,
  type FactName,
  type PolicyOutcome,
} from '@catenor-one/policy';
import type {
  AdmissionPolicySource,
  AssertionSigner,
  BootstrapConfigurationSource,
  BootstrapEndorsementSigner,
  Clock,
  ConfidentialEvidenceVerifier,
  ConfidentialVerificationResult,
  EvidenceFactName,
  IdGenerator,
} from './admission.ports.js';
import type {
  AdmissionSession,
  DecisionTraceEntry,
  PersistencePorts,
  StoredDecision,
  StoredVerificationRun,
  UnitOfWork,
} from './persistence.ports.js';

export const TRUST_ANCHOR_ADMISSION_OPERATION = 'TRUST_ANCHOR_ADMISSION';
const EVIDENCE_FACTS: readonly EvidenceFactName[] = [
  'ORGANIZATION_KYB_VERIFIED',
  'ORGANIZATION_STATUS_VALID',
  'ORGANIZATION_AML_CLEAR',
  'AUTHORIZED_REPRESENTATIVE_VERIFIED',
  'REPRESENTATIVE_AUTHORITY_CONFIRMED',
  'EVIDENCE_FRESH',
];
const MOCK_COMPANY_REFERENCE = /^mock:company-fixture:[A-Za-z0-9_-]+$/;
const RUN_DEADLINE_MS = 10 * 60 * 1000;

export class AdmissionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AdmissionError';
  }
}

export interface TrustAnchorAdmissionDeps {
  readonly uow: UnitOfWork;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly configuration: BootstrapConfigurationSource;
  readonly policy: AdmissionPolicySource;
  readonly assertionSigner: AssertionSigner;
  readonly bootstrapSigner: BootstrapEndorsementSigner;
  readonly verifier: ConfidentialEvidenceVerifier;
}

export interface KeyProofOutcome {
  readonly possessionValid: boolean;
  readonly purposeValid: boolean | undefined;
  readonly reasons: readonly string[];
  /** Present when the failed proof was evaluated immediately (D23). */
  readonly decision?: { readonly decisionRef: string; readonly outcome: PolicyOutcome };
}

interface Loaded {
  readonly session: AdmissionSession;
  readonly did: CatenorDid;
  readonly runs: readonly StoredVerificationRun[];
  readonly decision: StoredDecision | undefined;
  readonly aggregate: TrustAnchorAdmission;
}

export class TrustAnchorAdmissionService {
  constructor(private readonly deps: TrustAnchorAdmissionDeps) {}

  /** U2 — creates the ORGANIZATION Subject, its random DID, private bindingRefs and the session. */
  async startInitialAdmission(input: { readonly operatorRef: string }) {
    const { config, hash } = this.deps.configuration.load();
    const did = generateCatenorDid(this.deps.ids.randomBytes(16));
    const subjectId = this.deps.ids.id('subject');
    const sessionId = this.deps.ids.id('session');
    const sessionRef = this.deps.ids.id('sref');
    const bindingRef = () => `cbr-${Buffer.from(this.deps.ids.randomBytes(16)).toString('hex')}`;
    const providerSetup = {
      companyBindingRef: bindingRef(),
      representativeBindingRef: bindingRef(),
    };
    const now = this.timestamp();
    await this.deps.uow.run(async (p) => {
      await p.trustAnchors.registerTrustDomain(config.trustDomain, hash);
      if ((await p.trustAnchors.initialTrustAnchor(config.trustDomain)) !== undefined) {
        throw new AdmissionError('INITIAL_TRUST_ANCHOR_EXISTS', 'the initial Trust Anchor exists');
      }
      await p.subjects.createSubject({
        id: subjectId,
        did,
        type: 'ORGANIZATION',
        lifecycle: 'ACTIVE',
      });
      await p.subjects.createProviderBindings([
        {
          id: this.deps.ids.id('binding'),
          subjectId,
          provider: config.acceptedEvidence.provider,
          role: 'COMPANY',
          bindingRef: providerSetup.companyBindingRef,
        },
        {
          id: this.deps.ids.id('binding'),
          subjectId,
          provider: config.acceptedEvidence.provider,
          role: 'REPRESENTATIVE',
          bindingRef: providerSetup.representativeBindingRef,
        },
      ]);
      await p.admissions.createSession({
        id: sessionId,
        sessionRef,
        trustDomain: config.trustDomain,
        subjectId,
        operatorRef: input.operatorRef,
        state: 'STARTED',
        providerRefsAttached: false,
        keyPossessionReasons: [],
      });
      await this.audit(p, config.trustDomain, sessionRef, did, 'SUBJECT_CREATED', now);
      await this.audit(p, config.trustDomain, sessionRef, did, 'ADMISSION_REQUESTED', now);
    });
    return { sessionRef, did, providerSetup };
  }

  /** U3 — attaches the provider references (representative REAL; company per the evidence profile). */
  async attachProviderReferences(
    sessionRef: string,
    refs: { readonly companyApplicantId: string; readonly representativeApplicantId: string },
  ): Promise<void> {
    const { config } = this.deps.configuration.load();
    const companyIsMock = config.acceptedEvidence.evidenceSources.company === 'SYNTHETIC_MOCK';
    if (companyIsMock !== MOCK_COMPANY_REFERENCE.test(refs.companyApplicantId)) {
      throw new AdmissionError(
        'PROVIDER_REFERENCE_INVALID',
        companyIsMock
          ? 'the company source is SYNTHETIC_MOCK: only a mock:company-fixture:<scenario> reference is accepted'
          : 'the company source is REAL_SUMSUB_SANDBOX: a MOCK company reference is not accepted',
      );
    }
    if (refs.representativeApplicantId.startsWith('mock:')) {
      throw new AdmissionError(
        'PROVIDER_REFERENCE_INVALID',
        'the representative must be a real sandbox applicant',
      );
    }
    await this.deps.uow.run(async (p) => {
      const s = await this.load(p, sessionRef);
      s.aggregate.attachProviderReferences();
      await p.subjects.attachProviderReference(
        s.session.subjectId,
        'COMPANY',
        refs.companyApplicantId,
      );
      await p.subjects.attachProviderReference(
        s.session.subjectId,
        'REPRESENTATIVE',
        refs.representativeApplicantId,
      );
      await p.admissions.updateSession(s.session.id, { providerRefsAttached: true });
      await this.audit(
        p,
        s.session.trustDomain,
        sessionRef,
        s.did,
        'PROVIDER_REFERENCES_ATTACHED',
        this.timestamp(),
      );
    });
  }

  /** U4 — provisions the Credential Assertion Key and publishes the minimized DID Document. */
  async provisionAssertionKey(sessionRef: string) {
    const pre = await this.deps.uow.run((p) => this.load(p, sessionRef));
    if (pre.aggregate.currentPhase !== 'STARTED') {
      throw new AdmissionError(
        'ILLEGAL_STATE',
        `cannot provision a key in ${pre.aggregate.currentPhase}`,
      );
    }
    // Reuse an existing ACTIVE assertion key of this Subject; only create a wallet when none exists.
    const existing = await this.deps.uow.run((p) => existingAssertionKey(p, pre.did));
    if (existing !== undefined) {
      await this.deps.uow.run(async (p) => {
        const s = await this.load(p, sessionRef);
        s.aggregate.provisionKey(existing.verificationMethod.id);
        await p.admissions.updateSession(s.session.id, {
          state: s.aggregate.currentPhase,
          assertionVerificationMethod: existing.verificationMethod.id,
        });
        await this.audit(
          p,
          s.session.trustDomain,
          sessionRef,
          s.did,
          'KEY_ADDED',
          this.timestamp(),
          {
            reused: true,
          },
        );
      });
      return existing;
    }
    // Residual risk (accepted for the hackathon, no compensation subsystem): if the external wallet is
    // created but the transaction below fails, an orphan signer wallet remains with no Catenor reference.
    const key = await this.deps.assertionSigner.createKey({
      subject: pre.did,
      purpose: 'CREDENTIAL_ASSERTION',
    });
    const vm = createVerificationMethod(
      assertionKeyId(pre.did, 1),
      pre.did,
      key.publicKeyMultibase,
    );
    const document = createDidDocument(pre.did, [vm], [vm.id]);
    await this.deps.uow.run(async (p) => {
      const s = await this.load(p, sessionRef);
      s.aggregate.provisionKey(vm.id);
      await p.didState.publishAssertionKey({
        document,
        lifecycle: 'ACTIVE',
        verificationMethod: vm,
        subjectId: s.session.subjectId,
        keyReference: {
          subject: s.did,
          verificationMethod: vm.id,
          signerRef: key.signerRef,
          purpose: 'CREDENTIAL_ASSERTION',
          status: 'ACTIVE',
        },
        adapter: this.deps.assertionSigner.adapter,
      });
      await p.admissions.updateSession(s.session.id, {
        state: s.aggregate.currentPhase,
        assertionVerificationMethod: vm.id,
      });
      const at = this.timestamp();
      await this.audit(p, s.session.trustDomain, sessionRef, s.did, 'KEY_ADDED', at);
      await this.audit(p, s.session.trustDomain, sessionRef, s.did, 'DID_DOCUMENT_CREATED', at);
    });
    return { verificationMethod: vm, document };
  }

  /** U5 — one key-possession challenge per session (5-minute TTL). */
  async issueKeyPossessionChallenge(sessionRef: string): Promise<KeyPossessionChallenge> {
    return this.deps.uow.run(async (p) => {
      const s = await this.load(p, sessionRef);
      if (
        s.aggregate.currentPhase !== 'KEY_PROVISIONED' ||
        s.session.assertionVerificationMethod === undefined
      ) {
        throw new AdmissionError(
          'ILLEGAL_STATE',
          `cannot issue a challenge in ${s.aggregate.currentPhase}`,
        );
      }
      const record = issueChallenge({
        challengeId: challengeIdOf(s.session),
        subject: s.did,
        verificationMethod: s.session.assertionVerificationMethod,
        trustDomain: s.session.trustDomain,
        nonce: Buffer.from(this.deps.ids.randomBytes(32)).toString('base64url'),
        issuedAt: this.deps.clock.now(),
      });
      await p.admissions.issueChallenge(s.session.id, record);
      return record.challenge;
    });
  }

  /** U6a — the secure signer answers the challenge (normal path), then U6 verifies. */
  async proveKeyPossessionWithSecureSigner(sessionRef: string): Promise<KeyProofOutcome> {
    const { challenge, signerRef } = await this.deps.uow.run(async (p) => {
      const s = await this.load(p, sessionRef);
      const record = await p.admissions.loadChallenge(challengeIdOf(s.session));
      const keyRef = s.session.assertionVerificationMethod
        ? await p.didState.findKeyReference(s.session.assertionVerificationMethod)
        : undefined;
      if (record === undefined || keyRef === undefined) {
        throw new AdmissionError('ILLEGAL_STATE', 'no challenge or assertion key for this session');
      }
      return { challenge: record.challenge, signerRef: keyRef.signerRef };
    });
    const proof = await this.deps.assertionSigner.signKeyPossessionProof(signerRef, {
      challenge,
      proofOptions: {
        verificationMethod: challenge.verificationMethod,
        proofPurpose: 'assertionMethod',
        created: this.timestamp(),
        challenge: challenge.nonce,
        domain: challenge.trustDomain,
      },
    });
    return this.submitKeyPossessionProof(sessionRef, proof);
  }

  /** U6 — verifies from public DID state only, consumes the challenge atomically; failure → DENY (D23). */
  async submitKeyPossessionProof(
    sessionRef: string,
    proof: DataIntegrityProof,
  ): Promise<KeyProofOutcome> {
    const outcome = await this.deps.uow.run(async (p) => {
      const s = await this.load(p, sessionRef);
      if (s.aggregate.currentPhase !== 'KEY_PROVISIONED') {
        throw new AdmissionError(
          'ILLEGAL_STATE',
          `cannot submit a proof in ${s.aggregate.currentPhase}`,
        );
      }
      const now = this.deps.clock.now();
      const record = await p.admissions.loadChallenge(challengeIdOf(s.session));
      const resolved = await p.didState.resolve(s.did);
      if (resolved === undefined) {
        throw new AdmissionError('DID_NOT_RESOLVED', 'DID state unavailable');
      }
      const result = verifyKeyPossession({
        record,
        requestedSubject: s.did,
        trustDomain: s.session.trustDomain,
        didDocument: resolved.document,
        keyReference: await p.didState.findKeyReference(proof.verificationMethod),
        proof,
        now,
      });
      let { possessionValid } = result;
      const reasons: string[] = [...result.reasons];
      if (
        record?.status === 'ISSUED' &&
        !(await p.admissions.consumeChallenge(record.challenge.challengeId, now))
      ) {
        possessionValid = false; // lost the single-use race (TV-S001-D04)
        reasons.push('CHALLENGE_CONSUMED');
      }
      const valid = possessionValid && result.purposeValid === true;
      s.aggregate.recordKeyProof(valid);
      await p.admissions.updateSession(s.session.id, {
        state: s.aggregate.currentPhase,
        keyPossessionValid: possessionValid,
        keyPurposeValid: result.purposeValid,
        keyPossessionReasons: reasons,
      });
      await this.audit(
        p,
        s.session.trustDomain,
        sessionRef,
        s.did,
        valid ? 'KEY_POSSESSION_VERIFIED' : 'KEY_POSSESSION_FAILED',
        this.timestamp(),
        valid ? undefined : { reasons },
      );
      return { possessionValid, purposeValid: result.purposeValid, reasons, valid };
    });
    if (outcome.valid) return outcome;
    // D23: a failed key proof is evaluated straight away — DENY, no confidential call.
    return { ...outcome, decision: await this.evaluateAdmission(sessionRef) };
  }

  /** U7 — preconditions: key facts true and provider references attached; records the run, then triggers. */
  async requestConfidentialVerification(sessionRef: string) {
    const { config } = this.deps.configuration.load();
    const runId = this.deps.ids.id('run');
    const context = await this.deps.uow.run(async (p) => {
      const s = await this.load(p, sessionRef);
      s.aggregate.requestVerification(runId);
      const bindings = await p.subjects.listProviderBindings(s.session.subjectId);
      const company = bindings.find((b) => b.role === 'COMPANY');
      const representative = bindings.find((b) => b.role === 'REPRESENTATIVE');
      if (!company?.externalSubjectId || !representative?.externalSubjectId) {
        throw new AdmissionError(
          'PROVIDER_REFERENCES_MISSING',
          'provider references are not attached',
        );
      }
      const now = this.deps.clock.now();
      await p.admissions.createVerificationRun({
        runId,
        sessionId: s.session.id,
        attempt: s.runs.length + 1,
        operation: TRUST_ANCHOR_ADMISSION_OPERATION,
        creWorkflowId: this.deps.verifier.workflowId,
        deadlineAt: new Date(now.getTime() + RUN_DEADLINE_MS),
        evidenceSources: config.acceptedEvidence.evidenceSources,
      });
      await p.admissions.updateSession(s.session.id, { state: s.aggregate.currentPhase });
      await this.audit(
        p,
        s.session.trustDomain,
        sessionRef,
        s.did,
        'CONFIDENTIAL_VERIFICATION_REQUESTED',
        this.timestamp(),
        { mode: this.deps.verifier.mode },
      );
      return {
        sessionRef,
        runId,
        trustDomain: s.session.trustDomain,
        subjectDid: s.did,
        companyApplicantId: company.externalSubjectId,
        representativeApplicantId: representative.externalSubjectId,
        companyBindingRef: company.bindingRef,
        representativeBindingRef: representative.bindingRef,
        notAfter: rfc3339(new Date(now.getTime() + RUN_DEADLINE_MS)),
      };
    });
    const { executionId } = await this.deps.verifier.request({
      operation: TRUST_ANCHOR_ADMISSION_OPERATION,
      runId,
      context,
    });
    return { runId, executionId, mode: this.deps.verifier.mode };
  }

  /**
   * U8 — records an (already authenticated) confidential result: one result per run; echoes must match the
   * pinned configuration (TV-S001-B04); ERROR / mismatch → no facts. Returns why a result was not accepted.
   */
  async recordConfidentialVerificationResult(
    result: ConfidentialVerificationResult,
  ): Promise<{ readonly accepted: boolean; readonly reason?: string }> {
    const { config, hash } = this.deps.configuration.load();
    return this.deps.uow.run(async (p) => {
      const run = await p.admissions.loadVerificationRun(result.runId);
      const s = await this.load(p, result.sessionRef);
      if (run === undefined || run.sessionId !== s.session.id) {
        return { accepted: false, reason: 'UNKNOWN_RUN' };
      }
      // The integration label must be what this API actually invoked: a SIMULATION or FAKE result can never be
      // recorded as DEPLOYED (and vice versa).
      const rejection =
        result.mode !== this.deps.verifier.mode
          ? 'EXECUTION_MODE_MISMATCH'
          : rejectionOf(result, config, hash);
      const failed = rejection !== undefined || result.status !== 'OK';
      const status = rejection
        ? 'ERROR'
        : result.status === 'OK'
          ? 'EVIDENCE_RECEIVED'
          : result.code === 'PROVIDER_BINDING_MISMATCH'
            ? 'BINDING_MISMATCH'
            : 'ERROR';
      const facts = failed ? undefined : evidenceFactInputs(result);
      const recorded = await p.admissions.recordVerificationResult(result.runId, {
        status,
        code: rejection ?? result.code,
        facts,
        evidenceCommitment: failed ? undefined : result.evidenceCommitment,
        commitmentInputs: failed
          ? undefined
          : {
              mode: result.mode,
              reconciliation: result.reconciliation,
              factReasons: result.factReasons,
              commitmentInput: result.commitmentInput,
            },
        bootstrapConfigurationHashEcho: result.bootstrapConfigurationHash,
      });
      if (!recorded) return { accepted: false, reason: 'LATE_OR_DUPLICATE_RESULT' };
      if (status === 'EVIDENCE_RECEIVED') {
        s.aggregate.recordEvidence(result.runId);
        await p.subjects.setProviderBindingStatus(
          s.session.subjectId,
          'REPRESENTATIVE',
          'BINDING_VERIFIED',
        );
        // A MOCK company binding is never recorded as a verified provider binding (PLAN §4.2).
        if (config.acceptedEvidence.evidenceSources.company === 'REAL_SUMSUB_SANDBOX') {
          await p.subjects.setProviderBindingStatus(
            s.session.subjectId,
            'COMPANY',
            'BINDING_VERIFIED',
          );
        }
      } else {
        s.aggregate.recordVerificationFailure(
          result.runId,
          status === 'BINDING_MISMATCH' ? 'BINDING_MISMATCH' : 'ERROR',
        );
        if (status === 'BINDING_MISMATCH') {
          await p.subjects.setProviderBindingStatus(
            s.session.subjectId,
            'REPRESENTATIVE',
            'BINDING_MISMATCH',
          );
        }
      }
      await p.admissions.updateSession(s.session.id, { state: s.aggregate.currentPhase });
      await this.audit(
        p,
        s.session.trustDomain,
        result.sessionRef,
        s.did,
        status === 'EVIDENCE_RECEIVED'
          ? 'CONFIDENTIAL_EVIDENCE_VERIFIED'
          : 'CONFIDENTIAL_VERIFICATION_FAILED',
        this.timestamp(),
        { mode: result.mode, code: rejection ?? result.code ?? null },
      );
      return rejection ? { accepted: false, reason: rejection } : { accepted: true };
    });
  }

  /** U9 — policy integrity vs the pinned configuration; FactSet; Decision + private trace (FALSE ≠ MISSING). */
  async evaluateAdmission(
    sessionRef: string,
  ): Promise<{ decisionRef: string; outcome: PolicyOutcome }> {
    const { config } = this.deps.configuration.load();
    const policy = this.deps.policy.load();
    return this.deps.uow.run(async (p) => {
      const s = await this.load(p, sessionRef);
      const accepted = s.runs.findLast((r) => r.status === 'EVIDENCE_RECEIVED');
      const keyRef = challengeIdOf(s.session);
      const inputs: FactInput[] = [];
      if (s.session.keyPossessionValid !== undefined) {
        inputs.push({
          name: 'ASSERTION_KEY_POSSESSION_VALID',
          value: s.session.keyPossessionValid,
          provenance: { source: 'KEY_POSSESSION_VERIFIER', ref: keyRef },
        });
      }
      if (s.session.keyPurposeValid !== undefined) {
        inputs.push({
          name: 'ASSERTION_KEY_PURPOSE_VALID',
          value: s.session.keyPurposeValid,
          provenance: { source: 'KEY_POSSESSION_VERIFIER', ref: keyRef },
        });
      }
      if (accepted?.facts) inputs.push(...accepted.facts);
      const evaluation = evaluatePolicy({
        policy,
        expectedPolicyHash: config.admissionPolicyHash,
        facts: FactSet.from(inputs),
      });
      let evidenceCommitment: string;
      if (accepted?.evidenceCommitment) {
        evidenceCommitment = accepted.evidenceCommitment; // confidential evidence commitment (PLAN §23)
      } else if (s.runs.length === 0) {
        // [REF-IMPL] local decision evidence (maintainer decision 2026-09-11): a Decision made BEFORE any
        // confidential verification was requested (D23 key-possession failure) commits only to the local
        // evidence basis — it never pretends that confidential/provider evidence exists.
        evidenceCommitment = commit(localDecisionEvidence(s));
      } else {
        // No approved evidence-commitment profile exists for a Decision after confidential runs that all
        // failed; such a session stays undecided (its failed runs carry no facts and can never ALLOW).
        throw new AdmissionError(
          'EVIDENCE_COMMITMENT_UNDEFINED',
          'no approved evidence-commitment profile for a Decision after failed confidential runs',
        );
      }
      const decisionRef = this.deps.ids.id('decision');
      const decision = createDecision({
        policy: config.admissionPolicy,
        subject: s.did,
        action: ADMIT_TRUST_ANCHOR,
        resource: s.session.trustDomain,
        decision: evaluation.outcome,
        evaluatedAt: this.timestamp(),
        evidenceCommitment: evidenceCommitment as ReturnType<typeof commit>,
      });
      s.aggregate.recordDecision(evaluation.outcome, decisionRef);
      const reasonsOf = reasonLookup(s.session, accepted);
      const factsByName = new Map(inputs.map((f) => [f.name, f]));
      const trace: DecisionTraceEntry[] =
        evaluation.outcome === 'ERROR'
          ? []
          : evaluation.requirementResults.map((r) => {
              const fact = factsByName.get(r.claim);
              return {
                claim: r.claim,
                status: r.status,
                factValue: r.status === 'MISSING' ? undefined : fact?.value,
                provenance: r.status === 'MISSING' ? undefined : fact?.provenance,
                reasons: reasonsOf(r.claim),
              };
            });
      await p.admissions.recordDecision({
        sessionId: s.session.id,
        decisionRef,
        decision,
        decisionCommitment: commit(decision),
        policyHash: config.admissionPolicyHash,
        errorReason: evaluation.outcome === 'ERROR' ? evaluation.reason : undefined,
        trace,
      });
      await p.admissions.updateSession(s.session.id, { state: s.aggregate.currentPhase });
      const at = this.timestamp();
      await this.audit(p, s.session.trustDomain, sessionRef, s.did, 'POLICY_EVALUATED', at, {
        decision: evaluation.outcome,
        falseRequirements: trace.filter((t) => t.status === 'FALSE').map((t) => t.claim),
        missingRequirements: trace.filter((t) => t.status === 'MISSING').map((t) => t.claim),
      });
      if (evaluation.outcome !== 'ALLOW') {
        await this.audit(
          p,
          s.session.trustDomain,
          sessionRef,
          s.did,
          'TRUST_ANCHOR_ADMISSION_DENIED',
          at,
          { decision: evaluation.outcome },
        );
      }
      return { decisionRef, outcome: evaluation.outcome };
    });
  }

  /** U10 — ALLOW only: endorsement → verify → Admission Record → ACTIVE initial root, in one transaction. */
  async endorseAndActivate(sessionRef: string) {
    const { config } = this.deps.configuration.load();
    const pre = await this.deps.uow.run(async (p) => {
      const s = await this.load(p, sessionRef);
      if (s.aggregate.currentPhase !== 'DECIDED' || s.decision?.decision.decision !== 'ALLOW') {
        throw new AdmissionError('ENDORSEMENT_REFUSED', 'only an ALLOW Decision can be endorsed');
      }
      const resolved = await p.didState.resolve(s.did);
      const vm =
        resolved && s.session.assertionVerificationMethod
          ? findVerificationMethod(resolved.document, s.session.assertionVerificationMethod)
          : undefined;
      if (vm === undefined) {
        throw new AdmissionError('DID_NOT_RESOLVED', 'assertion key not resolvable');
      }
      return { decision: s.decision, vm, did: s.did };
    });
    const at = this.timestamp();
    const payload = buildEndorsementPayload({
      config,
      decision: pre.decision.decision,
      decisionRef: pre.decision.decisionRef,
      verificationMethod: pre.vm,
      endorsementId: this.deps.ids.id('endorsement'),
      endorsedAt: at,
    });
    const endorsement = await this.deps.bootstrapSigner.signEndorsement({
      payload,
      config,
      created: at,
    });
    const verification = verifyEndorsement(endorsement, {
      config,
      candidate: pre.did,
      verificationMethod: pre.vm,
      decision: pre.decision.decision,
      decisionRef: pre.decision.decisionRef,
      policyHash: pre.decision.policyHash,
      evidenceCommitment: pre.decision.decision.evidenceCommitment,
    });
    return this.deps.uow.run(async (p) => {
      const s = await this.load(p, sessionRef);
      s.aggregate.endorse(verification, endorsement.id); // refuses an invalid endorsement
      const record = createAdmissionRecord(endorsement, this.timestamp());
      s.aggregate.admit(record);
      await p.admissions.saveEndorsement(endorsement);
      await p.admissions.saveAdmissionRecord(this.deps.ids.id('record'), record);
      const established = await p.trustAnchors.establishInitialTrustAnchor(
        record.trustDomain,
        record.trustAnchor,
        this.deps.clock.now(),
      );
      if (established !== 'ESTABLISHED') {
        throw new AdmissionError('INITIAL_TRUST_ANCHOR_EXISTS', 'the initial Trust Anchor exists');
      }
      await p.admissions.updateSession(s.session.id, { state: s.aggregate.currentPhase });
      await this.audit(
        p,
        record.trustDomain,
        sessionRef,
        s.did,
        'BOOTSTRAP_ENDORSEMENT_CREATED',
        at,
        { signer: this.deps.bootstrapSigner.adapter },
      );
      await this.audit(
        p,
        record.trustDomain,
        sessionRef,
        s.did,
        'TRUST_ANCHOR_ADMITTED',
        this.timestamp(),
      );
      return { record, endorsement };
    });
  }

  /** U13 — the 12-check Trust Anchor verifier over persisted public state + the pinned configuration. */
  async verifyTrustAnchor(did: string): Promise<TrustAnchorVerificationResult> {
    const { config, hash } = this.deps.configuration.load();
    const policy = this.deps.policy.load();
    return this.deps.uow.run(async (p) => {
      const record = await p.admissions.loadAdmissionRecord(config.trustDomain, did);
      const resolved = await p.didState.resolve(did);
      const status = await p.trustAnchors.status(config.trustDomain, did);
      const subject = await p.subjects.findSubjectByDid(did);
      const vmStatus = record
        ? await p.didState.verificationMethodStatus(record.verificationMethod)
        : undefined;
      return verifyTrustAnchor({
        trustDomain: config.trustDomain,
        candidate: did,
        pinnedConfigurationHash: hash,
        config,
        policy,
        resolution: resolved
          ? { status: 'RESOLVED', document: resolved.document }
          : { status: 'NOT_FOUND' },
        record,
        decision: record ? await p.admissions.loadPublishedDecision(record.decisionRef) : undefined,
        endorsement: record
          ? await p.admissions.loadEndorsement(record.bootstrapEndorsementRef)
          : undefined,
        status: {
          trustAnchorStatus: status?.status ?? 'DEACTIVATED',
          verificationMethodStatus: vmStatus ?? 'REVOKED',
          subjectLifecycle: subject?.lifecycle ?? 'DEACTIVATED',
        },
      });
    });
  }

  /** Rebuilds the aggregate by replaying the persisted session, runs and Decision through its commands. */
  private async load(p: PersistencePorts, sessionRef: string): Promise<Loaded> {
    const session = await p.admissions.loadSession(sessionRef);
    if (session === undefined) {
      throw new AdmissionError('SESSION_NOT_FOUND', 'unknown admission session');
    }
    const subject = await p.subjects.findSubjectById(session.subjectId);
    if (subject === undefined) throw new AdmissionError('SESSION_NOT_FOUND', 'unknown subject');
    const runs = await p.admissions.listVerificationRuns(session.id);
    const decision = await p.admissions.loadDecision(session.id);
    const aggregate = new TrustAnchorAdmission(
      session.sessionRef,
      session.trustDomain,
      subject.did,
    );
    if (session.providerRefsAttached) aggregate.attachProviderReferences();
    if (session.assertionVerificationMethod) {
      aggregate.provisionKey(session.assertionVerificationMethod);
    }
    if (session.keyPossessionValid !== undefined) {
      aggregate.recordKeyProof(session.keyPossessionValid && session.keyPurposeValid === true);
    }
    for (const run of runs) {
      aggregate.requestVerification(run.runId);
      if (run.status === 'EVIDENCE_RECEIVED') aggregate.recordEvidence(run.runId);
      else if (run.status !== 'PENDING') aggregate.recordVerificationFailure(run.runId, run.status);
    }
    if (decision) aggregate.recordDecision(decision.decision.decision, decision.decisionRef);
    const replayed = aggregate.currentPhase;
    const persisted = session.state;
    if (
      persisted !== replayed &&
      !(replayed === 'DECIDED' && (persisted === 'ENDORSED' || persisted === 'ADMITTED'))
    ) {
      throw new AdmissionError(
        'STATE_INCONSISTENT',
        `persisted ${persisted} but replayed ${replayed}`,
      );
    }
    if (persisted === 'ENDORSED' || persisted === 'ADMITTED') {
      throw new AdmissionError('ALREADY_ADMITTED', 'this admission is complete');
    }
    return { session, did: subject.did as CatenorDid, runs, decision, aggregate };
  }

  private audit(
    p: PersistencePorts,
    trustDomain: string,
    requestId: string,
    subject: string,
    type: AuditEvent['type'],
    timestamp: string,
    details?: AuditEvent['details'],
  ) {
    return p.audit.append(trustDomain, {
      type,
      subject,
      timestamp,
      requestId,
      ...(details ? { details } : {}),
    });
  }

  private timestamp(): string {
    return rfc3339(this.deps.clock.now());
  }
}

/** The Subject's published ACTIVE Credential Assertion key, if one exists. */
async function existingAssertionKey(p: PersistencePorts, did: string) {
  const resolved = await p.didState.resolve(did);
  for (const vmId of resolved?.document.assertionMethod ?? []) {
    const keyRef = await p.didState.findKeyReference(vmId);
    const vm = resolved && findVerificationMethod(resolved.document, vmId);
    if (vm && keyRef?.purpose === 'CREDENTIAL_ASSERTION' && keyRef.status === 'ACTIVE') {
      return { verificationMethod: vm, document: resolved.document };
    }
  }
  return undefined;
}

const keyResult = (value: boolean | undefined) =>
  value === undefined ? 'MISSING' : value ? 'VALID' : 'INVALID';

/**
 * [REF-IMPL] `catenor-one/local-decision-evidence/v1` — the evidence basis of a Decision made before any
 * confidential verification exists. evidenceCommitment = SHA-256(JCS(object)).
 */
function localDecisionEvidence(s: Loaded) {
  return {
    profile: 'catenor-one/local-decision-evidence/v1',
    subject: s.did,
    trustDomain: s.session.trustDomain,
    verificationMethod: s.session.assertionVerificationMethod ?? null,
    keyPossessionResult: keyResult(s.session.keyPossessionValid),
    keyPurposeResult: keyResult(s.session.keyPurposeValid),
    reason: [...s.session.keyPossessionReasons],
    confidentialVerification: 'NOT_REQUESTED',
  };
}

/** One challenge per session: its id is derived from the session. */
function challengeIdOf(session: AdmissionSession): string {
  return `challenge:${session.id}`;
}

function rfc3339(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Why a confidential result must be rejected (no facts ever enter the FactSet in that case). */
function rejectionOf(
  result: ConfidentialVerificationResult,
  config: ReturnType<BootstrapConfigurationSource['load']>['config'],
  hash: string,
): string | undefined {
  if (result.v !== 1 || result.operation !== TRUST_ANCHOR_ADMISSION_OPERATION) {
    return 'RESULT_SCHEMA_INVALID';
  }
  if (result.bootstrapConfigurationHash !== hash) return 'CONFIGURATION_HASH_MISMATCH';
  const expected = config.acceptedEvidence;
  if (
    result.evidenceProfile !== expected.evidenceProfile ||
    result.evidenceSources.company !== expected.evidenceSources.company ||
    result.evidenceSources.representative !== expected.evidenceSources.representative
  ) {
    return 'EVIDENCE_SOURCE_MISMATCH'; // TV-S001-B04
  }
  if (result.status === 'OK') {
    const names = Object.keys(result.facts ?? {});
    if (names.length !== EVIDENCE_FACTS.length || !EVIDENCE_FACTS.every((n) => names.includes(n))) {
      return 'RESULT_SCHEMA_INVALID';
    }
    if (!/^0x[0-9a-f]{64}$/.test(result.evidenceCommitment ?? '')) return 'RESULT_SCHEMA_INVALID';
  }
  return undefined;
}

/** The six evidence facts; `null` stays absent so the policy sees it as MISSING. */
function evidenceFactInputs(result: ConfidentialVerificationResult): FactInput[] {
  return EVIDENCE_FACTS.flatMap((name) => {
    const value = result.facts?.[name];
    return typeof value === 'boolean'
      ? [
          {
            name,
            value,
            provenance: { source: 'CONFIDENTIAL_VERIFICATION' as const, ref: result.runId },
          },
        ]
      : [];
  });
}

function reasonLookup(session: AdmissionSession, accepted: StoredVerificationRun | undefined) {
  const factReasons = ((
    accepted?.commitmentInputs as { factReasons?: Partial<Record<FactName, string[]>> } | undefined
  )?.factReasons ?? {}) as Partial<Record<FactName, string[]>>;
  return (claim: FactName): readonly string[] =>
    claim === 'ASSERTION_KEY_POSSESSION_VALID' || claim === 'ASSERTION_KEY_PURPOSE_VALID'
      ? session.keyPossessionReasons
      : (factReasons[claim] ?? []);
}
