// Clean-room demo — Sponsor authorization, SPV, offering and Distribution Agent (Catenor One [REF-IMPL]; prompt
// 2026-09-11-023). Application orchestration only: Catenor semantics here, sponsor mechanics behind ports.
//
//   ACTIVE Trust Anchor ──Relationship Credential──▶ Sponsor AUTHORIZED_SPONSOR_IN the Trust Domain
//                       ──five Capability grants──▶ TOKENIZE_ASSET · DEFINE_OFFERING_POLICY · CREATE_AGENT ·
//                                                   CREATE_DISTRIBUTION · DELEGATE_DISTRIBUTION_AUTHORITY
//   Sponsor ──(TOKENIZE_ASSET)──▶ SPV Subject + Privy EVM execution wallet + SPV_EXECUTION binding;
//           SPV SPONSORED_BY Sponsor (Relationship Credential)
//   Sponsor ──(DEFINE_OFFERING_POLICY)──▶ signed offering definition pinning policy:offering-eligibility:v1
//   Sponsor ──(CREATE_AGENT)──▶ Agent Subject + Privy execution wallet + AGENT_EXECUTION binding
//   Sponsor ──Relationship Credential──▶ Agent AGENT_OF Sponsor           (who the Agent acts for)
//   Sponsor ──delegated grant──▶ Agent EXECUTE_DISTRIBUTION on the SPV     (what the Agent may do)
//
// Relationship ≠ Capability: every action below is authorized by an explicit, signed grant, never by a
// relationship. Every Sponsor action is checked against the Sponsor's grant BEFORE anything is created or signed.
import { commit } from '@catenor-one/audit';
import {
  CREATE_AGENT,
  CREATE_DISTRIBUTION,
  DEFINE_OFFERING_POLICY,
  DELEGABLE_ACTIONS,
  DELEGATE_DISTRIBUTION_AUTHORITY,
  RELATIONSHIP_PREDICATES,
  SPONSOR_CAPABILITIES,
  TOKENIZE_ASSET,
  authorizeDelegatedCapability,
  authorizeOfferingDefinition,
  authorizeWithCapability,
  createOfferingDefinition,
  createRelationshipCredential,
  verifyRelationshipCredential,
  type CapabilityAuthorization,
  type CapabilityGrant,
  type DelegatedAuthorization,
  type OfferingDefinition,
  type RelationshipPredicate,
} from '@catenor-one/authority';
import type { VerifiableCredential } from '@catenor-one/credentials';
import { generateCatenorDid, type CatenorDid } from '@catenor-one/identity';
import {
  INVESTOR_ELIGIBILITY_CREDENTIAL,
  OFFERING_ELIGIBILITY_POLICY_HASH,
  OFFERING_ELIGIBILITY_POLICY_ID,
} from '@catenor-one/policy';
import {
  CapabilityGrantRefused,
  grantCapability,
  signGrant,
  type CapabilityGrantDeps,
  type GrantableAction,
} from '../../capability-grants/application/grant-capability.js';
import type { DistributionAgentWalletProvisioner } from '../../distribution/application/distribution.service.js';
import type {
  PersistencePorts,
  StoredDocument,
} from '../../trust-anchor-admission/application/persistence.ports.js';
import { provisionSubjectKey, rfc3339, signAs } from './subject-keys.js';

const CAIP2 = 'eip155:296';

/** Execution-wallet provisioning for the SPV (Privy). The wallet policy is an execution control, not authority. */
export interface SpvWalletProvisioner {
  readonly adapter: string;
  provision(input: { readonly spvDid: string; readonly resource: string }): Promise<{
    readonly walletRef: string;
    readonly address: string;
    readonly policyRef: string;
    readonly controls: readonly string[];
  }>;
}

export interface SponsorAuthorizationDeps extends CapabilityGrantDeps {
  readonly spvProvisioner?: SpvWalletProvisioner;
  readonly agentProvisioner?: DistributionAgentWalletProvisioner;
}

export class SponsorActionRefused extends Error {
  constructor(
    message: string,
    readonly reasons: readonly string[] = [],
  ) {
    super(message);
    this.name = 'SponsorActionRefused';
  }
}

const addressOf = (caip10: string) => caip10.slice(caip10.lastIndexOf(':') + 1);

export class SponsorAuthorizationService {
  constructor(private readonly deps: SponsorAuthorizationDeps) {}

  /** Sponsor = ORGANIZATION Subject (random did:catenor) + its own Credential Assertion Key (Privy Ed25519). */
  async registerSponsor(): Promise<{ did: CatenorDid; verificationMethod: string }> {
    const did = generateCatenorDid(this.deps.ids.randomBytes(16));
    const subjectId = this.deps.ids.id('subject');
    await this.deps.uow.run(async (p) => {
      await p.subjects.createSubject({
        id: subjectId,
        did,
        type: 'ORGANIZATION',
        lifecycle: 'ACTIVE',
      });
      await this.audit(p, 'SUBJECT_CREATED', did, { subjectType: 'ORGANIZATION', role: 'SPONSOR' });
    });
    const key = await provisionSubjectKey(this.deps, {
      did,
      subjectId,
      purpose: 'CREDENTIAL_ASSERTION',
    });
    await this.deps.uow.run(async (p) => {
      await this.audit(p, 'KEY_ADDED', did, { purpose: 'CREDENTIAL_ASSERTION' });
      await this.audit(p, 'DID_DOCUMENT_CREATED', did);
    });
    return { did, verificationMethod: key.verificationMethod.id };
  }

  /**
   * The ACTIVE Trust Anchor authorizes the Sponsor: a Relationship Credential (AUTHORIZED_SPONSOR_IN the Trust
   * Domain) and, separately, the five scoped capabilities on the SPV resource.
   */
  async authorizeSponsor(input: {
    readonly trustAnchor: string;
    readonly sponsor: string;
    readonly resource: string;
    readonly validUntil: string;
  }): Promise<{ relationship: VerifiableCredential; grants: CapabilityGrant[] }> {
    if (!(await this.deps.verifyTrustAnchor(input.trustAnchor)).TRUST_ANCHOR_VALID) {
      throw new SponsorActionRefused('the issuer is not an ACTIVE Trust Anchor');
    }
    const relationship = await this.issueRelationship({
      issuer: input.trustAnchor,
      subject: input.sponsor,
      predicate: RELATIONSHIP_PREDICATES.AUTHORIZED_SPONSOR_IN,
      object: this.deps.trustDomain,
      validUntil: input.validUntil,
    });
    const grants: CapabilityGrant[] = [];
    for (const action of SPONSOR_CAPABILITIES) {
      const grant = await grantCapability(this.deps, {
        issuer: input.trustAnchor,
        subject: input.sponsor,
        action,
        resource: input.resource,
        validUntil: input.validUntil,
      });
      await this.store(input.sponsor, 'CAPABILITY_GRANT', grant.id, grant.issuer, grant);
      grants.push(grant);
    }
    return { relationship, grants };
  }

  /** The Sponsor's grant for one action on the resource (as recorded), or undefined. */
  async sponsorGrant(sponsor: string, action: string, resource: string) {
    const grants = await this.documents<CapabilityGrant>(sponsor, 'CAPABILITY_GRANT');
    return grants.find(
      (g) =>
        g.document.capability.action === action &&
        g.document.capability.resource === resource &&
        g.status === 'ACTIVE',
    )?.document;
  }

  /** Authorizes one Sponsor action against its Trust Anchor grant (fail closed). */
  async authorizeSponsorAction(
    sponsor: string,
    action: string,
    resource: string,
  ): Promise<CapabilityAuthorization & { grantId?: string }> {
    const grant = await this.sponsorGrant(sponsor, action, resource);
    const issuer = grant?.issuer;
    const issuerDocument = issuer
      ? (await this.deps.uow.run((p) => p.didState.resolve(issuer)))?.document
      : undefined;
    const issuerIsActiveTrustAnchor = issuer
      ? (await this.deps.verifyTrustAnchor(issuer)).TRUST_ANCHOR_VALID
      : false;
    const result = authorizeWithCapability({
      grant,
      issuerDocument,
      issuerIsActiveTrustAnchor,
      request: { requester: sponsor, action, resource },
      now: this.deps.clock.now(),
    });
    return { ...result, ...(grant ? { grantId: grant.id } : {}) };
  }

  /** Sponsor (TOKENIZE_ASSET) creates the SPV: Subject + Privy EVM execution wallet + private binding + relationship. */
  async createSpv(input: {
    readonly sponsor: string;
    readonly resource: string;
    readonly validUntil: string;
  }) {
    await this.require(input.sponsor, TOKENIZE_ASSET, input.resource);
    if (!this.deps.spvProvisioner) throw new Error('no SPV wallet provisioner configured');
    const did = generateCatenorDid(this.deps.ids.randomBytes(16));
    const subjectId = this.deps.ids.id('subject');
    await this.deps.uow.run(async (p) => {
      await p.subjects.createSubject({
        id: subjectId,
        did,
        type: 'ORGANIZATION',
        lifecycle: 'ACTIVE',
      });
      await this.audit(p, 'SUBJECT_CREATED', did, { subjectType: 'ORGANIZATION', role: 'SPV' });
    });
    const wallet = await this.deps.spvProvisioner.provision({
      spvDid: did,
      resource: input.resource,
    });
    await this.deps.uow.run(async (p) => {
      await p.accountBindings.createAccountBinding({
        id: this.deps.ids.id('account-binding'),
        subjectId,
        purpose: 'SPV_EXECUTION',
        account: `${CAIP2}:${wallet.address}`,
        walletProvider: this.deps.spvProvisioner!.adapter,
        walletRef: wallet.walletRef,
      });
      await this.audit(p, 'SPV_EXECUTION_WALLET_PROVISIONED', did, {
        walletProvider: this.deps.spvProvisioner!.adapter,
        walletAddress: wallet.address,
        resource: input.resource,
        controls: [...wallet.controls],
      });
    });
    const relationship = await this.issueRelationship({
      issuer: input.sponsor,
      subject: did,
      predicate: RELATIONSHIP_PREDICATES.SPONSORED_BY,
      object: input.sponsor,
      validUntil: input.validUntil,
    });
    return { did, wallet, relationship };
  }

  /** Sponsor (DEFINE_OFFERING_POLICY) signs the offering: who may invest is decided by the pinned policy. */
  async defineOffering(input: {
    readonly sponsor: string;
    readonly resource: string;
    readonly name: string;
    readonly totalUnits: number;
    readonly validUntil: string;
  }): Promise<OfferingDefinition> {
    const authority = await this.require(input.sponsor, DEFINE_OFFERING_POLICY, input.resource);
    const payload = createOfferingDefinition({
      id: this.deps.ids.id('offering'),
      issuer: input.sponsor,
      issuedAt: rfc3339(this.deps.clock.now()),
      resource: input.resource,
      asset: {
        name: input.name,
        description:
          'synthetic real-world real-estate asset held by an SPV; the units are equity interests in the SPV (not a land deed)',
        totalUnits: input.totalUnits,
      },
      eligibility: {
        policy: OFFERING_ELIGIBILITY_POLICY_ID,
        policyHash: OFFERING_ELIGIBILITY_POLICY_HASH,
        credentialType: INVESTOR_ELIGIBILITY_CREDENTIAL,
      },
      validUntil: input.validUntil,
    });
    const proof = await signAs(this.deps, input.sponsor, { kind: 'OFFERING', offering: payload });
    const offering: OfferingDefinition = { ...payload, proof };
    const verified = await this.verifyOffering(offering);
    if (verified.decision !== 'ALLOW') {
      throw new SponsorActionRefused('the signed offering does not verify', verified.reasons);
    }
    await this.store(input.sponsor, 'OFFERING_DEFINITION', offering.id, input.sponsor, offering);
    await this.deps.uow.run((p) =>
      this.audit(p, 'OFFERING_DEFINED', input.sponsor, {
        offeringId: offering.id,
        resource: offering.resource,
        policy: offering.eligibility.policy,
        policyHash: offering.eligibility.policyHash,
        totalUnits: offering.asset.totalUnits,
        grantId: authority.grantId ?? null,
        offeringCommitment: commit(offering),
      }),
    );
    return offering;
  }

  /** Verifies a recorded offering: Sponsor signature + DEFINE_OFFERING_POLICY from the ACTIVE Trust Anchor. */
  async verifyOffering(offering: OfferingDefinition | undefined) {
    const grant = offering
      ? await this.sponsorGrant(offering.issuer, DEFINE_OFFERING_POLICY, offering.resource)
      : undefined;
    const [sponsorDocument, rootDocument] = await this.deps.uow.run(async (p) => [
      offering ? (await p.didState.resolve(offering.issuer))?.document : undefined,
      grant ? (await p.didState.resolve(grant.issuer))?.document : undefined,
    ]);
    return authorizeOfferingDefinition({
      offering,
      sponsorDocument,
      sponsorGrant: grant,
      rootDocument,
      rootIsActiveTrustAnchor: grant
        ? (await this.deps.verifyTrustAnchor(grant.issuer)).TRUST_ANCHOR_VALID
        : false,
      now: this.deps.clock.now(),
    });
  }

  async findOffering(sponsor: string, offeringId: string): Promise<OfferingDefinition | undefined> {
    return (await this.documents<OfferingDefinition>(sponsor, 'OFFERING_DEFINITION')).find(
      (d) => d.id === offeringId,
    )?.document;
  }

  /** Sponsor (CREATE_AGENT) creates the Distribution Agent: AGENT Subject + Privy execution wallet + binding. */
  async createAgent(input: {
    readonly sponsor: string;
    readonly resource: string;
    readonly investors: readonly string[];
    readonly maxPayoutWeibar: bigint;
  }) {
    await this.require(input.sponsor, CREATE_AGENT, input.resource);
    if (!this.deps.agentProvisioner) throw new Error('no Agent wallet provisioner configured');
    const recipients = await this.deps.uow.run(async (p) => {
      const out: string[] = [];
      for (const did of input.investors) {
        const subject = await p.subjects.findSubjectByDid(did);
        const binding = subject
          ? await p.accountBindings.findAccountBinding(subject.id, 'DISTRIBUTION_RECEIVING')
          : undefined;
        if (!binding) throw new Error('investor has no receiving account binding');
        out.push(addressOf(binding.account));
      }
      return out;
    });
    const did = generateCatenorDid(this.deps.ids.randomBytes(16));
    const subjectId = this.deps.ids.id('subject');
    await this.deps.uow.run(async (p) => {
      await p.subjects.createSubject({ id: subjectId, did, type: 'AGENT', lifecycle: 'ACTIVE' });
      await this.audit(p, 'SUBJECT_CREATED', did, {
        subjectType: 'AGENT',
        createdBy: input.sponsor,
      });
    });
    const wallet = await this.deps.agentProvisioner.provision({
      agentDid: did,
      resource: input.resource,
      recipients,
      maxPayoutWeibar: input.maxPayoutWeibar,
    });
    await this.deps.uow.run(async (p) => {
      await p.accountBindings.createAccountBinding({
        id: this.deps.ids.id('account-binding'),
        subjectId,
        purpose: 'AGENT_EXECUTION',
        account: `${CAIP2}:${wallet.address}`,
        walletProvider: this.deps.agentProvisioner!.adapter,
        walletRef: wallet.walletRef,
      });
      await this.audit(p, 'AGENT_EXECUTION_WALLET_PROVISIONED', did, {
        walletProvider: this.deps.agentProvisioner!.adapter,
        walletAddress: wallet.address,
        resource: input.resource,
        provisioning: wallet.provisioning ?? 'CREATED_LIVE',
        controls: [...wallet.controls],
      });
    });
    return { did, wallet };
  }

  /** Sponsor → Agent relationship: the Agent acts for the Sponsor. It authorizes nothing by itself. */
  async establishAgentRelationship(input: {
    readonly sponsor: string;
    readonly agent: string;
    readonly validUntil: string;
  }): Promise<VerifiableCredential> {
    return this.issueRelationship({
      issuer: input.sponsor,
      subject: input.agent,
      predicate: RELATIONSHIP_PREDICATES.AGENT_OF,
      object: input.sponsor,
      validUntil: input.validUntil,
    });
  }

  /**
   * Sponsor delegates one explicitly delegable action to the Agent. Checked BEFORE signing (no signature for a
   * refused delegation): the action is delegable, and the Sponsor holds both the authority it derives from and the
   * permission to delegate it. After signing, the whole chain is verified again.
   */
  async delegateToAgent(input: {
    readonly sponsor: string;
    readonly agent: string;
    readonly action: GrantableAction;
    readonly resource: string;
    readonly validUntil: string;
  }): Promise<{ grant: CapabilityGrant; authorization: DelegatedAuthorization }> {
    const rule = DELEGABLE_ACTIONS[input.action];
    if (rule === undefined) {
      throw new SponsorActionRefused(`${input.action} is not delegable`, ['ACTION_NOT_DELEGABLE']);
    }
    const reasons: string[] = [];
    for (const [action, code] of [
      [rule.derivesFrom, 'DELEGATOR_LACKS_AUTHORITY'],
      [rule.permission, 'DELEGATION_NOT_PERMITTED'],
    ] as const) {
      const r = await this.authorizeSponsorAction(input.sponsor, action, input.resource);
      if (r.decision !== 'ALLOW') reasons.push(code);
    }
    if (reasons.length > 0) throw new SponsorActionRefused('delegation refused', reasons);
    const grant = await signGrant(this.deps, {
      issuer: input.sponsor,
      subject: input.agent,
      action: input.action,
      resource: input.resource,
      validUntil: input.validUntil,
    });
    const authorization = await this.authorizeDelegated({
      requester: input.agent,
      grant,
      action: input.action,
      resource: input.resource,
    });
    if (authorization.decision !== 'ALLOW') {
      throw new SponsorActionRefused(
        'the signed delegation does not verify',
        authorization.reasons,
      );
    }
    await this.store(input.agent, 'CAPABILITY_GRANT', grant.id, input.sponsor, grant);
    return { grant, authorization };
  }

  /** The Agent's recorded delegated grant for `action` on `resource`, if any. */
  async agentGrant(agent: string, action: string, resource: string) {
    return (await this.documents<CapabilityGrant>(agent, 'CAPABILITY_GRANT')).find(
      (g) =>
        g.status === 'ACTIVE' &&
        g.document.capability.action === action &&
        g.document.capability.resource === resource,
    )?.document;
  }

  /** Verifies a delegated grant through the chain TA → delegator → requester (fail closed). */
  async authorizeDelegated(input: {
    readonly requester: string;
    readonly grant: CapabilityGrant | undefined;
    readonly action: string;
    readonly resource: string;
  }): Promise<DelegatedAuthorization> {
    const delegator = input.grant?.issuer;
    const parentGrants = delegator
      ? (await this.documents<CapabilityGrant>(delegator, 'CAPABILITY_GRANT'))
          .filter((g) => g.status === 'ACTIVE')
          .map((g) => g.document)
      : [];
    const root = parentGrants.find((g) =>
      [CREATE_DISTRIBUTION, DELEGATE_DISTRIBUTION_AUTHORITY].includes(g.capability.action),
    )?.issuer;
    const [delegatorDocument, rootDocument] = await this.deps.uow.run(async (p) => [
      delegator ? (await p.didState.resolve(delegator))?.document : undefined,
      root ? (await p.didState.resolve(root))?.document : undefined,
    ]);
    return authorizeDelegatedCapability({
      grant: input.grant,
      delegatorDocument,
      parentGrants,
      rootDocument,
      rootIsActiveTrustAnchor: root
        ? (await this.deps.verifyTrustAnchor(root)).TRUST_ANCHOR_VALID
        : false,
      request: { requester: input.requester, action: input.action, resource: input.resource },
      now: this.deps.clock.now(),
    });
  }

  /** Verifies a recorded Relationship Credential against its issuer's DID Document. */
  async verifyRelationship(input: {
    readonly subject: string;
    readonly predicate: RelationshipPredicate;
    readonly object: string;
  }) {
    const found = (
      await this.documents<VerifiableCredential>(input.subject, 'RELATIONSHIP_CREDENTIAL')
    ).find(
      (d) =>
        (d.document.credentialSubject.relationship as { type?: string } | undefined)?.type ===
        input.predicate,
    );
    const issuerDocument = found
      ? (await this.deps.uow.run((p) => p.didState.resolve(found.issuer)))?.document
      : undefined;
    return {
      credential: found?.document,
      verification: verifyRelationshipCredential({
        credential: found?.document,
        issuerDocument,
        expected: input,
        now: this.deps.clock.now(),
      }),
    };
  }

  // ---- internals ------------------------------------------------------------------------------------

  private async require(sponsor: string, action: string, resource: string) {
    const r = await this.authorizeSponsorAction(sponsor, action, resource);
    if (r.decision !== 'ALLOW') {
      await this.deps.uow.run((p) =>
        this.audit(p, 'ASSET_ACTION_DENIED', sponsor, {
          action,
          resource,
          reasons: [...r.reasons],
        }),
      );
      throw new CapabilityGrantRefused(`${action} denied: ${r.reasons.join(', ')}`);
    }
    return r;
  }

  private async issueRelationship(input: {
    readonly issuer: string;
    readonly subject: string;
    readonly predicate: RelationshipPredicate;
    readonly object: string;
    readonly validUntil: string;
  }): Promise<VerifiableCredential> {
    const id = this.deps.ids.id('urn:uuid');
    const credential = createRelationshipCredential({
      id,
      issuer: input.issuer,
      subject: input.subject,
      predicate: input.predicate,
      object: input.object,
      validFrom: rfc3339(this.deps.clock.now()),
      validUntil: input.validUntil,
      statusId: `urn:catenor-one:status:${id.slice('urn:uuid:'.length)}`,
    });
    const proof = await signAs(this.deps, input.issuer, { kind: 'CREDENTIAL', credential });
    const vc: VerifiableCredential = { ...credential, proof };
    await this.store(input.subject, 'RELATIONSHIP_CREDENTIAL', vc.id, input.issuer, vc);
    await this.deps.uow.run((p) =>
      this.audit(p, 'RELATIONSHIP_ESTABLISHED', input.subject, {
        credentialId: vc.id,
        issuer: input.issuer,
        predicate: input.predicate,
        object: input.object,
        credentialCommitment: commit(vc),
      }),
    );
    return vc;
  }

  private async store(
    subjectDid: string,
    kind: StoredDocument['kind'],
    id: string,
    issuer: string,
    document: unknown,
  ) {
    await this.deps.uow.run(async (p) => {
      const subject = await p.subjects.findSubjectByDid(subjectDid);
      if (!subject) throw new Error(`unknown subject ${subjectDid}`);
      await p.documents.saveDocument({ id, kind, subjectId: subject.id, issuer, document });
    });
  }

  private documents<T>(subjectDid: string, kind: StoredDocument['kind']) {
    return this.deps.uow.run(async (p) => {
      const subject = await p.subjects.findSubjectByDid(subjectDid);
      return subject ? p.documents.listDocuments<T>(subject.id, kind) : [];
    });
  }

  private audit(
    p: PersistencePorts,
    type: Parameters<PersistencePorts['audit']['append']>[1]['type'],
    subject: string,
    details?: Record<string, string | number | boolean | null | readonly string[]>,
  ) {
    return p.audit.append(this.deps.trustDomain, {
      type,
      subject,
      timestamp: rfc3339(this.deps.clock.now()),
      ...(details ? { details } : {}),
    });
  }
}
