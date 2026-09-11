// T5.2 / T5.3 LIVE test against the Privy DEVELOPMENT app — opt-in: `pnpm test:privy-live`. Skipped unless the
// maintainer has provisioned the signers (apps/api/scripts/privy/provision-s001-signers.mjs) and put the
// values in the git-ignored apps/api/.env. Values are read from the environment and never printed.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
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
  parseCatenorDid,
} from '@catenor-one/identity';
import { PrivyClient } from '@privy-io/node';
import { afterAll, describe, expect, it } from 'vitest';
import { packagedAdmissionPolicy } from '../runtime/runtime-adapters.js';
import {
  PrivyAssertionSigner,
  PrivyBootstrapEndorsementSigner,
  privySigningApi,
} from './privy-signers.js';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const env = (name: string) => process.env[name] ?? '';
const REQUIRED = [
  'PRIVY_APP_ID',
  'PRIVY_APP_SECRET',
  'PRIVY_ASSERTION_OWNER_PUBLIC_KEY',
  'PRIVY_ASSERTION_RUNTIME_QUORUM_ID',
  'PRIVY_ASSERTION_POLICY_ID',
  'CATENOR_ASSERTION_RUNTIME_AUTHORIZATION_KEY',
];
const configured = REQUIRED.every((name) => env(name) !== '');

const DID = parseCatenorDid('did:catenor:00000000000000000000000000000c01');
const TD = 'trust-domain:catenor-one-demo';

describe.skipIf(!configured)('LIVE Privy Credential Assertion Key (T5.2)', () => {
  const client = new PrivyClient({
    appId: env('PRIVY_APP_ID'),
    appSecret: env('PRIVY_APP_SECRET'),
  });
  const runtimeKey = env('CATENOR_ASSERTION_RUNTIME_AUTHORIZATION_KEY');
  const signer = new PrivyAssertionSigner(privySigningApi(client), {
    ownerPublicKey: env('PRIVY_ASSERTION_OWNER_PUBLIC_KEY'),
    runtimeSignerQuorumId: env('PRIVY_ASSERTION_RUNTIME_QUORUM_ID'),
    policyId: env('PRIVY_ASSERTION_POLICY_ID'),
    runtimeAuthorizationKey: runtimeKey,
  });
  /** Records a denial as {status, code} only (no bodies, no ids) and requires an authorization/policy denial. */
  const denied = async (label: string, call: () => Promise<unknown>) => {
    try {
      await call();
    } catch (error) {
      const e = error as { status?: number; error?: { code?: string } };
      const outcome = { label, status: e.status ?? null, code: e.error?.code ?? null };
      denials.push(outcome);
      expect(outcome.status, JSON.stringify(outcome)).toBeOneOf([401, 403]);
      return;
    }
    throw new Error(`${label}: NOT DENIED`);
  };
  const denials: { label: string; status: number | null; code: string | null }[] = [];
  afterAll(() => {
    // Sanitized evidence for the artifact (statuses and error codes only).
    console.info(`PRIVY_DENIALS ${JSON.stringify(denials)}`);
  });

  it('creates the wallet, signs an eddsa-jcs-2022 key-possession proof via Privy, and it verifies (TV-D01)', async () => {
    const key = await signer.createKey();
    const vm = createVerificationMethod(assertionKeyId(DID, 1), DID, key.publicKeyMultibase);
    const record = issueChallenge({
      challengeId: 'challenge:live',
      subject: DID,
      verificationMethod: vm.id,
      trustDomain: TD,
      nonce: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),
      issuedAt: new Date(),
    });
    const proof = await signer.signKeyPossessionProof(key.signerRef, {
      challenge: record.challenge,
      proofOptions: {
        verificationMethod: vm.id,
        proofPurpose: 'assertionMethod',
        created: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        challenge: record.challenge.nonce,
        domain: TD,
      },
    });
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
      now: new Date(),
    });
    expect(result).toMatchObject({ possessionValid: true, purposeValid: true });

    // D34: the runtime-signer authorization key cannot export, re-policy or re-own the wallet.
    const authorization_context = { authorization_private_keys: [runtimeKey] };
    await denied('assertion runtime key → exportPrivateKey', () =>
      client.wallets().exportPrivateKey(key.signerRef, { authorization_context } as never),
    );
    await denied('assertion runtime key → wallet update (remove policy)', () =>
      client.wallets().update(key.signerRef, { authorization_context, policy_ids: [] } as never),
    );
    await denied('assertion runtime key → change owner', () =>
      client.wallets().update(key.signerRef, {
        authorization_context,
        owner: { public_key: env('PRIVY_ASSERTION_OWNER_PUBLIC_KEY') },
      } as never),
    );
    await denied('assertion runtime key → remove additional signers', () =>
      client
        .wallets()
        .update(key.signerRef, { authorization_context, additional_signers: [] } as never),
    );
    await denied('assertion runtime key → policy update', () =>
      client
        .policies()
        .update(env('PRIVY_ASSERTION_POLICY_ID'), { authorization_context, rules: [] } as never),
    );
  });
});

const BOOTSTRAP_REQUIRED = [
  ...REQUIRED,
  'PRIVY_BOOTSTRAP_WALLET_ID',
  'CATENOR_BOOTSTRAP_RUNTIME_AUTHORIZATION_KEY',
];
const bootstrapConfigured = BOOTSTRAP_REQUIRED.every((name) => env(name) !== '');

describe.skipIf(!bootstrapConfigured)('LIVE Privy Bootstrap Endorsement Key (T5.3, D36)', () => {
  const client = new PrivyClient({
    appId: env('PRIVY_APP_ID'),
    appSecret: env('PRIVY_APP_SECRET'),
  });
  const api = privySigningApi(client);
  const bootstrapKey = env('CATENOR_BOOTSTRAP_RUNTIME_AUTHORIZATION_KEY');
  const assertionKey = env('CATENOR_ASSERTION_RUNTIME_AUTHORIZATION_KEY');
  const bootstrap = new PrivyBootstrapEndorsementSigner(api, {
    walletId: env('PRIVY_BOOTSTRAP_WALLET_ID'),
    runtimeAuthorizationKey: bootstrapKey,
  });
  const assertion = new PrivyAssertionSigner(api, {
    ownerPublicKey: env('PRIVY_ASSERTION_OWNER_PUBLIC_KEY'),
    runtimeSignerQuorumId: env('PRIVY_ASSERTION_RUNTIME_QUORUM_ID'),
    policyId: env('PRIVY_ASSERTION_POLICY_ID'),
    runtimeAuthorizationKey: assertionKey,
  });

  it('signs a bootstrap endorsement through the separate wallet; verifyEndorsement accepts it', async () => {
    const multikey = await bootstrap.publicKeyMultibase();
    const assertionWallet = await assertion.createKey();
    expect(assertionWallet.publicKeyMultibase).not.toBe(multikey);
    const config = parseBootstrapConfiguration({
      type: 'CatenorTrustDomainBootstrapConfiguration',
      profile: 'catenor-one/bootstrap-configuration/v1',
      trustDomain: TD,
      admissionPolicy: 'policy:trust-anchor-admission:v1',
      admissionPolicyHash: policyHash(packagedAdmissionPolicy.load()),
      bootstrapVerificationMethod: 'bootstrap-verification-method:1',
      bootstrapPublicKeyMultibase: multikey,
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
    const vm = createVerificationMethod(
      assertionKeyId(DID, 1),
      DID,
      assertionWallet.publicKeyMultibase,
    );
    const decision = createDecision({
      policy: config.admissionPolicy,
      subject: DID,
      action: 'ADMIT_TRUST_ANCHOR',
      resource: TD,
      decision: 'ALLOW',
      evaluatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      evidenceCommitment: `0x${'e'.repeat(64)}` as never,
    });
    const payload = buildEndorsementPayload({
      config,
      decision,
      decisionRef: 'decision:live',
      verificationMethod: vm,
      endorsementId: 'endorsement:live',
      endorsedAt: decision.evaluatedAt,
    });
    const endorsement = await bootstrap.signEndorsement({
      payload,
      config,
      created: decision.evaluatedAt,
    });
    expect(
      verifyEndorsement(endorsement, {
        config,
        candidate: DID,
        verificationMethod: vm,
        decision,
        decisionRef: 'decision:live',
        policyHash: config.admissionPolicyHash,
        evidenceCommitment: decision.evidenceCommitment,
      }),
    ).toEqual({ valid: true, failures: [] });

    // D36 key separation: neither runtime-signer key can sign with the other wallet.
    const message = new Uint8Array(64).fill(7);
    await expect(
      api.signMessage(assertionWallet.signerRef, message, bootstrapKey),
    ).rejects.toMatchObject({ status: expect.toBeOneOf([401, 403]) });
    await expect(
      api.signMessage(env('PRIVY_BOOTSTRAP_WALLET_ID'), message, assertionKey),
    ).rejects.toMatchObject({ status: expect.toBeOneOf([401, 403]) });
  });
});
