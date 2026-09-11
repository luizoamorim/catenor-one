// FAKE ConfidentialEvidenceVerifier (PLAN §32: "labeled FAKE in state and UI; cannot be selected in production
// configuration"). It performs NO provider call and NO confidential computation: it returns scripted result
// envelopes (mode "FAKE") so the S001 application flow can run before the CRE workflow is wired. Never a
// substitute for the REAL Sumsub sandbox leg or for CRE simulation/deployment evidence.
import { commit } from '@catenor-one/audit';
import type { BootstrapConfiguration } from '@catenor-one/authority';
import type {
  ConfidentialEvidenceVerifier,
  ConfidentialVerificationResult,
  EvidenceFactName,
  PrivateVerificationContext,
  ReconciliationResult,
} from '../../modules/trust-anchor-admission/application/admission.ports.js';

export type FakeScenario = 'GREEN' | 'REPRESENTATIVE_RED' | 'STALE_EVIDENCE' | 'BINDING_MISMATCH';

const ALL_TRUE: Record<EvidenceFactName, boolean | null> = {
  ORGANIZATION_KYB_VERIFIED: true,
  ORGANIZATION_STATUS_VALID: true,
  ORGANIZATION_AML_CLEAR: true,
  AUTHORIZED_REPRESENTATIVE_VERIFIED: true,
  REPRESENTATIVE_AUTHORITY_CONFIRMED: true,
  EVIDENCE_FRESH: true,
};

const SCENARIOS: Record<
  Exclude<FakeScenario, 'BINDING_MISMATCH'>,
  {
    facts: Record<EvidenceFactName, boolean | null>;
    reconciliation: { company: ReconciliationResult; representative: ReconciliationResult };
    factReasons?: Partial<Record<EvidenceFactName, string[]>>;
  }
> = {
  GREEN: {
    facts: ALL_TRUE,
    reconciliation: { company: 'CONSISTENT', representative: 'CONSISTENT' },
  },
  REPRESENTATIVE_RED: {
    facts: { ...ALL_TRUE, AUTHORIZED_REPRESENTATIVE_VERIFIED: false },
    reconciliation: { company: 'CONSISTENT', representative: 'MISMATCH' },
    factReasons: { AUTHORIZED_REPRESENTATIVE_VERIFIED: ['SANCTIONS', 'FINAL'] },
  },
  STALE_EVIDENCE: {
    facts: { ...ALL_TRUE, EVIDENCE_FRESH: false },
    reconciliation: { company: 'CONSISTENT', representative: 'STALE' },
  },
};

export class FakeConfidentialVerifier implements ConfidentialEvidenceVerifier {
  readonly mode = 'FAKE' as const;
  readonly workflowId = 'FAKE:confidential-verifier';
  private readonly requested = new Map<string, PrivateVerificationContext>();

  constructor(private readonly pinned: { config: BootstrapConfiguration; hash: string }) {}

  async request(input: {
    operation: 'TRUST_ANCHOR_ADMISSION';
    runId: string;
    context: PrivateVerificationContext;
  }): Promise<{ executionId: string }> {
    this.requested.set(input.runId, input.context);
    return { executionId: `FAKE:${input.runId}` };
  }

  /** The scripted result for a requested run (what a callback would deliver). */
  resultFor(runId: string, scenario: FakeScenario): ConfidentialVerificationResult {
    const context = this.requested.get(runId);
    if (context === undefined) throw new Error(`run ${runId} was not requested`);
    const { config, hash } = this.pinned;
    const base = {
      v: 1 as const,
      operation: 'TRUST_ANCHOR_ADMISSION' as const,
      runId,
      sessionRef: context.sessionRef,
      mode: this.mode,
      bootstrapConfigurationHash: hash,
      evidenceProfile: config.acceptedEvidence.evidenceProfile,
      evidenceSources: config.acceptedEvidence.evidenceSources,
    };
    if (scenario === 'BINDING_MISMATCH') {
      return { ...base, status: 'ERROR', code: 'PROVIDER_BINDING_MISMATCH' };
    }
    const s = SCENARIOS[scenario];
    const commitmentInput = {
      profile: 'catenor-one/evidence-commitment/FAKE/v1',
      runId,
      sessionRef: context.sessionRef,
      scenario,
      facts: s.facts,
    };
    return {
      ...base,
      status: 'OK',
      facts: s.facts,
      factReasons: s.factReasons,
      reconciliation: s.reconciliation,
      evidenceCommitment: commit(commitmentInput),
      commitmentInput,
    };
  }
}
