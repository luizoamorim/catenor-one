// Test-only fixtures for @catenor-one/authority (never built into dist, exempt from runtime boundaries).
// Keys are generated per test run; no private key is stored anywhere.
import { readFileSync } from 'node:fs';
import { commit } from '@catenor-one/audit';
import { attachProofValue, type DataIntegrityProof } from '@catenor-one/credentials';
import {
  assertionKeyId,
  createDidDocument,
  createVerificationMethod,
  encodeEd25519Multikey,
  parseCatenorDid,
  type DidDocument,
  type KeyManagementReference,
  type VerificationMethod,
} from '@catenor-one/identity';
import { createDecision, policyHash, type Decision } from '@catenor-one/policy';
import { ed25519 } from '@noble/curves/ed25519.js';
import { createAdmissionRecord, type TrustAnchorAdmissionRecord } from './admission-record.js';
import {
  bootstrapConfigurationHash,
  parseBootstrapConfiguration,
  type BootstrapConfiguration,
} from './bootstrap-configuration.js';
import {
  assembleEndorsement,
  buildEndorsementPayload,
  prepareEndorsementProof,
  type BootstrapEndorsement,
} from './endorsement.js';
import type { TrustAnchorVerificationInput } from './trust-anchor-verifier.js';

export const TRUST_DOMAIN = 'trust-domain:catenor-one-demo';
export const CANDIDATE_DID = parseCatenorDid('did:catenor:8f0c92d7e5f04e40a41faee32e5e180b');
export const OTHER_DID = parseCatenorDid('did:catenor:0000000000000000000000000000000b');

export const POLICY: unknown = JSON.parse(
  readFileSync(
    new URL('../../policy/policies/trust-anchor-admission.v1.json', import.meta.url),
    'utf8',
  ),
);

export function newKey() {
  const secretKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(secretKey);
  return { secretKey, publicKey, multikey: encodeEd25519Multikey(publicKey) };
}

export function configFor(bootstrapMultikey: string): BootstrapConfiguration {
  return parseBootstrapConfiguration({
    type: 'CatenorTrustDomainBootstrapConfiguration',
    profile: 'catenor-one/bootstrap-configuration/v1',
    trustDomain: TRUST_DOMAIN,
    admissionPolicy: 'policy:trust-anchor-admission:v1',
    admissionPolicyHash: policyHash(POLICY),
    bootstrapVerificationMethod: 'bootstrap-verification-method:1',
    bootstrapPublicKeyMultibase: bootstrapMultikey,
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
}

export interface Scenario {
  assertionKey: ReturnType<typeof newKey>;
  bootstrapKey: ReturnType<typeof newKey>;
  vm: VerificationMethod;
  document: DidDocument;
  keyReference: KeyManagementReference;
  config: BootstrapConfiguration;
  pin: string;
  decision: Decision;
  decisionRef: string;
  endorsement: BootstrapEndorsement;
  record: TrustAnchorAdmissionRecord;
}

export function signEndorsement(
  config: BootstrapConfiguration,
  payload: Parameters<typeof prepareEndorsementProof>[0],
  secretKey: Uint8Array,
): BootstrapEndorsement {
  const { proofOptions, hashData } = prepareEndorsementProof(
    payload,
    config,
    '2026-09-10T00:00:01Z',
  );
  const proof: DataIntegrityProof = attachProofValue(
    proofOptions,
    ed25519.sign(hashData, secretKey),
  );
  return assembleEndorsement(payload, proof);
}

/** A complete, valid Initial Trust Anchor admission. */
export function happyScenario(): Scenario {
  const assertionKey = newKey();
  const bootstrapKey = newKey();
  const vm = createVerificationMethod(
    assertionKeyId(CANDIDATE_DID, 1),
    CANDIDATE_DID,
    assertionKey.multikey,
  );
  const document = createDidDocument(CANDIDATE_DID, [vm], [vm.id]);
  const keyReference: KeyManagementReference = {
    subject: CANDIDATE_DID,
    verificationMethod: vm.id,
    signerRef: 'signer:fixture:assertion-key-1',
    purpose: 'CREDENTIAL_ASSERTION',
    status: 'ACTIVE',
  };
  const config = configFor(bootstrapKey.multikey);
  const decision = createDecision({
    policy: 'policy:trust-anchor-admission:v1',
    subject: CANDIDATE_DID,
    action: 'ADMIT_TRUST_ANCHOR',
    resource: TRUST_DOMAIN,
    decision: 'ALLOW',
    evaluatedAt: '2026-09-09T22:10:00Z',
    evidenceCommitment: commit({ fixture: 'evidence-commitment-input' }),
  });
  const decisionRef = 'decision:admission:001';
  const payload = buildEndorsementPayload({
    config,
    decision,
    decisionRef,
    verificationMethod: vm,
    endorsementId: 'endorsement:bootstrap:001',
    endorsedAt: '2026-09-10T00:00:00Z',
  });
  const endorsement = signEndorsement(config, payload, bootstrapKey.secretKey);
  const record = createAdmissionRecord(endorsement, '2026-09-10T00:00:02Z');
  return {
    assertionKey,
    bootstrapKey,
    vm,
    document,
    keyReference,
    config,
    pin: bootstrapConfigurationHash(config),
    decision,
    decisionRef,
    endorsement,
    record,
  };
}

export function verifierInput(s: Scenario): TrustAnchorVerificationInput {
  return {
    trustDomain: TRUST_DOMAIN,
    candidate: CANDIDATE_DID,
    pinnedConfigurationHash: s.pin,
    config: s.config,
    policy: POLICY,
    resolution: { status: 'RESOLVED', document: s.document },
    record: s.record,
    decision: s.decision,
    endorsement: s.endorsement,
    status: {
      trustAnchorStatus: 'ACTIVE',
      verificationMethodStatus: 'ACTIVE',
      subjectLifecycle: 'ACTIVE',
    },
  };
}
