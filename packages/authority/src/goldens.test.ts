// T2.9 — the committed S001 golden vectors must stay consistent with the domain implementation.
import { canonicalizeToString } from '@catenor-one/audit';
import { prepareProof, type DataIntegrityProof } from '@catenor-one/credentials';
import {
  encodeEd25519Multikey,
  type DidDocument,
  type VerificationMethod,
} from '@catenor-one/identity';
import {
  FactSet,
  evaluatePolicy,
  policyHash,
  type Decision,
  type FactInput,
  type PolicyEvaluation,
} from '@catenor-one/policy';
import { loadVector } from '@catenor-one/test-vectors';
import { S001_TEST_KEY_LABELS, testEd25519Key } from '@catenor-one/test-vectors/test-keys';
import { describe, expect, it } from 'vitest';
import { createAdmissionRecord, type TrustAnchorAdmissionRecord } from './admission-record.js';
import {
  bootstrapConfigurationHash,
  parseBootstrapConfiguration,
} from './bootstrap-configuration.js';
import {
  decisionCommitment,
  verificationMethodCommitment,
  verifyEndorsement,
  type BootstrapEndorsement,
} from './endorsement.js';
import { verifyKeyPossession, type KeyPossessionChallenge } from './key-possession.js';
import { POLICY } from './scenario.test-fixtures.js';
import { verifyTrustAnchor } from './trust-anchor-verifier.js';

const policyGolden = loadVector<{ canonicalPolicy: string; policyHash: string }>(
  's001',
  'policy-v1',
);
const identity = loadVector<{
  testKeyLabel: string;
  didDocument: DidDocument;
  verificationMethodCommitment: string;
  fixtureVerificationMethod: VerificationMethod;
  fixtureVerificationMethodCommitment: string;
  fixtureReplacementCommitment: string;
}>('s001', 'identity');
const keyPossession = loadVector<{
  testKeyLabel: string;
  publicKeyMultibase: string;
  challenge: KeyPossessionChallenge;
  verifiedAt: string;
  hashDataHex: string;
  proof: DataIntegrityProof;
}>('s001', 'key-possession');
const factSets = loadVector<{
  policyHash: string;
  cases: Record<string, { facts: FactInput[]; expected: PolicyEvaluation }>;
}>('s001', 'fact-sets');
const admission = loadVector<{
  testKeyLabels: { assertion: string; bootstrap: string };
  bootstrapConfiguration: unknown;
  bootstrapConfigurationHash: string;
  didDocument: DidDocument;
  decision: Decision;
  decisionRef: string;
  decisionCommitment: string;
  endorsement: BootstrapEndorsement;
  admissionRecord: TrustAnchorAdmissionRecord;
}>('s001', 'admission');

describe('S001 golden vectors (T2.9)', () => {
  it('policy-v1: canonical form and policyHash match the packaged policy', () => {
    expect(canonicalizeToString(POLICY)).toBe(policyGolden.canonicalPolicy);
    expect(policyHash(POLICY)).toBe(policyGolden.policyHash);
  });

  it('golden keys are the TEST-ONLY keys derived from their public labels; assertion ≠ bootstrap', () => {
    const multikey = (label: string) => encodeEd25519Multikey(testEd25519Key(label).publicKey);
    const { assertionKey1, bootstrapKey1 } = S001_TEST_KEY_LABELS;
    expect(keyPossession.testKeyLabel).toBe(assertionKey1);
    expect(identity.testKeyLabel).toBe(assertionKey1);
    expect(admission.testKeyLabels).toEqual({ assertion: assertionKey1, bootstrap: bootstrapKey1 });
    expect(identity.didDocument.verificationMethod[0]!.publicKeyMultibase).toBe(
      multikey(assertionKey1),
    );
    expect(keyPossession.publicKeyMultibase).toBe(multikey(assertionKey1));
    const config = admission.bootstrapConfiguration as { bootstrapPublicKeyMultibase: string };
    expect(config.bootstrapPublicKeyMultibase).toBe(multikey(bootstrapKey1));
    expect(config.bootstrapPublicKeyMultibase).not.toBe(keyPossession.publicKeyMultibase);
  });

  it('identity: verificationMethodCommitment values (TEST-VECTORS §6, G06/J07)', () => {
    const [vm] = identity.didDocument.verificationMethod;
    expect(verificationMethodCommitment(vm!)).toBe(identity.verificationMethodCommitment);
    expect(verificationMethodCommitment(identity.fixtureVerificationMethod)).toBe(
      identity.fixtureVerificationMethodCommitment,
    );
    expect(identity.fixtureReplacementCommitment).not.toBe(
      identity.fixtureVerificationMethodCommitment,
    );
  });

  it('key-possession: hashData and proof verify against the golden DID Document (TV-S001-D01)', () => {
    const { proofOptions, hashData } = prepareProof(
      keyPossession.challenge as unknown as Record<string, unknown>,
      (({ proofValue: _v, ...rest }) => rest)(keyPossession.proof),
    );
    expect(Buffer.from(hashData).toString('hex')).toBe(keyPossession.hashDataHex);
    expect(proofOptions.verificationMethod).toBe(keyPossession.challenge.verificationMethod);
    const result = verifyKeyPossession({
      record: { challenge: keyPossession.challenge, status: 'ISSUED' },
      requestedSubject: keyPossession.challenge.subject,
      trustDomain: keyPossession.challenge.trustDomain,
      didDocument: identity.didDocument,
      keyReference: {
        subject: identity.didDocument.id,
        verificationMethod: identity.didDocument.verificationMethod[0]!.id,
        signerRef: 'signer:fixture:assertion-key-1',
        purpose: 'CREDENTIAL_ASSERTION',
        status: 'ACTIVE',
      },
      proof: keyPossession.proof,
      now: new Date(keyPossession.verifiedAt),
    });
    expect(result).toMatchObject({ possessionValid: true, purposeValid: true });
  });

  it.each(Object.keys(factSets.cases))(
    'fact-sets: %s evaluates to its golden outcome and trace',
    (id) => {
      const { facts, expected } = factSets.cases[id]!;
      expect(
        evaluatePolicy({
          policy: POLICY,
          expectedPolicyHash: factSets.policyHash,
          facts: FactSet.from(facts),
        }),
      ).toEqual({
        ...expected,
        policy: expect.anything(),
      });
    },
  );

  it('admission: configuration, decision commitment, endorsement and record are consistent (B01, G01, H01, J01)', () => {
    const config = parseBootstrapConfiguration(admission.bootstrapConfiguration);
    expect(bootstrapConfigurationHash(config)).toBe(admission.bootstrapConfigurationHash);
    expect(decisionCommitment(admission.decision)).toBe(admission.decisionCommitment);
    const vm = admission.didDocument.verificationMethod[0]!;
    expect(
      verifyEndorsement(admission.endorsement, {
        config,
        candidate: admission.decision.subject,
        verificationMethod: vm,
        decision: admission.decision,
        decisionRef: admission.decisionRef,
        policyHash: config.admissionPolicyHash,
        evidenceCommitment: admission.decision.evidenceCommitment,
      }),
    ).toEqual({ valid: true, failures: [] });
    expect(
      createAdmissionRecord(admission.endorsement, admission.admissionRecord.createdAt),
    ).toEqual(admission.admissionRecord);
    expect(
      verifyTrustAnchor({
        trustDomain: config.trustDomain,
        candidate: admission.decision.subject,
        pinnedConfigurationHash: admission.bootstrapConfigurationHash,
        config,
        policy: POLICY,
        resolution: { status: 'RESOLVED', document: admission.didDocument },
        record: admission.admissionRecord,
        decision: admission.decision,
        endorsement: admission.endorsement,
        status: {
          trustAnchorStatus: 'ACTIVE',
          verificationMethodStatus: 'ACTIVE',
          subjectLifecycle: 'ACTIVE',
        },
      }).TRUST_ANCHOR_VALID,
    ).toBe(true);
  });
});
