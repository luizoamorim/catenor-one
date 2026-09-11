// Signer-boundary unit tests for the Privy adapters (no network): a fake PrivySigningApi stands in for Privy
// with local Ed25519 keys. Live Privy behavior (policy denials, runtime-signer limits) is T5.2's live test.
import {
  bootstrapConfigurationHash,
  buildEndorsementPayload,
  issueChallenge,
  parseBootstrapConfiguration,
  verifyEndorsement,
  verifyKeyPossession,
} from '@catenor-one/authority';
import { createDecision, policyHash } from '@catenor-one/policy';
import {
  assertionKeyId,
  createDidDocument,
  createVerificationMethod,
  encodeEd25519Multikey,
  parseCatenorDid,
} from '@catenor-one/identity';
import { ed25519 } from '@noble/curves/ed25519.js';
import { base58 } from '@scure/base';
import { describe, expect, it } from 'vitest';
import { packagedAdmissionPolicy } from '../runtime/runtime-adapters.js';
import {
  PrivyAssertionSigner,
  PrivyBootstrapEndorsementSigner,
  type PrivySigningApi,
} from './privy-signers.js';

const DID = parseCatenorDid('did:catenor:8f0c92d7e5f04e40a41faee32e5e180b');
const TD = 'trust-domain:catenor-one-demo';

/** In-memory stand-in for Privy: wallets are local Ed25519 keys; records every call. */
function fakePrivy(options: { tamper?: boolean } = {}) {
  const wallets = new Map<string, Uint8Array>();
  const calls: { method: string; args: unknown[] }[] = [];
  const api: PrivySigningApi = {
    async createSolanaWallet(input) {
      calls.push({ method: 'createSolanaWallet', args: [input] });
      const secret = ed25519.utils.randomSecretKey();
      const id = `wallet-${wallets.size + 1}`;
      wallets.set(id, secret);
      return { id, address: base58.encode(ed25519.getPublicKey(secret)) };
    },
    async walletAddress(walletId) {
      return base58.encode(ed25519.getPublicKey(wallets.get(walletId)!));
    },
    async signMessage(walletId, message, authorizationKey) {
      calls.push({ method: 'signMessage', args: [walletId, message, authorizationKey] });
      const signature = ed25519.sign(message, wallets.get(walletId)!);
      if (options.tamper) signature[0] = (signature[0] ?? 0) ^ 1;
      return signature;
    },
  };
  return { api, calls, wallets };
}

const assertionConfig = {
  ownerPublicKey: 'MANAGEMENT-OWNER-PUBLIC-KEY-SPKI-BASE64',
  runtimeSignerQuorumId: 'quorum-assertion-runtime',
  policyId: 'policy-p-assert',
  runtimeAuthorizationKey: 'runtime-assertion-key-placeholder',
};

describe('PrivyAssertionSigner — signer boundary', () => {
  it('creates the wallet from public values only and derives the Multikey from the address', async () => {
    const privy = fakePrivy();
    const signer = new PrivyAssertionSigner(privy.api, assertionConfig);
    const key = await signer.createKey();
    expect(privy.calls[0]).toEqual({
      method: 'createSolanaWallet',
      args: [assertionConfig],
    });
    expect(key.signerRef).toBe('wallet-1');
    expect(key.publicKeyMultibase).toBe(
      encodeEd25519Multikey(ed25519.getPublicKey(privy.wallets.get('wallet-1')!)),
    );
  });

  it('signs the eddsa-jcs-2022 key-possession proof over exactly 64 bytes with the runtime key; it verifies', async () => {
    const privy = fakePrivy();
    const signer = new PrivyAssertionSigner(privy.api, assertionConfig);
    const key = await signer.createKey();
    const vm = createVerificationMethod(assertionKeyId(DID, 1), DID, key.publicKeyMultibase);
    const record = issueChallenge({
      challengeId: 'challenge:1',
      subject: DID,
      verificationMethod: vm.id,
      trustDomain: TD,
      nonce: Buffer.alloc(32, 3).toString('base64url'),
      issuedAt: new Date('2026-09-11T00:00:00Z'),
    });
    const proof = await signer.signKeyPossessionProof(key.signerRef, {
      challenge: record.challenge,
      proofOptions: {
        verificationMethod: vm.id,
        proofPurpose: 'assertionMethod',
        created: '2026-09-11T00:01:00Z',
        challenge: record.challenge.nonce,
        domain: TD,
      },
    });
    const sign = privy.calls.find((c) => c.method === 'signMessage')!;
    expect(sign.args[1]).toBeInstanceOf(Uint8Array);
    expect((sign.args[1] as Uint8Array).length).toBe(64);
    expect(sign.args[2]).toBe(assertionConfig.runtimeAuthorizationKey);
    const result = verifyKeyPossession({
      record,
      requestedSubject: DID,
      trustDomain: TD,
      didDocument: createDidDocument(DID, [vm], [vm.id]),
      keyReference: {
        subject: DID,
        verificationMethod: vm.id,
        signerRef: key.signerRef,
        purpose: 'CREDENTIAL_ASSERTION',
        status: 'ACTIVE',
      },
      proof,
      now: new Date('2026-09-11T00:02:00Z'),
    });
    expect(result).toMatchObject({ possessionValid: true, purposeValid: true });
  });

  it('refuses a signature that does not verify for the wallet (fail closed)', async () => {
    const privy = fakePrivy({ tamper: true });
    const signer = new PrivyAssertionSigner(privy.api, assertionConfig);
    const key = await signer.createKey();
    const record = issueChallenge({
      challengeId: 'challenge:2',
      subject: DID,
      verificationMethod: assertionKeyId(DID, 1),
      trustDomain: TD,
      nonce: Buffer.alloc(32, 4).toString('base64url'),
      issuedAt: new Date(),
    });
    await expect(
      signer.signKeyPossessionProof(key.signerRef, {
        challenge: record.challenge,
        proofOptions: {
          verificationMethod: assertionKeyId(DID, 1),
          proofPurpose: 'assertionMethod',
          created: '2026-09-11T00:01:00Z',
          challenge: record.challenge.nonce,
          domain: TD,
        },
      }),
    ).rejects.toThrow('does not verify');
  });
});

describe('PrivyBootstrapEndorsementSigner — separate wallet', () => {
  async function setup() {
    const privy = fakePrivy();
    const bootstrapWallet = await privy.api.createSolanaWallet({
      ownerPublicKey: 'BOOTSTRAP-MANAGEMENT-OWNER',
      policyId: 'policy-p-bootstrap',
      runtimeSignerQuorumId: 'quorum-bootstrap-runtime',
    });
    const signer = new PrivyBootstrapEndorsementSigner(privy.api, {
      walletId: bootstrapWallet.id,
      runtimeAuthorizationKey: 'runtime-bootstrap-key-placeholder',
    });
    const raw = {
      type: 'CatenorTrustDomainBootstrapConfiguration',
      profile: 'catenor-one/bootstrap-configuration/v1',
      trustDomain: TD,
      admissionPolicy: 'policy:trust-anchor-admission:v1',
      admissionPolicyHash: policyHash(packagedAdmissionPolicy.load()),
      bootstrapVerificationMethod: 'bootstrap-verification-method:1',
      bootstrapPublicKeyMultibase: await signer.publicKeyMultibase(),
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
    const config = parseBootstrapConfiguration(raw);
    const assertionKey = ed25519.utils.randomSecretKey();
    const vm = createVerificationMethod(
      assertionKeyId(DID, 1),
      DID,
      encodeEd25519Multikey(ed25519.getPublicKey(assertionKey)),
    );
    const decision = createDecision({
      policy: config.admissionPolicy,
      subject: DID,
      action: 'ADMIT_TRUST_ANCHOR',
      resource: TD,
      decision: 'ALLOW',
      evaluatedAt: '2026-09-11T00:00:00Z',
      evidenceCommitment: `0x${'e'.repeat(64)}` as never,
    });
    const payload = buildEndorsementPayload({
      config,
      decision,
      decisionRef: 'decision:1',
      verificationMethod: vm,
      endorsementId: 'endorsement:1',
      endorsedAt: '2026-09-11T00:10:00Z',
    });
    return { privy, signer, config, vm, decision, payload };
  }

  it('signs the endorsement with the bootstrap runtime key; verifyEndorsement accepts it', async () => {
    const { privy, signer, config, vm, decision, payload } = await setup();
    const endorsement = await signer.signEndorsement({
      payload,
      config,
      created: '2026-09-11T00:10:01Z',
    });
    expect(privy.calls.at(-1)?.args[2]).toBe('runtime-bootstrap-key-placeholder');
    expect(
      verifyEndorsement(endorsement, {
        config,
        candidate: DID,
        verificationMethod: vm,
        decision,
        decisionRef: 'decision:1',
        policyHash: config.admissionPolicyHash,
        evidenceCommitment: decision.evidenceCommitment,
      }),
    ).toEqual({ valid: true, failures: [] });
    expect(bootstrapConfigurationHash(config)).toBe(endorsement.bootstrapConfigurationHash);
  });

  it('refuses to sign when its wallet is not the configured Bootstrap Endorsement Key — before calling Privy', async () => {
    const { privy, config, payload } = await setup();
    const otherWallet = await privy.api.createSolanaWallet({
      ownerPublicKey: 'x',
      policyId: 'y',
      runtimeSignerQuorumId: 'z',
    });
    const wrong = new PrivyBootstrapEndorsementSigner(privy.api, {
      walletId: otherWallet.id,
      runtimeAuthorizationKey: 'k',
    });
    const signCalls = privy.calls.filter((c) => c.method === 'signMessage').length;
    await expect(
      wrong.signEndorsement({ payload, config, created: '2026-09-11T00:10:01Z' }),
    ).rejects.toThrow('not the configured Bootstrap Endorsement Key');
    expect(privy.calls.filter((c) => c.method === 'signMessage')).toHaveLength(signCalls);
  });
});
