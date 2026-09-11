import type { PolicyOutcome } from '@catenor-one/policy';
import type { TrustAnchorAdmissionRecord, TrustAnchorStatus } from './admission-record.js';
import type { EndorsementVerification } from './endorsement.js';

export type AdmissionPhase =
  | 'STARTED'
  | 'KEY_PROVISIONED'
  | 'KEY_PROOF_VALID'
  | 'KEY_PROOF_INVALID'
  | 'VERIFICATION_REQUESTED'
  | 'EVIDENCE_RECEIVED'
  | 'VERIFICATION_FAILED'
  | 'DECIDED'
  | 'ENDORSED'
  | 'ADMITTED';

export type VerificationFailureCode = 'ERROR' | 'TIMED_OUT' | 'BINDING_MISMATCH';

/** Maximum confidential verification runs per session (PLAN §4.3). */
export const MAX_VERIFICATION_RUNS = 3;

export class IllegalTransitionError extends Error {
  constructor(command: string, phase: AdmissionPhase, detail?: string) {
    super(`${command} is not allowed in phase ${phase}${detail ? `: ${detail}` : ''}`);
    this.name = 'IllegalTransitionError';
  }
}

interface VerificationRun {
  readonly runId: string;
  status: 'PENDING' | 'EVIDENCE_RECEIVED' | VerificationFailureCode;
}

export interface AdmissionHistoryEntry {
  readonly command: string;
  readonly from: AdmissionPhase;
  readonly to: AdmissionPhase;
}

/**
 * `TrustAnchorAdmission` — the admission session state machine (PLAN §4.3). Rules:
 *   no ADMITTED without Decision.ALLOW + a verified bootstrap endorsement (TV-S001-B03, H03)
 *   a failed key proof fixes the session to DENY; no confidential verification after it (TV-S001-K02, D23)
 *   evidence accepted at most once per run; late/duplicate results rejected
 *   terminal states (DECIDED DENY/ERROR, ADMITTED) are immutable; history is auditable
 */
export class TrustAnchorAdmission {
  private phase: AdmissionPhase = 'STARTED';
  private providerRefsAttached = false;
  private assertionVerificationMethod: string | undefined;
  private readonly runs: VerificationRun[] = [];
  private decisionOutcome: PolicyOutcome | undefined;
  private decisionRef: string | undefined;
  private endorsementRef: string | undefined;
  private record: TrustAnchorAdmissionRecord | undefined;
  private readonly log: AdmissionHistoryEntry[] = [];

  constructor(
    readonly sessionRef: string,
    readonly trustDomain: string,
    readonly subject: string,
  ) {}

  get currentPhase(): AdmissionPhase {
    return this.phase;
  }
  get history(): readonly AdmissionHistoryEntry[] {
    return this.log;
  }
  get decision(): { outcome: PolicyOutcome; decisionRef: string } | undefined {
    return this.decisionOutcome && this.decisionRef
      ? { outcome: this.decisionOutcome, decisionRef: this.decisionRef }
      : undefined;
  }
  get admissionRecord(): TrustAnchorAdmissionRecord | undefined {
    return this.record;
  }
  get verificationRuns(): number {
    return this.runs.length;
  }
  /** ACTIVE only after admission; otherwise the subject is not a Trust Anchor (AC-S001-051). */
  get trustAnchorStatus(): TrustAnchorStatus | undefined {
    return this.phase === 'ADMITTED' ? 'ACTIVE' : undefined;
  }
  get isTerminal(): boolean {
    return (
      this.phase === 'ADMITTED' || (this.phase === 'DECIDED' && this.decisionOutcome !== 'ALLOW')
    );
  }

  provisionKey(verificationMethod: string): void {
    this.require('provisionKey', ['STARTED']);
    this.assertionVerificationMethod = verificationMethod;
    this.move('provisionKey', 'KEY_PROVISIONED');
  }

  /** Re-attachable until a verification run succeeds (PLAN §4.2 / §4.3). */
  attachProviderReferences(): void {
    this.require('attachProviderReferences', [
      'STARTED',
      'KEY_PROVISIONED',
      'KEY_PROOF_VALID',
      'VERIFICATION_FAILED',
    ]);
    this.providerRefsAttached = true;
    this.log.push({ command: 'attachProviderReferences', from: this.phase, to: this.phase });
  }

  recordKeyProof(valid: boolean): void {
    this.require('recordKeyProof', ['KEY_PROVISIONED']);
    this.move('recordKeyProof', valid ? 'KEY_PROOF_VALID' : 'KEY_PROOF_INVALID');
  }

  requestVerification(runId: string): void {
    this.require('requestVerification', ['KEY_PROOF_VALID', 'VERIFICATION_FAILED']);
    if (!this.providerRefsAttached) {
      throw new IllegalTransitionError(
        'requestVerification',
        this.phase,
        'provider references not attached',
      );
    }
    if (this.runs.length >= MAX_VERIFICATION_RUNS) {
      throw new IllegalTransitionError(
        'requestVerification',
        this.phase,
        'verification run limit reached',
      );
    }
    if (this.runs.some((r) => r.runId === runId)) {
      throw new IllegalTransitionError('requestVerification', this.phase, 'duplicate runId');
    }
    this.runs.push({ runId, status: 'PENDING' });
    this.move('requestVerification', 'VERIFICATION_REQUESTED');
  }

  /** Accepts evidence for the pending run only — once (late and duplicate results are rejected). */
  recordEvidence(runId: string): void {
    this.require('recordEvidence', ['VERIFICATION_REQUESTED']);
    this.pendingRun('recordEvidence', runId).status = 'EVIDENCE_RECEIVED';
    this.move('recordEvidence', 'EVIDENCE_RECEIVED');
  }

  recordVerificationFailure(runId: string, code: VerificationFailureCode): void {
    this.require('recordVerificationFailure', ['VERIFICATION_REQUESTED']);
    this.pendingRun('recordVerificationFailure', runId).status = code;
    this.move('recordVerificationFailure', 'VERIFICATION_FAILED');
  }

  /**
   * Records the policy outcome. ALLOW only after evidence was received; a failed key proof can only
   * lead to DENY (D23); failed verification can lead to DENY or ERROR, never ALLOW.
   */
  recordDecision(outcome: PolicyOutcome, decisionRef: string): void {
    this.require('recordDecision', [
      'EVIDENCE_RECEIVED',
      'KEY_PROOF_INVALID',
      'VERIFICATION_FAILED',
    ]);
    if (this.phase === 'KEY_PROOF_INVALID' && outcome !== 'DENY') {
      throw new IllegalTransitionError(
        'recordDecision',
        this.phase,
        'a failed key proof can only DENY',
      );
    }
    if (this.phase === 'VERIFICATION_FAILED' && outcome === 'ALLOW') {
      throw new IllegalTransitionError('recordDecision', this.phase, 'no ALLOW without evidence');
    }
    this.decisionOutcome = outcome;
    this.decisionRef = decisionRef;
    this.move('recordDecision', 'DECIDED');
  }

  /** Requires an ALLOW decision and a verified endorsement (AC-S001-045, 046). */
  endorse(verification: EndorsementVerification, endorsementRef: string): void {
    this.require('endorse', ['DECIDED']);
    if (this.decisionOutcome !== 'ALLOW') {
      throw new IllegalTransitionError(
        'endorse',
        this.phase,
        `decision is ${this.decisionOutcome}`,
      );
    }
    if (!verification.valid) {
      throw new IllegalTransitionError(
        'endorse',
        this.phase,
        `endorsement invalid: ${verification.failures.join(', ')}`,
      );
    }
    this.endorsementRef = endorsementRef;
    this.move('endorse', 'ENDORSED');
  }

  /** Activates the Initial Trust Anchor with a record derived from the verified endorsement. */
  admit(record: TrustAnchorAdmissionRecord): void {
    this.require('admit', ['ENDORSED']);
    if (
      record.trustAnchor !== this.subject ||
      record.trustDomain !== this.trustDomain ||
      record.decisionRef !== this.decisionRef ||
      record.bootstrapEndorsementRef !== this.endorsementRef ||
      record.verificationMethod !== this.assertionVerificationMethod
    ) {
      throw new IllegalTransitionError('admit', this.phase, 'record does not match this admission');
    }
    this.record = record;
    this.move('admit', 'ADMITTED');
  }

  private pendingRun(command: string, runId: string): VerificationRun {
    const current = this.runs[this.runs.length - 1];
    if (current === undefined || current.runId !== runId || current.status !== 'PENDING') {
      throw new IllegalTransitionError(
        command,
        this.phase,
        'late or duplicate verification result',
      );
    }
    return current;
  }

  private require(command: string, allowed: readonly AdmissionPhase[]): void {
    if (this.isTerminal) throw new IllegalTransitionError(command, this.phase, 'terminal state');
    if (!allowed.includes(this.phase)) throw new IllegalTransitionError(command, this.phase);
  }

  private move(command: string, to: AdmissionPhase): void {
    this.log.push({ command, from: this.phase, to });
    this.phase = to;
  }
}
