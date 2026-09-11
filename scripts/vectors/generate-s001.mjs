#!/usr/bin/env node
// T2.9 — regenerates S001 golden vectors in test-vectors/s001/ from the built domain packages.
// Run: `pnpm vectors:s001` (builds first). Values follow TEST-VECTORS.md fixtures where they exist.
//
// Signing keys are the TEST-ONLY, NON-SECRET keys of @catenor-one/test-vectors/test-keys, derived from
// public labels (seed = SHA-256(UTF-8(label))). Ed25519 is deterministic, so regenerating produces
// byte-identical files (`pnpm vectors:s001:check`). The files store labels and public keys only.
import { writeFileSync } from 'node:fs';
import { commit, canonicalizeToString } from '@catenor-one/audit';
import { attachProofValue, prepareProof } from '@catenor-one/credentials';
import {
  assertionKeyId,
  createDidDocument,
  createVerificationMethod,
  encodeEd25519Multikey,
  parseCatenorDid,
} from '@catenor-one/identity';
import {
  FACT_NAMES,
  FactSet,
  createDecision,
  evaluatePolicy,
  parsePolicyDocument,
  policyHash,
} from '@catenor-one/policy';
import {
  bootstrapConfigurationHash,
  buildEndorsementPayload,
  createAdmissionRecord,
  decisionCommitment,
  parseBootstrapConfiguration,
  prepareEndorsementProof,
  verificationMethodCommitment,
} from '@catenor-one/authority';
import { S001_TEST_KEY_LABELS, testEd25519Key } from '@catenor-one/test-vectors/test-keys';
import { ed25519 } from '@noble/curves/ed25519.js';
import { readFileSync } from 'node:fs';

const OUT = new URL('../../test-vectors/s001/', import.meta.url);
const GENERATED_BY = 'scripts/vectors/generate-s001.mjs (T2.9)';
const write = (name, body) =>
  writeFileSync(
    new URL(`${name}.json`, OUT),
    `${JSON.stringify({ generatedBy: GENERATED_BY, ...body }, null, 2)}\n`,
  );
const testKey = (label) => {
  const { secretKey, publicKey } = testEd25519Key(label);
  return { label, secretKey, multikey: encodeEd25519Multikey(publicKey) };
};

// TEST-VECTORS §2 / §4 / §6 / §7 fixtures
const TRUST_DOMAIN = 'trust-domain:catenor-one-demo';
const DID = parseCatenorDid('did:catenor:8f0c92d7e5f04e40a41faee32e5e180b');

// 1 policy hash (AC-S001-039)
const policy = JSON.parse(
  readFileSync(
    new URL('../../packages/policy/policies/trust-anchor-admission.v1.json', import.meta.url),
    'utf8',
  ),
);
parsePolicyDocument(policy);
write('policy-v1', {
  policyId: policy.id,
  canonicalPolicy: canonicalizeToString(policy),
  policyHash: policyHash(policy),
});

// 2 identity: DID Document + verificationMethodCommitment (TEST-VECTORS §6, TV-S001-C03, G06/J07)
const assertionKey = testKey(S001_TEST_KEY_LABELS.assertionKey1);
const vm = createVerificationMethod(assertionKeyId(DID, 1), DID, assertionKey.multikey);
const didDocument = createDidDocument(DID, [vm], [vm.id]);
const fixtureVm = {
  id: `${DID}#assertion-key-1`,
  controller: DID,
  type: 'Multikey',
  publicKeyMultibase: 'z6MkFixtureAssertionPublicKey001',
};
write('identity', {
  note: 'didDocument uses the TEST-ONLY, NON-SECRET assertion key derived from testKeyLabel (seed = SHA-256(UTF-8(label))); fixtureVerificationMethod uses the TEST-VECTORS §6 placeholder key',
  testKeyLabel: assertionKey.label,
  didDocument,
  verificationMethodCommitment: verificationMethodCommitment(vm),
  fixtureVerificationMethod: fixtureVm,
  fixtureVerificationMethodCommitment: verificationMethodCommitment(fixtureVm),
  fixtureReplacementCommitment: verificationMethodCommitment({
    ...fixtureVm,
    publicKeyMultibase: 'z6MkFixtureReplacementKey999',
  }),
});

// 3 key possession: TEST-VECTORS §7 challenge + eddsa-jcs-2022 proof (TV-S001-D01)
const challenge = {
  type: 'CatenorOneKeyPossessionChallenge',
  challengeId: 'challenge:admission:001',
  subject: DID,
  verificationMethod: vm.id,
  operation: 'ADMIT_TRUST_ANCHOR',
  trustDomain: TRUST_DOMAIN,
  nonce: 'opaque-random-nonce-001',
  issuedAt: '2026-09-09T22:00:00Z',
  expiresAt: '2026-09-09T22:05:00Z',
};
const kp = prepareProof(challenge, {
  type: 'DataIntegrityProof',
  cryptosuite: 'eddsa-jcs-2022',
  verificationMethod: vm.id,
  proofPurpose: 'assertionMethod',
  created: '2026-09-09T22:01:00Z',
  challenge: challenge.nonce,
  domain: TRUST_DOMAIN,
});
write('key-possession', {
  challenge,
  verifiedAt: '2026-09-09T22:01:00Z',
  testKeyLabel: assertionKey.label,
  publicKeyMultibase: assertionKey.multikey,
  hashDataHex: Buffer.from(kp.hashData).toString('hex'),
  proof: attachProofValue(kp.proofOptions, ed25519.sign(kp.hashData, assertionKey.secretKey)),
  expected: { ASSERTION_KEY_POSSESSION_VALID: true, ASSERTION_KEY_PURPOSE_VALID: true },
});

// 4 fact sets TV-S001-F01–F11 with expected outcomes and traces
const pin = policyHash(policy);
const fact = (name, value) => ({
  name,
  value,
  provenance: {
    source: name.startsWith('ASSERTION_KEY_')
      ? 'KEY_POSSESSION_VERIFIER'
      : 'CONFIDENTIAL_VERIFICATION',
    ref: 'fixture',
  },
});
const happy = () => FACT_NAMES.map((n) => fact(n, true));
const cases = {
  'TV-S001-F01': happy(),
  'TV-S001-F02': happy().map((f) =>
    f.name === 'ORGANIZATION_KYB_VERIFIED' ? { ...f, value: false } : f,
  ),
  'TV-S001-F03': happy().map((f) =>
    f.name === 'ORGANIZATION_STATUS_VALID' ? { ...f, value: false } : f,
  ),
  'TV-S001-F04': happy().map((f) =>
    f.name === 'ORGANIZATION_AML_CLEAR' ? { ...f, value: false } : f,
  ),
  'TV-S001-F05': happy().map((f) =>
    f.name === 'AUTHORIZED_REPRESENTATIVE_VERIFIED' ? { ...f, value: false } : f,
  ),
  'TV-S001-F06': happy().map((f) =>
    f.name === 'REPRESENTATIVE_AUTHORITY_CONFIRMED' ? { ...f, value: false } : f,
  ),
  'TV-S001-F07': happy().map((f) =>
    f.name === 'ASSERTION_KEY_POSSESSION_VALID' ? { ...f, value: false } : f,
  ),
  'TV-S001-F08': happy().map((f) =>
    f.name === 'ASSERTION_KEY_PURPOSE_VALID' ? { ...f, value: false } : f,
  ),
  'TV-S001-F09': happy().map((f) => (f.name === 'EVIDENCE_FRESH' ? { ...f, value: false } : f)),
  'TV-S001-F10': happy().filter((f) => f.name !== 'ORGANIZATION_AML_CLEAR'),
  'TV-S001-F11': [
    ...happy().map((f) => (f.name === 'ORGANIZATION_AML_CLEAR' ? { ...f, value: false } : f)),
    fact('SUPER_TRUSTED_BY_UI', true),
  ],
};
write('fact-sets', {
  policyHash: pin,
  cases: Object.fromEntries(
    Object.entries(cases).map(([id, facts]) => {
      const result = evaluatePolicy({
        policy,
        expectedPolicyHash: pin,
        facts: FactSet.from(facts),
      });
      return [
        id,
        {
          facts,
          expected: { outcome: result.outcome, requirementResults: result.requirementResults },
        },
      ];
    }),
  ),
});

// 5 bootstrap configuration, decision, endorsement and Admission Record (TV-S001-B01, G01, H01)
const bootstrapKey = testKey(S001_TEST_KEY_LABELS.bootstrapKey1);
const config = parseBootstrapConfiguration({
  type: 'CatenorTrustDomainBootstrapConfiguration',
  profile: 'catenor-one/bootstrap-configuration/v1',
  trustDomain: TRUST_DOMAIN,
  admissionPolicy: policy.id,
  admissionPolicyHash: pin,
  bootstrapVerificationMethod: 'bootstrap-verification-method:1',
  bootstrapPublicKeyMultibase: bootstrapKey.multikey,
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
});
const decision = createDecision({
  policy: policy.id,
  subject: DID,
  action: 'ADMIT_TRUST_ANCHOR',
  resource: TRUST_DOMAIN,
  decision: 'ALLOW',
  evaluatedAt: '2026-09-09T22:10:00Z',
  evidenceCommitment: commit({ fixture: 'evidence-commitment-input' }),
});
const payload = buildEndorsementPayload({
  config,
  decision,
  decisionRef: 'decision:admission:001',
  verificationMethod: vm,
  endorsementId: 'endorsement:bootstrap:001',
  endorsedAt: '2026-09-10T00:00:00Z',
});
const ep = prepareEndorsementProof(payload, config, '2026-09-10T00:00:01Z');
const endorsement = {
  ...payload,
  proof: attachProofValue(ep.proofOptions, ed25519.sign(ep.hashData, bootstrapKey.secretKey)),
};
write('admission', {
  note: 'bootstrap and assertion keys are TEST-ONLY, NON-SECRET keys derived from the labels below (seed = SHA-256(UTF-8(label))); evidenceCommitment is a placeholder commitment until the T8.5 evidence-commitment golden exists',
  testKeyLabels: { assertion: assertionKey.label, bootstrap: bootstrapKey.label },
  bootstrapConfiguration: config,
  bootstrapConfigurationHash: bootstrapConfigurationHash(config),
  didDocument,
  decision,
  decisionRef: 'decision:admission:001',
  decisionCommitment: decisionCommitment(decision),
  endorsement,
  admissionRecord: createAdmissionRecord(endorsement, '2026-09-10T00:00:02Z'),
});

console.log('S001 golden vectors written to test-vectors/s001/');
