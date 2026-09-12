// 40/41 investors · 42 Verifiable Credentials · 43 Verifiable Presentations · 44 offering eligibility (CRE).
import { verifyPresentation } from '@catenor-one/credentials';
import {
  INVESTOR_ELIGIBILITY_CREDENTIAL,
  OFFERING_ELIGIBILITY_POLICY_ID,
} from '@catenor-one/policy';
import { provisionReceivingWallet } from '../privy-infra.js';
import { say, type Stage } from '../stage.js';
import { env, need, setState } from '../state.js';

type Label = 'A' | 'B';
const ALLOCATION: Record<Label, bigint> = { A: 600n, B: 400n };
/** Fictional sandbox display names (Sumsub dashboard only); override with --name="First Last". */
const SANDBOX_NAME: Record<Label, string> = { A: 'Lisa Simpson', B: 'Bart Simpson' };

function sandboxName(label: Label, flag: string | undefined) {
  const full = (flag ?? SANDBOX_NAME[label]).trim();
  const m = /^([A-Za-z][A-Za-z'-]{0,39}) ([A-Za-z][A-Za-z' -]{0,39})$/.exec(full);
  if (!m) throw new Error('--name must be "First Last" (letters, space, apostrophe or hyphen)');
  return { full, firstName: m[1]!, lastName: m[2]! };
}

function createInvestor(label: Label): Stage {
  return {
    id: label === 'A' ? '40-create-investor-a' : '41-create-investor-b',
    title: `Catenor Protocol — Investor ${label} (Subject, wallet, private bindings, provider evidence)`,
    actor: `Investor ${label} (onboarding)`,
    operation: 'create HUMAN Subject + private Account Binding + provider binding + holder key',
    changes: [
      `HUMAN Subject with a random did:catenor (no PII); Investor ${label} is a synthetic sandbox person`,
      'Privy EVM receiving wallet (its own owner key → ~/.catenor-one; no signer, no policy — it only receives)',
      'PRIVATE Account Binding did:catenor → eip155:296:<wallet> (never published in the DID Document)',
      'AUTHENTICATION holder key (Privy Ed25519) listed in the DID Document — signs Verifiable Presentations, never money',
      `Sumsub SANDBOX applicant (level id-only, fictional display name — default ${SANDBOX_NAME[label]}, --name="First Last" to change) created with externalUserId = the private bindingRef; review forced GREEN`,
    ],
    sponsors: ['Privy', 'Sumsub (sandbox)'],
    mode: 'SPONSOR LIVE (non-spending)',
    expected: `Investor ${label}: did:catenor + receiving wallet + GREEN sandbox review (currently eligible)`,
    async run(ctx, flags) {
      const name = sandboxName(label, flags.options['name']);
      const wallet = await provisionReceivingWallet(ctx.privy, ctx.instance, label);
      const investor = await ctx.services.investors.registerInvestor({
        account: wallet.address,
        walletRef: wallet.walletId,
      });
      const applicantId = await ctx.sumsub.createInvestorApplicant(
        investor.bindingRef,
        label,
        name,
      );
      await ctx.sumsub.forceReview(applicantId, 'GREEN');
      await ctx.services.investors.attachApplicant(investor.did, applicantId);
      setState({
        [`DEMO_INVESTOR_${label}_DID`]: investor.did,
        [`DEMO_INVESTOR_${label}_ADDRESS`]: wallet.address,
        [`DEMO_INVESTOR_${label}_WALLET_ID`]: wallet.walletId,
        [`DEMO_INVESTOR_${label}_SANDBOX_NAME`]: name.full,
      });
      say(`Investor ${label}`, {
        sandboxName: `${name.full} (fictional; Sumsub sandbox dashboard only — not in the DID)`,
        did: investor.did,
        receivingWallet: wallet.address,
        holderKey: investor.authenticationMethod,
      });
      return {
        investor: investor.did,
        receivingWallet: wallet.address,
        accountBinding: 'PRIVATE (eip155:296 CAIP-10; not in the DID Document)',
        holderKey: investor.authenticationMethod,
        sandboxName: `${name.full} (fictional)`,
        providerEvidence:
          'REAL SUMSUB SANDBOX applicant (synthetic), current review GREEN — applicant id private',
      };
    },
  };
}

export const createInvestorA = createInvestor('A');
export const createInvestorB = createInvestor('B');

const investorsFromState = () =>
  (['A', 'B'] as const).map((label) => ({
    label,
    did: need(
      `DEMO_INVESTOR_${label}_DID`,
      label === 'A' ? '40-create-investor-a.sh' : '41-create-investor-b.sh',
    ),
  }));

export const issueCredentials: Stage = {
  id: '42-create-investor-credentials',
  title: 'Catenor Protocol — Provider evidence → Catenor Verifiable Credentials',
  actor: 'Root Trust Anchor (credential issuer; its issuer authority comes from Admission)',
  operation:
    'CRE INVESTOR_ELIGIBILITY per investor → CatenorInvestorEligibilityCredential (W3C VC 2.0, eddsa-jcs-2022)',
  changes: [
    'one confidential run per investor: the TEE reads the CURRENT Sumsub sandbox review (binding gate, N1–N6) → facts + evidence commitment',
    'only if every fact is TRUE, the Trust Anchor signs a VC: {investorIdentityVerified, investorAmlClear, evidenceCommitment} — no PII',
    'credentialStatus → [REF-IMPL] issuer-signed status statement (checked at every presentation)',
  ],
  sponsors: ['Chainlink CRE (confidential)', 'Sumsub (sandbox)', 'Privy (issuer signature)'],
  mode: 'CONFIDENTIAL (CRE)',
  expected: 'two VCs issued (A and B both currently GREEN)',
  details: () => ({
    Issuer: env('DEMO_TRUST_ANCHOR_DID') || '(stage 11)',
    'Credential type': INVESTOR_ELIGIBILITY_CREDENTIAL,
  }),
  async run(ctx) {
    await ctx.startConfidential();
    const trustAnchor = need('DEMO_TRUST_ANCHOR_DID', '11-admit-root-trust-anchor.sh');
    const out = [];
    for (const { label, did } of investorsFromState()) {
      const { credential, run } = await ctx.services.investors.issueInvestorCredential({
        trustAnchor,
        investor: did,
      });
      const entry = {
        investor: `Investor ${label}`,
        did,
        credentialId: credential.id,
        type: credential.type,
        issuer: credential.issuer,
        validFrom: credential.validFrom,
        validUntil: credential.validUntil,
        claims: {
          investorIdentityVerified: credential.credentialSubject['investorIdentityVerified'],
          investorAmlClear: credential.credentialSubject['investorAmlClear'],
        },
        status: credential.credentialStatus,
        proof: {
          cryptosuite: credential.proof.cryptosuite,
          verificationMethod: credential.proof.verificationMethod,
          proofPurpose: credential.proof.proofPurpose,
        },
        confidentialRun: {
          mode: run.mode,
          runId: run.runId,
          facts: run.facts,
          evidenceCommitment: run.evidenceCommitment,
        },
      };
      say(`Investor ${label} credential`, entry);
      out.push(entry);
    }
    return { credentials: out };
  },
};

export const createPresentations: Stage = {
  id: '43-create-investor-presentations',
  title: 'Catenor Protocol — Investor Verifiable Presentations (holder binding)',
  actor: 'Investor A and Investor B (holder keys)',
  operation:
    'VP over the investor credential, holder proof (authentication) bound to a verifier challenge + domain',
  changes: [
    'each investor signs a VP with its AUTHENTICATION key (Privy signMessage over the eddsa-jcs-2022 hashData)',
    'the Trust Anchor signs a fresh status statement for each credential',
    'LOCAL verification with the same seven named checks the TEE runs (sample challenge; stage 44 uses fresh ones)',
  ],
  sponsors: ['Privy (holder + issuer signatures)'],
  mode: 'SPONSOR LIVE (non-spending)',
  expected:
    'both presentations pass all seven checks; a replay with another challenge fails HOLDER_PROOF_VALID',
  async run(ctx) {
    const { investors } = ctx.services;
    const trustAnchor = need('DEMO_TRUST_ANCHOR_DID', '11-admit-root-trust-anchor.sh');
    const offeringId = need('DEMO_OFFERING_ID', '31-create-offering-policy.sh');
    const acceptedIssuers = await investors.acceptedIssuers(trustAnchor);
    const out = [];
    for (const { label, did } of investorsFromState()) {
      const challenge = `sample-${Date.now()}`;
      const vp = await investors.present({ investor: did, challenge, domain: offeringId });
      const status = await investors.statusStatement(did);
      const holderKey = await ctx.uow.run(async (p) => {
        const doc = (await p.didState.resolve(did))?.document;
        const vm = doc?.verificationMethod.find((v) => v.id === doc.authentication?.[0]);
        return { verificationMethod: vm!.id, publicKeyMultibase: vm!.publicKeyMultibase };
      });
      const common = {
        holderKey,
        domain: offeringId,
        credentialType: INVESTOR_ELIGIBILITY_CREDENTIAL,
        acceptedIssuers,
        status,
        maxStatusAgeSeconds: 600,
        now: new Date(),
      };
      const valid = verifyPresentation({ ...common, presentation: vp, challenge });
      const replay = verifyPresentation({
        ...common,
        presentation: vp,
        challenge: 'another-request',
      });
      const entry = {
        investor: `Investor ${label}`,
        holder: vp.holder,
        presentation: {
          type: vp.type,
          credentials: vp.verifiableCredential.map((c) => c.id),
          proof: {
            proofPurpose: vp.proof.proofPurpose,
            verificationMethod: vp.proof.verificationMethod,
            challenge: vp.proof.challenge,
            domain: vp.proof.domain,
          },
        },
        statusStatement: {
          status: status.status,
          checkedAt: status.checkedAt,
          signedBy: status.proof.verificationMethod,
        },
        checks: valid.checks,
        replayWithAnotherChallenge: { valid: replay.valid, failed: replay.failed },
      };
      say(`Investor ${label} presentation`, entry);
      out.push(entry);
    }
    return {
      presentations: out,
      note: 'LOCAL verification; the decisive evaluation runs inside CRE (stage 44 / 82)',
    };
  },
};

export const checkOfferingEligibility: Stage = {
  id: '44-check-offering-eligibility',
  title: 'Catenor Protocol — Offering eligibility inside Chainlink CRE (confidential)',
  actor: 'Catenor (verifier) for the Sponsor offering',
  operation: `${OFFERING_ELIGIBILITY_POLICY_ID} → protocol Decision SUBSCRIBE_OFFERING per investor`,
  changes: [
    'fresh challenge per subscription; each investor presents its VP; the issuer signs a status statement',
    'ONE sealed CRE run: inside handlerInTee → VP holder proof, VC signature, issuer authority, subject, validity window, status, CURRENT Sumsub evidence, reconciliation, offering policy',
    'only minimized conclusions leave the TEE (decision, requirement statuses, check results, reconciliation class, commitment)',
    'Catenor records one protocol Decision per investor (Investor A 600 units, Investor B 400 units)',
  ],
  sponsors: ['Chainlink CRE (confidential)', 'Sumsub (sandbox)', 'Privy (signatures)'],
  mode: 'CONFIDENTIAL (CRE)',
  expected: 'Investor A ALLOW (600) · Investor B ALLOW (400)',
  async run(ctx) {
    await ctx.startConfidential();
    const sponsor = need('DEMO_SPONSOR_DID', '20-create-sponsor.sh');
    const offeringId = need('DEMO_OFFERING_ID', '31-create-offering-policy.sh');
    const list = investorsFromState();
    const { records, run } = await ctx.services.investors.evaluateOffering({
      sponsor,
      offeringId,
      subscriptions: list.map((i) => ({ investor: i.did, units: ALLOCATION[i.label] })),
    });
    const out = records.map((r, i) => ({
      investor: `Investor ${list[i]!.label}`,
      did: r.outcome.investor,
      units: r.units,
      decision: r.decision,
      decisionRef: r.id,
      decisionCommitment: r.decisionCommitment,
      trace: r.outcome.trace,
      presentationChecks: r.outcome.presentationChecks,
      reconciliation: r.outcome.reconciliation,
      reasonCodes: r.outcome.reasonCodes,
    }));
    say('offering decisions', out);
    return {
      offering: offeringId,
      confidentialRun: {
        mode: run.mode,
        runId: run.runId,
        status: run.status,
        evidenceCommitment: run.evidenceCommitment,
      },
      decisions: out,
    };
  },
};
