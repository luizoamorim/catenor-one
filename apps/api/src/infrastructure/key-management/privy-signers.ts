// Privy Ed25519 signer adapters (TASKS T5.2 / T5.3; PLAN §13, D33, D34, D36). Two separate Privy Solana
// wallets: the Credential Assertion Key and the Bootstrap Endorsement Key — never the same wallet or key.
//
// Custody (D34/D36): each wallet is owned by a management-owner P-256 authorization key that never enters
// the runtime; the runtime holds only that wallet's runtime-signer authorization key (an additional signer
// scoped by P_ASSERT / P_BOOTSTRAP). Creating the assertion wallet needs only PUBLIC values (owner public key,
// runtime-signer key-quorum id, policy id).
//
// Signer boundary (D33, §13.4): structured input → canonical eddsa-jcs-2022 hashData built here → exact
// length check (64 bytes, current profile value) → Privy signMessage over raw bytes → independent Ed25519
// verification before anything is returned. There is no arbitrary-bytes signing method.
import {
  assembleEndorsement,
  prepareEndorsementProof,
  type BootstrapConfiguration,
  type BootstrapEndorsement,
  type BootstrapEndorsementPayload,
  type KeyPossessionChallenge,
} from '@catenor-one/authority';
import {
  HASH_DATA_LENGTH,
  attachProofValue,
  prepareProof,
  type DataIntegrityProof,
  type ProofOptions,
} from '@catenor-one/credentials';
import { encodeEd25519Multikey } from '@catenor-one/identity';
import { ed25519 } from '@noble/curves/ed25519.js';
import type { PrivyClient } from '@privy-io/node';
import { base58 } from '@scure/base';
import type {
  AssertionSigner,
  BootstrapEndorsementSigner,
} from '../../modules/trust-anchor-admission/application/admission.ports.js';

const PRIVY = 'privy';

/** The only Privy operations the S001 runtime uses. */
export interface PrivySigningApi {
  createSolanaWallet(input: {
    ownerPublicKey: string;
    policyId: string;
    runtimeSignerQuorumId: string;
  }): Promise<{ id: string; address: string }>;
  walletAddress(walletId: string): Promise<string>;
  /** Solana signMessage over raw bytes, authorized by a runtime-signer authorization key. */
  signMessage(walletId: string, message: Uint8Array, authorizationKey: string): Promise<Uint8Array>;
}

export function privySigningApi(client: PrivyClient): PrivySigningApi {
  return {
    async createSolanaWallet({ ownerPublicKey, policyId, runtimeSignerQuorumId }) {
      const wallet = await client.wallets().create({
        chain_type: 'solana',
        owner: { public_key: ownerPublicKey },
        policy_ids: [policyId],
        additional_signers: [{ signer_id: runtimeSignerQuorumId, override_policy_ids: [policyId] }],
      });
      return { id: wallet.id, address: wallet.address };
    },
    async walletAddress(walletId) {
      return (await client.wallets().get(walletId)).address;
    },
    async signMessage(walletId, message, authorizationKey) {
      const { signature, encoding } = await client
        .wallets()
        .solana()
        .signMessage(walletId, {
          message,
          authorization_context: { authorization_private_keys: [authorizationKey] },
        });
      if (encoding !== 'base64') throw new Error(`unexpected Privy signature encoding ${encoding}`);
      return new Uint8Array(Buffer.from(signature, 'base64'));
    },
  };
}

/** Solana wallet address = base58 of the raw 32-byte Ed25519 public key (T0.5 F2). */
function publicKeyOf(address: string): Uint8Array {
  const key = base58.decode(address);
  if (key.length !== 32) throw new Error('Privy wallet address is not a 32-byte Ed25519 key');
  return key;
}

/** The signer boundary shared by both wallets. */
async function boundarySign(
  api: PrivySigningApi,
  walletId: string,
  authorizationKey: string,
  hashData: Uint8Array,
  publicKey: Uint8Array,
): Promise<Uint8Array> {
  if (hashData.length !== HASH_DATA_LENGTH) {
    throw new TypeError(`signer boundary: message must be exactly ${HASH_DATA_LENGTH} bytes`);
  }
  const signature = await api.signMessage(walletId, hashData, authorizationKey);
  if (
    signature.length !== 64 ||
    !ed25519.verify(signature, hashData, publicKey, { zip215: false })
  ) {
    throw new Error('signer boundary: Privy signature does not verify for this wallet');
  }
  return signature;
}

export interface PrivyAssertionSignerConfig {
  /** Management-owner authorization key — PUBLIC part only (SPKI DER, base64). */
  readonly ownerPublicKey: string;
  /** Key quorum holding the runtime-signer authorization public key. */
  readonly runtimeSignerQuorumId: string;
  /** P_ASSERT: ALLOW signMessage; DENY exportPrivateKey / exportSeedPhrase; default deny. */
  readonly policyId: string;
  /** Runtime-signer authorization private key (PKCS#8 DER, base64) — Railway sealed variable. */
  readonly runtimeAuthorizationKey: string;
}

export class PrivyAssertionSigner implements AssertionSigner {
  readonly adapter = PRIVY;

  constructor(
    private readonly api: PrivySigningApi,
    private readonly config: PrivyAssertionSignerConfig,
  ) {}

  async createKey(): Promise<{ signerRef: string; publicKeyMultibase: string }> {
    const wallet = await this.api.createSolanaWallet(this.config);
    return {
      signerRef: wallet.id,
      publicKeyMultibase: encodeEd25519Multikey(publicKeyOf(wallet.address)),
    };
  }

  async signKeyPossessionProof(
    signerRef: string,
    input: {
      challenge: KeyPossessionChallenge;
      proofOptions: Omit<ProofOptions, 'type' | 'cryptosuite'>;
    },
  ): Promise<DataIntegrityProof> {
    const { proofOptions, hashData } = prepareProof(
      { ...input.challenge },
      { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', ...input.proofOptions },
    );
    const publicKey = publicKeyOf(await this.api.walletAddress(signerRef));
    const signature = await boundarySign(
      this.api,
      signerRef,
      this.config.runtimeAuthorizationKey,
      hashData,
      publicKey,
    );
    return attachProofValue(proofOptions, signature);
  }
}

export interface PrivyBootstrapSignerConfig {
  /** The separate Bootstrap Endorsement Key wallet (created by the maintainer's setup script). */
  readonly walletId: string;
  /** Its runtime-signer authorization private key (PKCS#8 DER, base64) — Railway sealed variable. */
  readonly runtimeAuthorizationKey: string;
}

export class PrivyBootstrapEndorsementSigner implements BootstrapEndorsementSigner {
  readonly adapter = PRIVY;

  constructor(
    private readonly api: PrivySigningApi,
    private readonly config: PrivyBootstrapSignerConfig,
  ) {}

  async publicKeyMultibase(): Promise<string> {
    return encodeEd25519Multikey(publicKeyOf(await this.api.walletAddress(this.config.walletId)));
  }

  async signEndorsement(input: {
    payload: BootstrapEndorsementPayload;
    config: BootstrapConfiguration;
    created: string;
  }): Promise<BootstrapEndorsement> {
    const address = await this.api.walletAddress(this.config.walletId);
    const publicKey = publicKeyOf(address);
    if (encodeEd25519Multikey(publicKey) !== input.config.bootstrapPublicKeyMultibase) {
      throw new Error(
        'signer boundary: this wallet is not the configured Bootstrap Endorsement Key',
      );
    }
    const { proofOptions, hashData } = prepareEndorsementProof(
      input.payload,
      input.config,
      input.created,
    );
    const signature = await boundarySign(
      this.api,
      this.config.walletId,
      this.config.runtimeAuthorizationKey,
      hashData,
      publicKey,
    );
    return assembleEndorsement(input.payload, attachProofValue(proofOptions, signature));
  }
}
