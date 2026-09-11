// Chooses the S001 signers from the environment: the REAL Privy adapters when the maintainer-provisioned values are
// present (TASKS T0.4 / T5.2 / T5.3), otherwise the labeled FAKE noble signers (local development and tests only).
import { PrivyClient } from '@privy-io/node';
import type {
  AssertionSigner,
  BootstrapEndorsementSigner,
} from '../../modules/trust-anchor-admission/application/admission.ports.js';
import { FakeAssertionSigner, FakeBootstrapEndorsementSigner } from './fake-signers.js';
import {
  PrivyAssertionSigner,
  PrivyBootstrapEndorsementSigner,
  privySigningApi,
} from './privy-signers.js';

export const PRIVY_SIGNER_ENV = [
  'PRIVY_APP_ID',
  'PRIVY_APP_SECRET',
  'PRIVY_ASSERTION_OWNER_PUBLIC_KEY',
  'PRIVY_ASSERTION_RUNTIME_QUORUM_ID',
  'PRIVY_ASSERTION_POLICY_ID',
  'CATENOR_ASSERTION_RUNTIME_AUTHORIZATION_KEY',
  'PRIVY_BOOTSTRAP_WALLET_ID',
  'CATENOR_BOOTSTRAP_RUNTIME_AUTHORIZATION_KEY',
] as const;

export interface SelectedSigners {
  readonly kind: 'PRIVY' | 'FAKE';
  readonly assertionSigner: AssertionSigner;
  readonly bootstrapSigner: BootstrapEndorsementSigner;
}

export function selectSigners(env: NodeJS.ProcessEnv = process.env): SelectedSigners {
  const value = (name: (typeof PRIVY_SIGNER_ENV)[number]) => env[name] ?? '';
  if (!PRIVY_SIGNER_ENV.every((name) => value(name) !== '')) {
    return {
      kind: 'FAKE',
      assertionSigner: new FakeAssertionSigner(),
      bootstrapSigner: new FakeBootstrapEndorsementSigner(),
    };
  }
  const api = privySigningApi(
    new PrivyClient({ appId: value('PRIVY_APP_ID'), appSecret: value('PRIVY_APP_SECRET') }),
  );
  return {
    kind: 'PRIVY',
    assertionSigner: new PrivyAssertionSigner(api, {
      ownerPublicKey: value('PRIVY_ASSERTION_OWNER_PUBLIC_KEY'),
      runtimeSignerQuorumId: value('PRIVY_ASSERTION_RUNTIME_QUORUM_ID'),
      policyId: value('PRIVY_ASSERTION_POLICY_ID'),
      runtimeAuthorizationKey: value('CATENOR_ASSERTION_RUNTIME_AUTHORIZATION_KEY'),
    }),
    bootstrapSigner: new PrivyBootstrapEndorsementSigner(api, {
      walletId: value('PRIVY_BOOTSTRAP_WALLET_ID'),
      runtimeAuthorizationKey: value('CATENOR_BOOTSTRAP_RUNTIME_AUTHORIZATION_KEY'),
    }),
  };
}
