# ETHOnline 2026 — Catenor One Submission Checklist

> Working checklist. Recheck official ETHGlobal and sponsor requirements on submission day.

**Audited 2026-09-13** against the final run `c1-202609121659` (`artifacts/final-demo/RUN-LOG.md`) and the code.
The tests were re-run that day:

- `pnpm check` green: lint, typecheck, build, **428** unit tests, boundaries, secret scan;
- `pnpm test:integration` **118 / 118** on PostgreSQL;
- the workflow typecheck (`bunx tsc`) green.

Items still open say **Not done**, with the reason. This checklist predates the final demo and uses the earlier slice
numbering (S001–S008); the delivered scope is described in `docs/hackathon/demo/FINAL-DEMO.md` and `DEMO.md`.

## Repository & provenance

- [x] Catenor One repository visibility matches submission requirements (public; GitHub API, 2026-09-13).
- [x] Commit history clearly shows incremental hackathon development (153 commits since 2026-09-09).
- [x] README explains Catenor One vs Catenor Protocol.
- [x] `PROTOCOL-BASELINE.md` contains the exact protocol SHA (`66ef712694acfc987663f5ffa9bcc9d12d1fe80e`).
- [x] `AI_USAGE.md` is current (entry 2026-09-13).
- [x] `PROVENANCE.md` is current (§30, including the demo site and video assets).
- [x] `BUILD_LOG.md` is current (entry 2026-09-13).
- [x] Relevant prompts/plans are committed (`docs/hackathon/prompts/` 001–025, `docs/hackathon/plans/`).
- [x] S001 PLAN/TASKS and source-of-truth alignment are committed.
- [x] Official Chainlink skill installation/provenance is recorded (PROVENANCE §12; the Privy and Hedera skills in §25).
- [x] Imported/reused code/assets are documented (PROVENANCE §19–30).
- [x] No secrets/private keys are committed (`pnpm secret-scan`, 600 files, 2026-09-13).

## Current vertical-slice roadmap

- [x] S001 Trust Anchor Admission works end-to-end (stage 11 on the deployed CRE → ALLOW → endorsement →
      `TRUST_ANCHOR_VALID`).
- [ ] S002 Subject Continuity / Identity Provider Reconciliation works end-to-end. **Not done:** not started; out of
      the submission scope.
- [x] S003 Sponsor Authorization works end-to-end (stages 20–21: relationship plus 5 capabilities; DENY outside scope).
- [x] S004 Agent Delegation works end-to-end (stages 70–72: DENY → DENY with the relationship only → ALLOW with the
      delegation; `ACTION_NOT_DELEGABLE`).
- [x] S005 Investor Identity & Account Binding works end-to-end (stages 40–44; private Account Bindings; the payout goes
      to the bound account).
- [x] S006 Policy Decision works end-to-end (`policy:offering-eligibility:v1` and `policy:distribution-eligibility:v2`
      in the TEE; one protocol Decision per subject).
- [x] S007 Hedera Tokenization / Compliance Execution works end-to-end (6 testnet transactions, all SUCCESS).
- [x] S008 Audit & Explainability explains a completed action (hash chain valid, 79 events, stage 93; the reasons are
      shown in the console and in `history.html`).

## S001 P0 live path

- [ ] Privy operator email login works. **Not done:** the admission is operator-initiated (`DEMO.md` §11).
- [ ] Server-side bootstrap email allowlist works. **Not done:** the AC-001–003 access gate is not implemented.
- [x] Candidate `ORGANIZATION` receives a random `did:catenor`.
- [ ] DID Document resolves publicly without private provider data. **Not done:** the minimized DID Document is built
      and tested (`did-document.test.ts`: no PII, no provider data), but no public resolver endpoint exists; the API
      serves only health and the relay.
- [x] Dedicated Credential Assertion Key exists (Privy Ed25519 wallet under `P_ASSERT`).
- [x] Assertion key cannot act as the Financial Execution Key (`P_ASSERT` allows `signMessage` only; AC-S001-013 test).
- [x] Proof of Key Possession works (TV-S001-D01…D06).
- [x] Sumsub provider binding references are created before applicant IDs are attached.
- [x] Sumsub `externalUserId` binding mismatch fails closed (TV-E11: `BINDING_MISMATCH`, no facts, never ALLOW).
- [x] `identity-confidential` CRE workflow exists.
- [x] S001 uses the `trust-anchor-admission` operation/handler (`TRUST_ANCHOR_ADMISSION`).
- [x] S001 uses `handlerInTee`.
- [x] S001 uses exactly the required CRE persistent secrets (`SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`,
      `CATENOR_INTERNAL_API_TOKEN`).
- [x] Sumsub sandbox is called for real from the deployed confidential workflow (final demo 2026-09-12: stages
      11/42/44/82, `http-actions SendRequest` events) (`artifacts/chainlink/final-demo/deployed-run-c1-202609121659.md`).
- [x] Raw Sumsub responses are not persisted by Catenor (only facts and a commitment leave the TEE).
- [x] S001 uses commitment-only evidence retention (`COMMITMENT_ONLY` in the schema).
- [x] Deterministic verified facts are produced (6 facts in stage 11).
- [x] `policy:trust-anchor-admission:v1` produces deterministic ALLOW/DENY (golden `policyHash`; the determinism test).
- [x] Bootstrap endorsement is created only after ALLOW (integration: representative RED → DENY, endorsement refused).
- [x] Bootstrap endorsement binds `verificationMethodCommitment` (`endorsement.test.ts`, goldens).
- [x] Trust Anchor Admission Record is created.
- [x] Current ACTIVE status is clearly labeled as an operational projection (the verifier labels checks 11–12
      `OPERATIONAL_PROJECTION`).
- [x] Trust Anchor Admission provenance verifies (`TRUST_ANCHOR_VALID`, 12/12 checks, stage 93).
- [ ] S001 Judge Inspector shows a real happy path. **Not done as an inspector:** the replay console and
      `history.html` show the real admission from the run, replayed, with no live inspector (FD-8).
- [ ] S001 Judge Inspector shows a real/clearly-labeled DENY path. **Not done:** the S001 DENY paths are covered by
      tests and a simulation, not shown in the site.

## Negative paths

- [ ] Unauthorized bootstrap email rejected. **Not done:** no email gate (see above).
- [x] Wrong assertion-key proof rejected (TV-S001-D02; integration: immediate DENY, no confidential call).
- [x] Replayed/expired key-possession challenge rejected (TV-S001-D03, D04).
- [x] Provider binding mismatch rejected (TV-E11).
- [x] Missing required evidence fails closed (TV-S001-F10; no facts → DENY with every requirement MISSING).
- [x] Invalid/failed confidential provider verification never becomes ALLOW (representative RED → DENY; a result with
      another execution mode or with other evidence sources is rejected).
- [x] Any required Admission fact false → DENY (TV-S001-F06; stale evidence → DENY).
- [x] Missing required Admission fact → DENY, while trace distinguishes MISSING (TV-S001-F10).
- [x] Invalid bootstrap endorsement prevents activation (TV-S001-J04; a configuration that is not pinned fails, and so
      does its endorsement).
- [x] Verification Method/public-key replacement is detectable (TV-S001-J07).
- [x] Tampered Admission state fails verification (TV-S001-J02, J03).

## Catenor invariants

- [x] `did:catenor` contains no PII (random identifier; `did-document.test.ts`).
- [x] Wallet/account is not treated as canonical identity (wallets are private Account Bindings of a DID).
- [x] Provider identifier is not treated as canonical identity (private bindingRef as `externalUserId`).
- [ ] Subject Continuity reuses the existing canonical Subject when appropriate. **Not done:** S002.
- [ ] Ambiguous Subject Continuity does not auto-merge Subjects. **Not done:** S002.
- [x] Private Account Bindings are not exposed publicly by default (the `catenor_private` schema; never in the DID
      Document).
- [x] Private Provider Bindings are not exposed publicly by default.
- [x] DID Document exposes only appropriate public verification material.
- [x] Credential Assertion Key is distinct from Financial Execution Key (Ed25519 `P_ASSERT` keys vs EVM execution
      wallets).
- [x] Relationship is not treated as Capability (stage 71: the relationship alone → DENY `CAPABILITY_MISSING`).
- [x] Issuer authority is explicitly verified where applicable (the Trust Anchor's issuer key is pinned in the
      workflow config; `ISSUER_AUTHORIZED` is checked in the TEE).
- [ ] `ISSUE_CREDENTIAL` and `AUTHORIZE_ISSUER` are distinct. **Not done:** these actions are not modeled; issuer
      authority is the Trust Anchor key pinned per Trust Domain.
- [x] Delegated authority never exceeds delegator authority (`DELEGATION_EXCEEDS_DELEGATOR`, `ACTION_NOT_DELEGABLE`
      tests; stage 72).
- [x] Authority Chain is auditable (stage 93: Trust Anchor → Sponsor → Agent re-verified).
- [x] Policy Decision is distinct from Execution Authorization (Catenor Decision first, then the Privy policy; the HOLD
      holder got no signature request).
- [x] Database/index state is never treated as cryptographic proof by itself (the verifier labels each check's basis;
      `ARCHITECTURE.md` §9).

## Chainlink CRE evidence

- [x] `chainlink-cre-skill` usage/provenance is documented (AI_USAGE; PROVENANCE §12).
- [x] Confidential Workflows private-beta deployment enrollment is confirmed (the first deploy and 5 executions
      succeeded; no separate step was needed).
- [x] `cre init` / official confidential TypeScript scaffold is used (PROVENANCE §23).
- [x] `identity-confidential` builds successfully (`cre workflow build`; the deployed binary `9902db58…`; `bunx tsc`
      2026-09-13).
- [ ] Simulation happy path passes. Last passed 2026-09-11 (`pnpm test:cre-sim` 2/2, BUILD_LOG). **Re-run on
      2026-09-13 blocked by the environment:** the suite's Privy bootstrap wallet belongs to the earlier Privy app
      ("Wallet not found").
- [ ] Simulation DENY path passes. Same status as the happy path.
- [x] Real CRE deployment exists (`identity-confidential-production`, private registry; deploy #1 `00e12517…`,
      deploy #2 `0000e58d…`).
- [x] Workflow is activated/available according to the current CRE deployment model (Active; triggered via
      `01.gateway.zone-a.cre.chain.link`).
- [x] Real deployed `handlerInTee` execution is evidenced (5 executions, all SUCCESS; dashboard screenshots and CLI
      execution list).
- [x] Vault DON secret retrieval is evidenced without exposing values (`secrets_fetched` markers; successful
      authenticated Sumsub calls and signed callbacks).
- [x] Sumsub sandbox HTTPS calls execute inside the TEE (made from `handlerInTee` on the deployed workflow; enclave
      attestation not independently verified by Catenor).
- [x] Raw provider evidence does not cross the TEE as normal output.
- [x] Output is minimized to derived facts/commitments (plus coarse reason codes in the distribution plan).
- [ ] `reportFromDon` / offchain report verification is added if completed as P1. **Not done** (P1).
- [x] Simulation vs live deployment artifacts are clearly distinguished (the simulation-era artifacts open with a
      "superseded" note).
- [x] Logs/artifacts are under `artifacts/chainlink/`.

## Privy evidence

- [ ] Privy email authentication works. **Not done** (see S001 P0).
- [ ] Server verifies the authenticated operator identity/email. **Not done.**
- [x] Assertion signer spike confirms required signing semantics (T0.5: passed with the approved amendment D33–D35).
- [x] Organization Credential Assertion Key is independently verifiable (public key in the DID Document; credentials
      verified in the TEE against it).
- [x] Assertion signer policy blocks financial transaction signing/export where intended (`P_ASSERT`: signMessage only).
- [x] Separate bootstrap signing authority exists (`P_BOOTSTRAP` wallet with its own owner and quorum).
- [x] Key-purpose separation is demonstrated (Ed25519 assertion keys vs. EVM execution wallets; separate signer sets).
- [x] User wallet/account binding works in the later investor flow (the investors' receiving wallets are bound
      privately; the payout recipient comes from the binding).
- [x] Organization/institutional wallet exists where later execution requires it (SPV execution wallet).
- [x] Agent wallet/signer exists where later delegated execution requires it.
- [x] Wallet policies/limits/approvals demonstrated where applicable (Agent: `to` ∈ {A, B}, ≤ 20 HBAR; SPV rules
      pinned to the equity).
- [x] Relevant screenshots/logs are under `artifacts/privy/` (`final-demo/clean-room-c1-202609121659/`; screenshots in
      `artifacts/final-demo/screenshots/`).

## Hedera ATS evidence

- [x] Hedera ATS is integrated as the RWA tokenization/compliance/execution layer.
- [x] Real asset/SPV scenario is mapped to ATS (synthetic real-estate SPV, equity `C1SPV001`).
- [x] Tokenized asset is created/deployed on the required Hedera network for the selected prize (testnet
      `0.0.10510175`).
- [x] Catenor authorization/eligibility decision is connected to ATS lifecycle/compliance behavior (issuance only for
      TEE-backed offering ALLOW decisions; payout only for PAY holders).
- [x] At least one real ATS lifecycle operation is demonstrated (`grantRole` + `setDividend`, entitlements A 6 / B 4).
- [x] At least one unauthorized/ineligible operation is visibly blocked (Investor B HOLD: no transaction, no signature
      request).
- [x] Transaction/deployment evidence is preserved under `artifacts/hedera/` (`final-demo/clean-room-c1-202609121659.md`).
- [x] README explains Hedera ATS as execution/tokenization infrastructure, not canonical identity or authority (README
      rewritten 2026-09-13: per-sponsor evidence, HashScan links, how Privy improves the experience, no project
      contracts to verify).

## Subject Continuity evidence

**Not done: S002 was not started.** Every item below is out of the submission scope.

- [ ] `identity-confidential` supports the Subject Continuity operation if S002 is completed.
- [ ] Existing provider evidence and new provider evidence are compared privately.
- [ ] Provider-specific evidence is normalized inside the confidential boundary.
- [ ] Deterministic result is one of `MATCH`, `REVIEW`, `NO_MATCH`.
- [ ] Ambiguous evidence → `REVIEW`.
- [ ] `MATCH` reuses the existing `did:catenor`.
- [ ] `NO_MATCH` does not automatically create a new DID.
- [ ] Raw PII/provider reports do not leave the confidential boundary.
- [ ] Sumsub + Persona flow is demonstrated if both providers are integrated.

## Build quality

- [x] Lint passes (2026-09-13, after adding the static `apps/web/demo-site` to `.prettierignore`).
- [x] Typecheck passes.
- [x] Unit tests pass (428).
- [x] Application tests pass (the API module tests are in the unit and integration suites).
- [x] Integration tests pass (118 / 118, PostgreSQL via Testcontainers).
- [x] Contract tests pass where applicable (N/A: no project contracts; `contracts/` is empty).
- [ ] CRE workflow simulations pass. Last passed 2026-09-11; re-run blocked on 2026-09-13 (see Chainlink CRE
      evidence).
- [x] Build passes.
- [x] Railway deployment is reachable (`https://catenor-one-production.up.railway.app/v1/health`, 2026-09-12; API only —
      web not deployed).
- [x] Real CRE deployed workflow is reachable/invokable.
- [x] No unsafe demo bypass remains in judge path: the demo runners (`scripts/demo/`, `apps/api/scripts/demo/`)
      reference no FAKE adapter and no bypass flag, and an execution-mode guard rejects a result labeled with another
      mode (integration test).
- [x] Secret/privacy scan passes over repo and artifacts (`pnpm secret-scan`, 2026-09-13; screenshots redacted for
      investor DIDs and applicant IDs).

## Judge experience

- [x] Demo completes in a few minutes (the submission video is 3:32).
- [x] README contains exact demo steps (it links `DEMO.md` and the numbered `scripts/demo/`).
- [x] Product UI remains simple (the ten-step replay console).
- [x] Technical Judge Inspector exists for key slices (`history.html`: evidence per sponsor, the TEE decision, the run
      log). Static, with no live inspector.
- [x] Happy path is deterministic (pinned policy hashes; deterministic evaluation).
- [x] At least one compelling DENY path is shown live (Agent without capability; relationship ≠ capability; Investor B
      HOLD).
- [x] Audit/explanation view shows why action was allowed/denied (the console and `history.html` show the reasons:
      `CAPABILITY_MISSING`, `ACTION_NOT_DELEGABLE`, `HOLDER_PROOF_VALID` false, `SANCTIONS`/`FINAL`).
- [x] Database indexes are described as lookup/current-state projections, not proof.
- [x] Every sponsor claim is backed by real functionality or clearly labeled as planned/mock.
- [x] Sumsub sandbox is always labeled as sandbox.
- [x] Static Judge Inspector mock is not presented as live sponsor evidence (`artifacts/judges/s001/` is not linked from
      the README or the site).

## Submission materials

- [ ] Project name: **Catenor One**. (ETHGlobal form.)
- [ ] Short description finalized. (ETHGlobal form.)
- [ ] Long description finalized. (ETHGlobal form; reuse the README, including "How Privy improves the experience".)
- [ ] Chainlink prize selection finalized. (Best Confidential Workflow.)
- [ ] Privy prize selection finalized. (Both tracks; they count as one partner.)
- [ ] Hedera prize selection finalized. (Tokenization of Anything.)
- [x] World prize considered only if S004/S005 scope supports it without endangering core demo (considered: not
      selected; the limit is 3 partners).
- [x] Demo video recorded (submission: the console demo, 3:32, the maintainer's voice, no speed-up; supplementary: the
      technical evidence walkthrough, 3:25, same narration over the real terminals and dashboards). Uploaded:
      submission https://www.youtube.com/watch?v=EbxR1HgVIx0 · technical https://www.youtube.com/watch?v=X3nXRfowpfk;
      both linked from the README.
- [ ] Public deployment URL added. (The replay console on Vercel; then add it to the README and the form.)
- [ ] Repository URL added. (ETHGlobal form.)
- [ ] Catenor Protocol URL added. (ETHGlobal form.)
- [x] Screenshots/assets prepared (`artifacts/final-demo/screenshots/`).
- [ ] AI disclosure completed. (ETHGlobal form; source: `AI_USAGE.md`.)
- [ ] Provenance disclosure completed. (ETHGlobal form; source: `PROVENANCE.md`.)
- [x] Official submission requirements rechecked on submission day (the prizes and event-details pages, read
      2026-09-13).
