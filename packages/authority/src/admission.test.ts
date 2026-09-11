import { describe, expect, it } from 'vitest';
import { createAdmissionRecord } from './admission-record.js';
import {
  IllegalTransitionError,
  MAX_VERIFICATION_RUNS,
  TrustAnchorAdmission,
} from './admission.js';
import { verifyEndorsement } from './endorsement.js';
import { CANDIDATE_DID, TRUST_DOMAIN, happyScenario } from './scenario.test-fixtures.js';

const s = happyScenario();
const validEndorsement = verifyEndorsement(s.endorsement, {
  config: s.config,
  candidate: CANDIDATE_DID,
  verificationMethod: s.vm,
  decision: s.decision,
  decisionRef: s.decisionRef,
  policyHash: s.config.admissionPolicyHash,
  evidenceCommitment: s.decision.evidenceCommitment,
});

function session(): TrustAnchorAdmission {
  return new TrustAnchorAdmission('admission-session:1', TRUST_DOMAIN, CANDIDATE_DID);
}

/** Drives a session up to EVIDENCE_RECEIVED. */
function withEvidence(): TrustAnchorAdmission {
  const a = session();
  a.provisionKey(s.vm.id);
  a.attachProviderReferences();
  a.recordKeyProof(true);
  a.requestVerification('run:1');
  a.recordEvidence('run:1');
  return a;
}

describe('TrustAnchorAdmission state machine (PLAN §4.3)', () => {
  it('TV-S001-H01 — ALLOW + valid endorsement → one Admission Record, status ACTIVE (AC-S001-047, 050)', () => {
    const a = withEvidence();
    a.recordDecision('ALLOW', s.decisionRef);
    a.endorse(validEndorsement, s.endorsement.id);
    a.admit(s.record);
    expect(a.currentPhase).toBe('ADMITTED');
    expect(a.trustAnchorStatus).toBe('ACTIVE');
    expect(a.admissionRecord).toEqual(s.record);
    expect(a.history.map((h) => h.command)).toEqual([
      'provisionKey',
      'attachProviderReferences',
      'recordKeyProof',
      'requestVerification',
      'recordEvidence',
      'recordDecision',
      'endorse',
      'admit',
    ]);
  });

  it('TV-S001-B03 — a self-asserted candidate cannot activate without Decision and endorsement (AC-S001-006)', () => {
    const a = session();
    a.provisionKey(s.vm.id);
    expect(() => a.endorse(validEndorsement, s.endorsement.id)).toThrow(IllegalTransitionError);
    expect(() => a.admit(s.record)).toThrow(IllegalTransitionError);
    expect(a.trustAnchorStatus).toBeUndefined();
  });

  it('TV-S001-H02 / G02 — DENY is terminal: no endorsement, no record, not ACTIVE (AC-S001-048, 051)', () => {
    const a = withEvidence();
    a.recordDecision('DENY', 'decision:admission:002');
    expect(a.isTerminal).toBe(true);
    expect(() => a.endorse(validEndorsement, s.endorsement.id)).toThrow(/terminal state/);
    expect(() => a.admit(s.record)).toThrow(/terminal state/);
    expect(a.admissionRecord).toBeUndefined();
    expect(a.trustAnchorStatus).toBeUndefined();
  });

  it('TV-S001-H03 — ALLOW without a bootstrap endorsement is not ACTIVE', () => {
    const a = withEvidence();
    a.recordDecision('ALLOW', s.decisionRef);
    expect(a.trustAnchorStatus).toBeUndefined();
    expect(() => a.admit(s.record)).toThrow(IllegalTransitionError);
  });

  it('an invalid endorsement blocks activation (AC-S001-046)', () => {
    const a = withEvidence();
    a.recordDecision('ALLOW', s.decisionRef);
    expect(() =>
      a.endorse(
        { valid: false, failures: ['VERIFICATION_METHOD_COMMITMENT_MISMATCH'] },
        s.endorsement.id,
      ),
    ).toThrow(/endorsement invalid/);
    expect(a.trustAnchorStatus).toBeUndefined();
  });

  it('ERROR never becomes ALLOW and is terminal (AC-S001-038)', () => {
    const a = withEvidence();
    a.recordDecision('ERROR', 'decision:admission:003');
    expect(a.isTerminal).toBe(true);
    expect(() => a.endorse(validEndorsement, s.endorsement.id)).toThrow(IllegalTransitionError);
  });

  it('TV-S001-K02 / D23 — a failed key proof can only DENY and never reaches confidential verification', () => {
    const a = session();
    a.provisionKey(s.vm.id);
    a.recordKeyProof(false);
    expect(() => a.attachProviderReferences()).toThrow(IllegalTransitionError);
    expect(() => a.requestVerification('run:1')).toThrow(IllegalTransitionError);
    expect(() => a.recordDecision('ALLOW', 'decision:x')).toThrow(/can only DENY/);
    a.recordDecision('DENY', 'decision:admission:004');
    expect(a.verificationRuns).toBe(0);
    // a retry is a new session; the failed one stays auditable and immutable
    expect(() => a.recordKeyProof(true)).toThrow(/terminal state/);
    const retry = session();
    retry.provisionKey(s.vm.id);
    retry.recordKeyProof(true);
    expect(retry.currentPhase).toBe('KEY_PROOF_VALID');
    expect(a.history.at(-1)).toMatchObject({ command: 'recordDecision', to: 'DECIDED' });
  });

  it('confidential verification requires attached provider references', () => {
    const a = session();
    a.provisionKey(s.vm.id);
    a.recordKeyProof(true);
    expect(() => a.requestVerification('run:1')).toThrow(/provider references not attached/);
  });

  it('accepts evidence once per run; late and duplicate results are rejected', () => {
    const a = session();
    a.provisionKey(s.vm.id);
    a.attachProviderReferences();
    a.recordKeyProof(true);
    a.requestVerification('run:1');
    a.recordVerificationFailure('run:1', 'TIMED_OUT');
    a.attachProviderReferences(); // re-attachable after a failed run
    a.requestVerification('run:2');
    expect(() => a.recordEvidence('run:1')).toThrow(/late or duplicate/);
    a.recordEvidence('run:2');
    expect(() => a.recordEvidence('run:2')).toThrow(IllegalTransitionError);
    expect(() => a.attachProviderReferences()).toThrow(IllegalTransitionError);
  });

  it(`limits a session to ${MAX_VERIFICATION_RUNS} runs; failed verification can never ALLOW`, () => {
    const a = session();
    a.provisionKey(s.vm.id);
    a.attachProviderReferences();
    a.recordKeyProof(true);
    for (let i = 1; i <= MAX_VERIFICATION_RUNS; i++) {
      a.requestVerification(`run:${i}`);
      a.recordVerificationFailure(`run:${i}`, 'BINDING_MISMATCH');
    }
    expect(() => a.requestVerification('run:4')).toThrow(/run limit/);
    expect(() => a.recordDecision('ALLOW', 'decision:x')).toThrow(/no ALLOW without evidence/);
    a.recordDecision('ERROR', 'decision:admission:005');
    expect(a.trustAnchorStatus).toBeUndefined();
  });

  it('rejects an Admission Record that does not match this admission', () => {
    const a = withEvidence();
    a.recordDecision('ALLOW', s.decisionRef);
    a.endorse(validEndorsement, s.endorsement.id);
    const foreign = {
      ...createAdmissionRecord(s.endorsement, '2026-09-10T00:00:02Z'),
      trustAnchor: 'did:catenor:00000000000000000000000000000001',
    };
    expect(() => a.admit(foreign)).toThrow(/does not match/);
    expect(a.trustAnchorStatus).toBeUndefined();
  });
});
