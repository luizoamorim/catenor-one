// 10 trust domain · 11 root Trust Anchor · 20 Sponsor · 21 Trust Anchor → Sponsor · 30 SPV · 31 Offering Policy.
import { writeFileSync } from 'node:fs';
import { verifyChain } from '@catenor-one/audit';
import {
  RELATIONSHIP_PREDICATES,
  SPONSOR_CAPABILITIES,
  TOKENIZE_ASSET,
  bootstrapConfigurationHash,
  parseBootstrapConfiguration,
} from '@catenor-one/authority';
import {
  OFFERING_ELIGIBILITY_POLICY_HASH,
  OFFERING_ELIGIBILITY_POLICY_ID,
  policyHash,
} from '@catenor-one/policy';
import { packagedAdmissionPolicy } from '../../../../src/infrastructure/runtime/runtime-adapters.js';
import { RESOURCE, TRUST_DOMAIN, inDays, type Context } from '../context.js';
import { provisionS001Signers, provisionSigner } from '../privy-infra.js';
import { say, type Stage } from '../stage.js';
import { BOOTSTRAP_CONFIG_FILE, env, need, setState } from '../state.js';

export const createTrustDomain: Stage = {
  id: '10-create-trust-domain',
  title: 'Catenor Protocol — Trust Domain bootstrap configuration',
  actor: 'Maintainer / Trust Domain operator',
  operation: 'Trust Domain Bootstrap Configuration (S001) — hash-pinned acceptance rules',
  changes: [
    'Privy dev app: S001 signer infrastructure for THIS Trust Domain — Credential Assertion signer (key quorum + P_ASSERT) and a separate Bootstrap Endorsement Key wallet (P_BOOTSTRAP); owner keys → ~/.catenor-one/clean-room/<instance>/',
    'writes the Bootstrap Configuration (.catenor-demo/bootstrap-configuration.json) and its hash (state.env)',
  ],
  sponsors: ['Privy (server wallets, key quorums, policies)'],
  mode: 'SPONSOR LIVE (non-spending)',
  expected: 'a Bootstrap Configuration pinned by hash; HYBRID_DEMO evidence profile',
  details: () => ({
    'Trust Domain': TRUST_DOMAIN,
    'Admission policy': 'policy:trust-anchor-admission:v1',
  }),
  async run(ctx) {
    let provisioned = 'reused (already in state.env)';
    let bootstrapMultikey = env('DEMO_BOOTSTRAP_PUBLIC_KEY_MULTIBASE');
    if (!env('DEMO_BOOTSTRAP_WALLET_ID')) {
      const r = await provisionS001Signers(ctx.privy, ctx.instance);
      bootstrapMultikey = r.bootstrapMultikey;
      setState({ DEMO_BOOTSTRAP_PUBLIC_KEY_MULTIBASE: bootstrapMultikey });
      provisioned = 'CREATED LIVE (Privy development app)';
    }
    const raw = {
      type: 'CatenorTrustDomainBootstrapConfiguration',
      profile: 'catenor-one/bootstrap-configuration/v1',
      trustDomain: TRUST_DOMAIN,
      admissionPolicy: 'policy:trust-anchor-admission:v1',
      admissionPolicyHash: policyHash(packagedAdmissionPolicy.load()),
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
    };
    const hash = bootstrapConfigurationHash(parseBootstrapConfiguration(raw));
    writeFileSync(BOOTSTRAP_CONFIG_FILE, `${JSON.stringify(raw, null, 2)}\n`);
    setState({ DEMO_BOOTSTRAP_CONFIGURATION_HASH: hash });
    say('S001 signer infrastructure', provisioned);
    say('Bootstrap Configuration hash', hash);
    return {
      trustDomain: TRUST_DOMAIN,
      signerInfrastructure: provisioned,
      bootstrapConfigurationHash: hash,
    };
  },
};

export const admitTrustAnchor: Stage = {
  id: '11-admit-root-trust-anchor',
  title: 'Catenor Protocol — Root Trust Anchor Admission (S001)',
  actor:
    'Candidate organization (operator-initiated; the AC-001–003 access gate is not implemented)',
  operation:
    'ADMIT_TRUST_ANCHOR → policy:trust-anchor-admission:v1 → bootstrap endorsement → ACTIVE',
  changes: [
    'ORGANIZATION Subject + random did:catenor + Credential Assertion Key (Privy Ed25519 wallet)',
    'Sumsub SANDBOX representative applicant (synthetic) bound by bindingRef; review forced GREEN',
    'CRE identity-confidential TRUST_ANCHOR_ADMISSION (company evidence: SYNTHETIC MOCK)',
    'Admission Decision, bootstrap endorsement (separate Privy key), Admission Record, audit events',
  ],
  sponsors: ['Privy', 'Sumsub (sandbox)', 'Chainlink CRE (confidential)'],
  mode: 'CONFIDENTIAL (CRE)',
  expected: 'ALLOW → ACTIVE → TRUST_ANCHOR_VALID (12/12 checks)',
  async run(ctx) {
    await ctx.startConfidential();
    const { admission } = ctx.services;
    const started = await admission.startInitialAdmission({
      operatorRef: 'operator-ref:clean-room',
    });
    say('candidate', started.did);
    const applicantId = await ctx.sumsub.createRepresentative(
      started.providerSetup.representativeBindingRef,
    );
    await ctx.sumsub.forceReview(applicantId, 'GREEN');
    await admission.attachProviderReferences(started.sessionRef, {
      companyApplicantId: 'mock:company-fixture:MOCK_COMPANY_ACTIVE_GREEN',
      representativeApplicantId: applicantId,
    });
    const key = await admission.provisionAssertionKey(started.sessionRef);
    await admission.issueKeyPossessionChallenge(started.sessionRef);
    const proof = await admission.proveKeyPossessionWithSecureSigner(started.sessionRef);
    say('key possession (Privy signMessage, eddsa-jcs-2022)', proof);
    const { runId } = await admission.requestConfidentialVerification(started.sessionRef);
    const outcome = await ctx.simulationOutcome(runId);
    const run = await ctx.db.confidentialVerificationRun.findUnique({ where: { runId } });
    say('confidential verification', {
      mode: ctx.creMode,
      handler: outcome?.handlerResult,
      status: run?.status,
    });
    const decision = await admission.evaluateAdmission(started.sessionRef);
    say('policy:trust-anchor-admission:v1', decision);
    if (decision.outcome !== 'ALLOW') {
      return { decision, trustAnchor: null };
    }
    await admission.endorseAndActivate(started.sessionRef);
    const verification = await admission.verifyTrustAnchor(started.did);
    setState({ DEMO_TRUST_ANCHOR_DID: started.did });
    say('TRUST_ANCHOR_VALID', verification.TRUST_ANCHOR_VALID);
    return {
      trustAnchor: started.did,
      assertionMethod: key.verificationMethod.id,
      confidentialRun: {
        mode: ctx.creMode,
        runId,
        handler: outcome?.handlerResult ?? null,
        status: run?.status,
        facts: run?.facts,
        evidenceCommitment: run?.evidenceCommitment,
      },
      decision,
      TRUST_ANCHOR_VALID: verification.TRUST_ANCHOR_VALID,
      failedChecks: verification.checks.filter((c) => !c.passed).map((c) => c.id),
      evidenceLabels: {
        representative: 'REAL SUMSUB SANDBOX (synthetic applicant)',
        company: 'SYNTHETIC MOCK',
        cre: ctx.creMode,
      },
    };
  },
};

export const createSponsor: Stage = {
  id: '20-create-sponsor',
  title: 'Catenor Protocol — Sponsor Subject',
  actor: 'Sponsor (organization onboarding)',
  operation: 'create ORGANIZATION Subject + Credential Assertion Key',
  changes: [
    'ORGANIZATION Subject with a random did:catenor (no PII in the DID)',
    'Privy Ed25519 wallet as the Sponsor Credential Assertion Key (signMessage-only policy; signs grants, relationships, the offering) — never a financial key',
    'minimized DID Document {id, verificationMethod, assertionMethod}',
  ],
  sponsors: ['Privy'],
  mode: 'SPONSOR LIVE (non-spending)',
  expected: 'Sponsor did:catenor with an assertion key; NOT a Trust Anchor; no capability yet',
  async run(ctx) {
    const sponsor = await ctx.services.sponsor.registerSponsor();
    setState({ DEMO_SPONSOR_DID: sponsor.did });
    say('Sponsor', sponsor);
    return { sponsor: sponsor.did, assertionMethod: sponsor.verificationMethod, capabilities: [] };
  },
};

export const authorizeSponsor: Stage = {
  id: '21-trust-anchor-authorize-sponsor',
  title: 'Catenor Protocol — Sponsor Authorization',
  actor: 'Root Trust Anchor',
  operation: 'Relationship Credential + five scoped Capability grants (Relationship ≠ Capability)',
  changes: [
    'Relationship Credential: Sponsor AUTHORIZED_SPONSOR_IN the Trust Domain [REF-IMPL predicate] — describes the connection, grants nothing',
    'five Capability grants on spv:catenor-demo-001 [REF-IMPL actions], each signed by the Trust Anchor assertion key (eddsa-jcs-2022)',
  ],
  sponsors: ['Privy (Trust Anchor signs via its Ed25519 wallet)'],
  mode: 'SPONSOR LIVE (non-spending)',
  expected:
    'VALID relationship; every Sponsor capability ALLOW; relationship alone authorizes nothing',
  details: () => ({
    Issuer: env('DEMO_TRUST_ANCHOR_DID') || '(stage 11)',
    Subject: env('DEMO_SPONSOR_DID') || '(stage 20)',
    Relationship: `AUTHORIZED_SPONSOR_IN ${TRUST_DOMAIN}`,
    Capabilities: SPONSOR_CAPABILITIES.map((a) => `${a} on ${RESOURCE}`),
  }),
  async run(ctx) {
    const trustAnchor = need('DEMO_TRUST_ANCHOR_DID', '11-admit-root-trust-anchor.sh');
    const sponsor = need('DEMO_SPONSOR_DID', '20-create-sponsor.sh');
    const { sponsor: svc } = ctx.services;
    const { relationship, grants } = await svc.authorizeSponsor({
      trustAnchor,
      sponsor,
      resource: RESOURCE,
      validUntil: inDays(30),
    });
    const rel = await svc.verifyRelationship({
      subject: sponsor,
      predicate: RELATIONSHIP_PREDICATES.AUTHORIZED_SPONSOR_IN,
      object: TRUST_DOMAIN,
    });
    const checks = [];
    for (const action of SPONSOR_CAPABILITIES) {
      const r = await svc.authorizeSponsorAction(sponsor, action, RESOURCE);
      checks.push({ action, resource: RESOURCE, decision: r.decision, reasons: r.reasons });
    }
    const wrongResource = await svc.authorizeSponsorAction(
      sponsor,
      TOKENIZE_ASSET,
      'spv:catenor-demo-002',
    );
    say('relationship', { id: relationship.id, verification: rel.verification });
    say('capabilities', checks);
    say('same capability, another resource', wrongResource);
    return {
      issuer: trustAnchor,
      subject: sponsor,
      relationship: {
        credentialId: relationship.id,
        type: relationship.type,
        predicate: 'AUTHORIZED_SPONSOR_IN',
        object: TRUST_DOMAIN,
        verification: rel.verification,
        grantsAuthority: false,
      },
      grants: grants.map((g) => ({
        id: g.id,
        action: g.capability.action,
        resource: g.capability.resource,
        validUntil: g.capability.constraints.validUntil,
        proof: g.proof.cryptosuite,
      })),
      authorization: checks,
      negative: { tokenizeAnotherResource: wrongResource },
      expected:
        checks.every((c) => c.decision === 'ALLOW') &&
        rel.verification.valid &&
        wrongResource.decision === 'DENY'
          ? 'VALID'
          : 'UNEXPECTED',
    };
  },
};

export const createSpv: Stage = {
  id: '30-create-spv',
  title: 'Catenor Protocol — SPV creation under TOKENIZE_ASSET',
  actor: 'Sponsor',
  operation:
    'TOKENIZE_ASSET (authorized) → SPV Subject + execution wallet + SPONSORED_BY relationship',
  changes: [
    'Privy dev app: SPV signer infrastructure (management owner → ~/.catenor-one, runtime key quorum) if absent',
    'SPV ORGANIZATION Subject + did:catenor (Catenor One Demo SPV 001 — a synthetic real-estate SPV)',
    'Privy EVM execution wallet + SPV execution policy created AFTER the Sponsor ALLOW (chain 296 ∧ ATS Factory; exports denied)',
    'private SPV_EXECUTION Account Binding; Relationship Credential SPV SPONSORED_BY Sponsor',
  ],
  sponsors: ['Privy'],
  mode: 'SPONSOR LIVE (non-spending)',
  expected: 'Sponsor TOKENIZE_ASSET ALLOW → SPV + wallet (0 HBAR until stage 50)',
  details: () => ({ Sponsor: env('DEMO_SPONSOR_DID') || '(stage 20)', Resource: RESOURCE }),
  async run(ctx) {
    const sponsor = need('DEMO_SPONSOR_DID', '20-create-sponsor.sh');
    if (!env('DEMO_SPV_OWNER_PUBLIC_KEY')) {
      await provisionSigner(
        ctx.privy,
        ctx.instance,
        'DEMO_SPV',
        'catenor-one-clean-room-spv-runtime',
      );
    }
    const spv = await ctx.services.sponsor.createSpv({
      sponsor,
      resource: RESOURCE,
      validUntil: inDays(30),
    });
    setState({
      DEMO_SPV_DID: spv.did,
      DEMO_SPV_WALLET_ID: spv.wallet.walletRef,
      DEMO_SPV_WALLET_ADDRESS: spv.wallet.address,
      DEMO_SPV_POLICY_ID: spv.wallet.policyRef,
    });
    say('SPV', { did: spv.did, wallet: spv.wallet.address, controls: spv.wallet.controls });
    return {
      spv: spv.did,
      wallet: spv.wallet.address,
      policyControls: spv.wallet.controls,
      relationship: {
        credentialId: spv.relationship.id,
        predicate: 'SPONSORED_BY',
        object: sponsor,
      },
    };
  },
};

export const createOffering: Stage = {
  id: '31-create-offering-policy',
  title: 'Catenor Protocol — Offering Policy defined by the Sponsor',
  actor: 'Sponsor',
  operation:
    'DEFINE_OFFERING_POLICY (authorized) → signed offering pinning policy:offering-eligibility:v1',
  changes: [
    'offering definition: Catenor One Demo SPV 001 — 1,000 equity-interest units; accepted credential CatenorInvestorEligibilityCredential',
    'eligibility = policy:offering-eligibility:v1 (INVESTOR_PRESENTATION_VALID ∧ INVESTOR_IDENTITY_VERIFIED ∧ INVESTOR_AML_CLEAR ∧ EVIDENCE_FRESH), pinned by hash',
    'signed by the Sponsor assertion key; verified against its DEFINE_OFFERING_POLICY grant',
  ],
  sponsors: ['Privy (Sponsor signs)'],
  mode: 'SPONSOR LIVE (non-spending)',
  expected: 'offering ALLOW (Sponsor signature ✓, DEFINE_OFFERING_POLICY ✓)',
  details: () => ({
    Sponsor: env('DEMO_SPONSOR_DID') || '(stage 20)',
    Policy: `${OFFERING_ELIGIBILITY_POLICY_ID} ${OFFERING_ELIGIBILITY_POLICY_HASH}`,
  }),
  async run(ctx) {
    const sponsor = need('DEMO_SPONSOR_DID', '20-create-sponsor.sh');
    const offering = await ctx.services.sponsor.defineOffering({
      sponsor,
      resource: RESOURCE,
      name: 'Catenor One Demo SPV 001',
      totalUnits: 1000,
      validUntil: inDays(30),
    });
    const verified = await ctx.services.sponsor.verifyOffering(offering);
    setState({ DEMO_OFFERING_ID: offering.id });
    say('offering', {
      id: offering.id,
      asset: offering.asset,
      eligibility: offering.eligibility,
      verified,
    });
    return {
      offering: {
        id: offering.id,
        resource: offering.resource,
        asset: offering.asset,
        eligibility: offering.eligibility,
        validUntil: offering.validUntil,
      },
      verification: verified,
    };
  },
};

export async function auditSummary(ctx: Context) {
  const timeline = await ctx.uow.run((p) => p.audit.timeline(TRUST_DOMAIN));
  return {
    events: timeline.length,
    types: timeline.map((e) => e.type),
    chain: verifyChain(TRUST_DOMAIN, timeline),
  };
}
