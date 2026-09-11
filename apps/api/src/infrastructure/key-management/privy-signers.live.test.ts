// T5.2 / T5.3 LIVE test against the Privy DEVELOPMENT app — opt-in: `pnpm test:privy-live`. Skipped unless the
// maintainer has provisioned the signers (apps/api/scripts/privy/provision-s001-signers.mjs) and put the
// values in the git-ignored apps/api/.env. Values are read from the environment and never printed.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { issueChallenge, verifyKeyPossession } from '@catenor-one/authority';
import {
  assertionKeyId,
  createDidDocument,
  createVerificationMethod,
  parseCatenorDid,
} from '@catenor-one/identity';
import { PrivyClient } from '@privy-io/node';
import { describe, expect, it } from 'vitest';
import { PrivyAssertionSigner, privySigningApi } from './privy-signers.js';

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
  const denied = async (call: () => Promise<unknown>) => {
    await expect(call()).rejects.toBeDefined();
  };

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
    await denied(() =>
      client.wallets().exportPrivateKey(key.signerRef, { authorization_context } as never),
    );
    await denied(() =>
      client.wallets().update(key.signerRef, { authorization_context, policy_ids: [] } as never),
    );
    await denied(() =>
      client
        .policies()
        .update(env('PRIVY_ASSERTION_POLICY_ID'), { authorization_context, rules: [] } as never),
    );
  });
});
