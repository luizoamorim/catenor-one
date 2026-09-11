// FAKE signers (TASKS T5.1 "noble fakes") — local development and tests only; labeled "fake" wherever they
// are recorded and never selectable in production configuration. They run the same signer boundary as the
// Privy adapters (PLAN §13.4): structured input → canonical hashData built here → exact-length check →
// Ed25519 sign → verify before returning. Keys live in memory for the process lifetime only.
import { randomBytes } from 'node:crypto';
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
  verifyProof,
  type DataIntegrityProof,
  type ProofOptions,
} from '@catenor-one/credentials';
import { encodeEd25519Multikey } from '@catenor-one/identity';
import { ed25519 } from '@noble/curves/ed25519.js';
import type {
  AssertionSigner,
  BootstrapEndorsementSigner,
} from '../../modules/trust-anchor-admission/application/admission.ports.js';

const FAKE = 'fake';

function signBoundary(hashData: Uint8Array, secretKey: Uint8Array): Uint8Array {
  if (hashData.length !== HASH_DATA_LENGTH) {
    throw new TypeError(`signer boundary: message must be exactly ${HASH_DATA_LENGTH} bytes`);
  }
  const signature = ed25519.sign(hashData, secretKey);
  if (!ed25519.verify(signature, hashData, ed25519.getPublicKey(secretKey), { zip215: false })) {
    throw new Error('signer boundary: signature does not verify');
  }
  return signature;
}

export class FakeAssertionSigner implements AssertionSigner {
  readonly adapter = FAKE;
  private readonly keys = new Map<string, Uint8Array>();

  async createKey(): Promise<{ signerRef: string; publicKeyMultibase: string }> {
    const secretKey = ed25519.utils.randomSecretKey();
    const signerRef = `fake-signer:${randomBytes(8).toString('hex')}`;
    this.keys.set(signerRef, secretKey);
    return {
      signerRef,
      publicKeyMultibase: encodeEd25519Multikey(ed25519.getPublicKey(secretKey)),
    };
  }

  async signKeyPossessionProof(
    signerRef: string,
    input: {
      challenge: KeyPossessionChallenge;
      proofOptions: Omit<ProofOptions, 'type' | 'cryptosuite'>;
    },
  ): Promise<DataIntegrityProof> {
    const secretKey = this.keys.get(signerRef);
    if (secretKey === undefined) throw new Error('unknown signerRef');
    const { proofOptions, hashData } = prepareProof(
      { ...input.challenge },
      { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', ...input.proofOptions },
    );
    return attachProofValue(proofOptions, signBoundary(hashData, secretKey));
  }
}

export class FakeBootstrapEndorsementSigner implements BootstrapEndorsementSigner {
  readonly adapter = FAKE;
  private readonly secretKey = ed25519.utils.randomSecretKey();

  async publicKeyMultibase(): Promise<string> {
    return encodeEd25519Multikey(ed25519.getPublicKey(this.secretKey));
  }

  async signEndorsement(input: {
    payload: BootstrapEndorsementPayload;
    config: BootstrapConfiguration;
    created: string;
  }): Promise<BootstrapEndorsement> {
    if (input.config.bootstrapPublicKeyMultibase !== (await this.publicKeyMultibase())) {
      throw new Error('signer boundary: this key is not the configured Bootstrap Endorsement Key');
    }
    const { proofOptions, hashData } = prepareEndorsementProof(
      input.payload,
      input.config,
      input.created,
    );
    const proof = attachProofValue(proofOptions, signBoundary(hashData, this.secretKey));
    if (!verifyProof({ ...input.payload }, proof, ed25519.getPublicKey(this.secretKey))) {
      throw new Error('signer boundary: endorsement proof does not verify');
    }
    return assembleEndorsement(input.payload, proof);
  }
}
