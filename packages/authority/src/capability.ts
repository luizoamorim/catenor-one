import { verifyProof, type DataIntegrityProof, type ProofOptions } from '@catenor-one/credentials';
import { prepareProof } from '@catenor-one/credentials';
import {
  authorizesAssertion,
  decodeEd25519Multikey,
  findVerificationMethod,
  type DidDocument,
} from '@catenor-one/identity';

/**
 * Catenor One [REF-IMPL] hackathon demo vocabulary — NOT frozen Catenor Protocol vocabulary (the protocol's Action
 * vocabulary and Constraint grammar are open in Draft v0.1, specification/authority/02-CAPABILITIES.md §6).
 */
export const TOKENIZE_ASSET = 'TOKENIZE_ASSET';
/** Final demo: the Distribution Agent may execute the distribution of an SPV asset (Catenor One [REF-IMPL]). */
export const EXECUTE_DISTRIBUTION = 'EXECUTE_DISTRIBUTION';
/** Clean-room demo Sponsor capabilities (Catenor One [REF-IMPL]; the protocol Action vocabulary is open). */
export const DEFINE_OFFERING_POLICY = 'DEFINE_OFFERING_POLICY';
export const CREATE_AGENT = 'CREATE_AGENT';
export const CREATE_DISTRIBUTION = 'CREATE_DISTRIBUTION';
export const DELEGATE_DISTRIBUTION_AUTHORITY = 'DELEGATE_DISTRIBUTION_AUTHORITY';
/** The five capabilities the Trust Anchor grants the Sponsor in the clean-room demo. */
export const SPONSOR_CAPABILITIES = [
  TOKENIZE_ASSET,
  DEFINE_OFFERING_POLICY,
  CREATE_AGENT,
  CREATE_DISTRIBUTION,
  DELEGATE_DISTRIBUTION_AUTHORITY,
] as const;

/**
 * Explicit delegability [REF-IMPL] (protocol: "Delegability must be explicit", "delegated authority ⊆ delegator
 * authority"). A delegated action is valid only when the delegator holds BOTH the authority it derives from and the
 * explicit permission to delegate it, on the same resource. Only EXECUTE_DISTRIBUTION is delegable; depth 1 below
 * the Trust Anchor's grant.
 */
export const DELEGABLE_ACTIONS: Readonly<
  Record<string, { readonly derivesFrom: string; readonly permission: string }>
> = {
  [EXECUTE_DISTRIBUTION]: {
    derivesFrom: CREATE_DISTRIBUTION,
    permission: DELEGATE_DISTRIBUTION_AUTHORITY,
  },
};

/** Protocol Capability working shape exactly (`capability.schema.json`: these four fields, nothing else). */
export interface Capability {
  readonly subject: string;
  readonly action: string;
  readonly resource: string;
  readonly constraints: { readonly validUntil: string };
}

/**
 * [REF-IMPL] envelope: an issuer grants one protocol-shaped Capability. Relationship ≠ Capability — nothing here is
 * inferred from a relationship; the grant is explicit and signed by the issuer's Credential Assertion Key.
 */
export interface CapabilityGrantPayload {
  readonly type: 'CatenorOneCapabilityGrant';
  readonly id: string;
  readonly issuer: string;
  readonly issuedAt: string;
  readonly capability: Capability;
}

export interface CapabilityGrant extends CapabilityGrantPayload {
  readonly proof: DataIntegrityProof;
}

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

export function createCapabilityGrant(input: {
  id: string;
  issuer: string;
  subject: string;
  action: string;
  resource: string;
  validUntil: string;
  issuedAt: string;
}): CapabilityGrantPayload {
  if (!RFC3339.test(input.validUntil) || !RFC3339.test(input.issuedAt)) {
    throw new TypeError('validUntil and issuedAt must be RFC 3339 date-times');
  }
  if (Date.parse(input.validUntil) <= Date.parse(input.issuedAt)) {
    throw new TypeError('validUntil must be after issuedAt');
  }
  if (input.issuer === input.subject) throw new TypeError('a grant needs a distinct subject');
  return {
    type: 'CatenorOneCapabilityGrant',
    id: input.id,
    issuer: input.issuer,
    issuedAt: input.issuedAt,
    capability: {
      subject: input.subject,
      action: input.action,
      resource: input.resource,
      constraints: { validUntil: input.validUntil },
    },
  };
}

/** eddsa-jcs-2022 proof options for the grant; the signer boundary signs the returned hashData. */
export function prepareCapabilityGrantProof(
  payload: CapabilityGrantPayload,
  verificationMethod: string,
  created: string,
): { proofOptions: ProofOptions; hashData: Uint8Array } {
  return prepareProof(
    { ...payload },
    {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod,
      proofPurpose: 'assertionMethod',
      created,
    },
  );
}

export type CapabilityDenialReason =
  | 'CAPABILITY_MISSING'
  | 'CAPABILITY_MALFORMED'
  | 'ISSUER_NOT_ACTIVE_TRUST_ANCHOR'
  | 'ISSUER_KEY_NOT_ASSERTION_METHOD'
  | 'SIGNATURE_INVALID'
  | 'SUBJECT_MISMATCH'
  | 'ACTION_MISMATCH'
  | 'RESOURCE_MISMATCH'
  | 'EXPIRED'
  // Delegated authority (Sponsor → Agent) [REF-IMPL]:
  | 'ACTION_NOT_DELEGABLE'
  | 'DELEGATOR_LACKS_AUTHORITY'
  | 'DELEGATION_NOT_PERMITTED'
  | 'DELEGATION_EXCEEDS_DELEGATOR';

export interface CapabilityAuthorization {
  readonly decision: 'ALLOW' | 'DENY';
  readonly reasons: readonly CapabilityDenialReason[];
}

/**
 * Authorizes one requested action against a capability grant (fail closed; every failing check is reported):
 * signature by the issuer's assertion key, issuer currently an ACTIVE Trust Anchor, subject = requester, action,
 * resource, not expired.
 */
export function authorizeWithCapability(input: {
  readonly grant: CapabilityGrant | undefined;
  /** Resolved public DID Document of the grant issuer. */
  readonly issuerDocument: DidDocument | undefined;
  /** Result of Trust Anchor verification of the issuer at request time (S001 verifier). */
  readonly issuerIsActiveTrustAnchor: boolean;
  readonly request: {
    readonly requester: string;
    readonly action: string;
    readonly resource: string;
  };
  readonly now: Date;
}): CapabilityAuthorization {
  const reasons = grantReasons(input, !input.issuerIsActiveTrustAnchor);
  return { decision: reasons.length === 0 ? 'ALLOW' : 'DENY', reasons };
}

/** Grant checks shared by direct and delegated authorization (the issuer-trust check is the caller's). */
function grantReasons(
  input: {
    readonly grant: CapabilityGrant | undefined;
    readonly issuerDocument: DidDocument | undefined;
    readonly request: {
      readonly requester: string;
      readonly action: string;
      readonly resource: string;
    };
    readonly now: Date;
  },
  issuerNotActiveTrustAnchor: boolean,
): CapabilityDenialReason[] {
  const { grant, request } = input;
  if (grant === undefined) return ['CAPABILITY_MISSING'];
  const c = grant.capability;
  if (
    grant.type !== 'CatenorOneCapabilityGrant' ||
    typeof c?.subject !== 'string' ||
    typeof c.constraints?.validUntil !== 'string' ||
    !grant.proof
  ) {
    return ['CAPABILITY_MALFORMED'];
  }
  const reasons: CapabilityDenialReason[] = [];
  if (issuerNotActiveTrustAnchor) reasons.push('ISSUER_NOT_ACTIVE_TRUST_ANCHOR');

  const vmId = grant.proof.verificationMethod;
  const vm = input.issuerDocument && findVerificationMethod(input.issuerDocument, vmId);
  if (
    vm === undefined ||
    input.issuerDocument?.id !== grant.issuer ||
    !authorizesAssertion(input.issuerDocument, vmId)
  ) {
    reasons.push('ISSUER_KEY_NOT_ASSERTION_METHOD');
  } else {
    const { proof, ...payload } = grant;
    let valid: boolean;
    try {
      valid = verifyProof({ ...payload }, proof, decodeEd25519Multikey(vm.publicKeyMultibase));
    } catch {
      valid = false;
    }
    if (!valid) reasons.push('SIGNATURE_INVALID');
  }
  if (c.subject !== request.requester) reasons.push('SUBJECT_MISMATCH');
  if (c.action !== request.action) reasons.push('ACTION_MISMATCH');
  if (c.resource !== request.resource) reasons.push('RESOURCE_MISMATCH');
  const until = Date.parse(c.constraints.validUntil);
  if (Number.isNaN(until) || input.now.getTime() > until) reasons.push('EXPIRED');
  return reasons;
}

/** One verified edge of an Authority Chain, for explanation (issuer → subject: action on resource). */
export interface AuthorityChainEdge {
  readonly grantId: string;
  readonly issuer: string;
  readonly subject: string;
  readonly action: string;
  readonly resource: string;
  readonly validUntil: string;
}

export interface DelegatedAuthorization extends CapabilityAuthorization {
  /** Root → leaf edges that were verified (present only on ALLOW). */
  readonly chain?: readonly AuthorityChainEdge[];
}

const edge = (g: CapabilityGrant): AuthorityChainEdge => ({
  grantId: g.id,
  issuer: g.issuer,
  subject: g.capability.subject,
  action: g.capability.action,
  resource: g.capability.resource,
  validUntil: g.capability.constraints.validUntil,
});

/**
 * Authorizes a request made under a DELEGATED grant (Catenor One [REF-IMPL], chain depth 2; fail closed):
 *
 *   ACTIVE Trust Anchor ──grants──▶ delegator: `derivesFrom` + `permission` on the resource
 *   delegator ──delegates──▶ requester: the delegable action on the same resource
 *
 * Every edge is checked: signatures by the issuers' assertion keys, the root is an ACTIVE Trust Anchor, subjects,
 * actions, resources, expiry; the action is explicitly delegable; the delegator holds both parent grants; the
 * delegation was issued while both were valid and does not outlive them.
 */
export function authorizeDelegatedCapability(input: {
  /** The delegated grant (e.g. Sponsor → Agent). */
  readonly grant: CapabilityGrant | undefined;
  readonly delegatorDocument: DidDocument | undefined;
  /** The Trust Anchor's grants to the delegator, as presented with the request. */
  readonly parentGrants: readonly CapabilityGrant[];
  readonly rootDocument: DidDocument | undefined;
  /** S001 Trust Anchor verification of the parents' issuer at request time. */
  readonly rootIsActiveTrustAnchor: boolean;
  readonly request: {
    readonly requester: string;
    readonly action: string;
    readonly resource: string;
  };
  readonly now: Date;
}): DelegatedAuthorization {
  const leaf = input.grant;
  const reasons = grantReasons(
    {
      grant: leaf,
      issuerDocument: input.delegatorDocument,
      request: input.request,
      now: input.now,
    },
    false,
  );
  if (leaf === undefined || reasons.includes('CAPABILITY_MALFORMED')) {
    return { decision: 'DENY', reasons };
  }
  const rule = DELEGABLE_ACTIONS[leaf.capability.action];
  if (rule === undefined) {
    reasons.push('ACTION_NOT_DELEGABLE');
    return { decision: 'DENY', reasons };
  }
  const parent = (action: string) =>
    input.parentGrants.find(
      (g) =>
        g.capability?.action === action &&
        g.capability.subject === leaf.issuer &&
        g.capability.resource === leaf.capability.resource,
    );
  const authorizedParent = (action: string) => {
    const g = parent(action);
    const r = authorizeWithCapability({
      grant: g,
      issuerDocument: input.rootDocument,
      issuerIsActiveTrustAnchor: input.rootIsActiveTrustAnchor,
      request: { requester: leaf.issuer, action, resource: leaf.capability.resource },
      now: input.now,
    });
    return r.decision === 'ALLOW' ? g : undefined;
  };
  const authority = authorizedParent(rule.derivesFrom);
  const permission = authorizedParent(rule.permission);
  if (authority === undefined) reasons.push('DELEGATOR_LACKS_AUTHORITY');
  if (permission === undefined) reasons.push('DELEGATION_NOT_PERMITTED');
  if (authority && permission) {
    const leafUntil = Date.parse(leaf.capability.constraints.validUntil);
    const issued = Date.parse(leaf.issuedAt);
    const within = (g: CapabilityGrant) =>
      leafUntil <= Date.parse(g.capability.constraints.validUntil) &&
      issued >= Date.parse(g.issuedAt) &&
      issued <= Date.parse(g.capability.constraints.validUntil);
    if (!within(authority) || !within(permission)) reasons.push('DELEGATION_EXCEEDS_DELEGATOR');
  }
  if (reasons.length > 0) return { decision: 'DENY', reasons };
  return {
    decision: 'ALLOW',
    reasons: [],
    chain: [edge(authority!), edge(permission!), edge(leaf)],
  };
}
