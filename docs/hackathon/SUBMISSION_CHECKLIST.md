# ETHOnline 2026 — Catenor One Submission Checklist

> Working checklist. Recheck official ETHGlobal and sponsor requirements on submission day.

## Repository & provenance

- [ ] Catenor One repository visibility matches submission requirements.
- [ ] Commit history clearly shows incremental hackathon development.
- [ ] README explains Catenor One vs Catenor Protocol.
- [ ] `PROTOCOL-BASELINE.md` contains the exact protocol SHA.
- [ ] `AI_USAGE.md` is current.
- [ ] `PROVENANCE.md` is current.
- [ ] `BUILD_LOG.md` is current.
- [ ] Relevant prompts/plans are committed.
- [ ] S001 PLAN/TASKS and source-of-truth alignment are committed.
- [ ] Official Chainlink skill installation/provenance is recorded.
- [ ] Imported/reused code/assets are documented.
- [ ] No secrets/private keys are committed.

## Current vertical-slice roadmap

- [ ] S001 Trust Anchor Admission works end-to-end.
- [ ] S002 Subject Continuity / Identity Provider Reconciliation works end-to-end.
- [ ] S003 Sponsor Authorization works end-to-end.
- [ ] S004 Agent Delegation works end-to-end.
- [ ] S005 Investor Identity & Account Binding works end-to-end.
- [ ] S006 Policy Decision works end-to-end.
- [ ] S007 Hedera Tokenization / Compliance Execution works end-to-end.
- [ ] S008 Audit & Explainability explains a completed action.

## S001 P0 live path

- [ ] Privy operator email login works.
- [ ] Server-side bootstrap email allowlist works.
- [ ] Candidate `ORGANIZATION` receives a random `did:catenor`.
- [ ] DID Document resolves publicly without private provider data.
- [ ] Dedicated Credential Assertion Key exists.
- [ ] Assertion key cannot act as the Financial Execution Key.
- [ ] Proof of Key Possession works.
- [ ] Sumsub provider binding references are created before applicant IDs are attached.
- [ ] Sumsub `externalUserId` binding mismatch fails closed.
- [ ] `identity-confidential` CRE workflow exists.
- [ ] S001 uses the `trust-anchor-admission` operation/handler.
- [ ] S001 uses `handlerInTee`.
- [ ] S001 uses exactly the required CRE persistent secrets unless an approved change is documented.
- [ ] Sumsub sandbox is called for real from the deployed confidential workflow.
- [ ] Raw Sumsub responses are not persisted by Catenor.
- [ ] S001 uses commitment-only evidence retention.
- [ ] Deterministic verified facts are produced.
- [ ] `policy:trust-anchor-admission:v1` produces deterministic ALLOW/DENY.
- [ ] Bootstrap endorsement is created only after ALLOW.
- [ ] Bootstrap endorsement binds `verificationMethodCommitment`.
- [ ] Trust Anchor Admission Record is created.
- [ ] Current ACTIVE status is clearly labeled as an operational projection.
- [ ] Trust Anchor Admission provenance verifies.
- [ ] S001 Judge Inspector shows a real happy path.
- [ ] S001 Judge Inspector shows a real/clearly-labeled DENY path.

## Negative paths

- [ ] Unauthorized bootstrap email rejected.
- [ ] Wrong assertion-key proof rejected.
- [ ] Replayed/expired key-possession challenge rejected.
- [ ] Provider binding mismatch rejected.
- [ ] Missing required evidence fails closed.
- [ ] Invalid/failed confidential provider verification never becomes ALLOW.
- [ ] Any required Admission fact false → DENY.
- [ ] Missing required Admission fact → DENY, while trace distinguishes MISSING.
- [ ] Invalid bootstrap endorsement prevents activation.
- [ ] Verification Method/public-key replacement is detectable.
- [ ] Tampered Admission state fails verification.

## Catenor invariants

- [ ] `did:catenor` contains no PII.
- [ ] Wallet/account is not treated as canonical identity.
- [ ] Provider identifier is not treated as canonical identity.
- [ ] Subject Continuity reuses the existing canonical Subject when appropriate.
- [ ] Ambiguous Subject Continuity does not auto-merge Subjects.
- [ ] Private Account Bindings are not exposed publicly by default.
- [ ] Private Provider Bindings are not exposed publicly by default.
- [ ] DID Document exposes only appropriate public verification material.
- [ ] Credential Assertion Key is distinct from Financial Execution Key.
- [ ] Relationship is not treated as Capability.
- [ ] Issuer authority is explicitly verified where applicable.
- [ ] `ISSUE_CREDENTIAL` and `AUTHORIZE_ISSUER` are distinct.
- [ ] Delegated authority never exceeds delegator authority.
- [ ] Authority Chain is auditable.
- [ ] Policy Decision is distinct from Execution Authorization.
- [ ] Database/index state is never treated as cryptographic proof by itself.

## Chainlink CRE evidence

- [ ] `chainlink-cre-skill` usage/provenance is documented.
- [ ] Confidential Workflows private-beta deployment enrollment is confirmed.
- [ ] `cre init` / official confidential TypeScript scaffold is used.
- [ ] `identity-confidential` builds successfully.
- [ ] Simulation happy path passes.
- [ ] Simulation DENY path passes.
- [ ] Real CRE deployment exists.
- [ ] Workflow is activated/available according to the current CRE deployment model.
- [ ] Real deployed `handlerInTee` execution is evidenced.
- [ ] Vault DON secret retrieval is evidenced without exposing values.
- [ ] Sumsub sandbox HTTPS calls execute inside the TEE.
- [ ] Raw provider evidence does not cross the TEE as normal output.
- [ ] Output is minimized to derived facts/commitments.
- [ ] `reportFromDon` / offchain report verification is added if completed as P1.
- [ ] Simulation vs live deployment artifacts are clearly distinguished.
- [ ] Logs/artifacts are under `artifacts/chainlink/`.

## Privy evidence

- [ ] Privy email authentication works.
- [ ] Server verifies the authenticated operator identity/email.
- [ ] Assertion signer spike confirms required signing semantics.
- [ ] Organization Credential Assertion Key is independently verifiable.
- [ ] Assertion signer policy blocks financial transaction signing/export where intended.
- [ ] Separate bootstrap signing authority exists.
- [ ] Key-purpose separation is demonstrated.
- [ ] User wallet/account binding works in the later investor flow.
- [ ] Organization/institutional wallet exists where later execution requires it.
- [ ] Agent wallet/signer exists where later delegated execution requires it.
- [ ] Wallet policies/limits/approvals demonstrated where applicable.
- [ ] Relevant screenshots/logs are under `artifacts/privy/`.

## Hedera ATS evidence

- [ ] Hedera ATS is integrated as the RWA tokenization/compliance/execution layer.
- [ ] Real asset/SPV scenario is mapped to ATS.
- [ ] Tokenized asset is created/deployed on the required Hedera network for the selected prize.
- [ ] Catenor authorization/eligibility decision is connected to ATS lifecycle/compliance behavior.
- [ ] At least one real ATS lifecycle operation is demonstrated.
- [ ] At least one unauthorized/ineligible operation is visibly blocked.
- [ ] Transaction/deployment evidence is preserved under `artifacts/hedera/`.
- [ ] README explains Hedera ATS as execution/tokenization infrastructure, not canonical identity or authority.

## Subject Continuity evidence

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

- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Unit tests pass.
- [ ] Application tests pass.
- [ ] Integration tests pass.
- [ ] Contract tests pass where applicable.
- [ ] CRE workflow simulations pass.
- [ ] Build passes.
- [x] Railway deployment is reachable (`https://catenor-one-production.up.railway.app/v1/health`, 2026-09-12; API only — web not deployed).
- [ ] Real CRE deployed workflow is reachable/invokable.
- [ ] No unsafe demo bypass remains in judge path.
- [ ] Secret/privacy scan passes over repo and artifacts.

## Judge experience

- [ ] Demo completes in a few minutes.
- [ ] README contains exact demo steps.
- [ ] Product UI remains simple.
- [ ] Technical Judge Inspector exists for key slices.
- [ ] Happy path is deterministic.
- [ ] At least one compelling DENY path is shown live.
- [ ] Audit/explanation view shows why action was allowed/denied.
- [ ] Database indexes are described as lookup/current-state projections, not proof.
- [ ] Every sponsor claim is backed by real functionality or clearly labeled as planned/mock.
- [ ] Sumsub sandbox is always labeled as sandbox.
- [ ] Static Judge Inspector mock is not presented as live sponsor evidence.

## Submission materials

- [ ] Project name: **Catenor One**.
- [ ] Short description finalized.
- [ ] Long description finalized.
- [ ] Chainlink prize selection finalized.
- [ ] Privy prize selection finalized.
- [ ] Hedera prize selection finalized.
- [ ] World prize considered only if S004/S005 scope supports it without endangering core demo.
- [ ] Demo video recorded.
- [ ] Public deployment URL added.
- [ ] Repository URL added.
- [ ] Catenor Protocol URL added.
- [ ] Screenshots/assets prepared.
- [ ] AI disclosure completed.
- [ ] Provenance disclosure completed.
- [ ] Official submission requirements rechecked on submission day.
