# ETHOnline 2026 — Catenor One Submission Checklist

> Working checklist. Recheck official ETHGlobal requirements on submission day.

## Repository & provenance

- [ ] Catenor One repository visibility matches submission requirements.
- [ ] Commit history clearly shows incremental development.
- [ ] README explains Catenor One vs Catenor Protocol.
- [ ] `PROTOCOL-BASELINE.md` contains the exact protocol SHA.
- [ ] `AI_USAGE.md` is current.
- [ ] `PROVENANCE.md` is current.
- [ ] `BUILD_LOG.md` is current.
- [ ] Relevant prompts/plans are committed.
- [ ] Imported/reused code/assets are documented.
- [ ] No secrets/private keys are committed.

## Demo completeness

- [ ] S001 Trust Anchor Admission works end-to-end.
- [ ] S002 Sponsor Authorization works end-to-end.
- [ ] S003 Agent Delegation works end-to-end.
- [ ] S004 Investor Identity / Subject Continuity works end-to-end.
- [ ] S005 Policy Decision works end-to-end.
- [ ] S006 Distribution works end-to-end.
- [ ] S007 Audit explains a completed action.

## Negative paths

- [ ] Invalid credential rejected.
- [ ] Revoked credential rejected.
- [ ] Unauthorized issuer rejected.
- [ ] Delegation exceeding scope rejected.
- [ ] Agent request above delegated limit rejected.
- [ ] Missing required evidence fails closed.
- [ ] Wallet execution policy can deny an otherwise valid initiator/request.
- [ ] Denied wallet request produces no signature / no transaction / no funds moved.

## Catenor invariants

- [ ] `did:catenor` contains no PII.
- [ ] Subject Continuity reuses existing canonical Subject when appropriate.
- [ ] Private Account Bindings are not exposed publicly by default.
- [ ] DID Document exposes only appropriate public verification material.
- [ ] Credential Assertion Key is distinct from Financial Execution Key.
- [ ] Relationship is not treated as Capability.
- [ ] Issuer authority is explicitly verified.
- [ ] `ISSUE_CREDENTIAL` and `AUTHORIZE_ISSUER` are distinct.
- [ ] Authority Chain is auditable.
- [ ] Policy Decision is distinct from Execution Authorization.

## Chainlink evidence

- [ ] Confidential workflow is real/runnable.
- [ ] Secrets/private inputs are protected.
- [ ] Public output is minimized.
- [ ] Credential verification/re-certification is demonstrated.
- [ ] Subject Continuity confidential evaluation is demonstrated if in final scope.
- [ ] Distribution confidential logic is demonstrated if in final scope.
- [ ] Deterministic guardrails produce final decision.
- [ ] Simulation/deployment logs are under `artifacts/chainlink/`.

## Privy evidence

- [ ] User wallet flow works.
- [ ] Organization/institutional wallet exists.
- [ ] Agent wallet/signer exists.
- [ ] Owners/signers configured.
- [ ] Policies/limits demonstrated.
- [ ] Quorum/approval behavior demonstrated if applicable.
- [ ] DENY case visibly blocked.
- [ ] Relevant screenshots/logs are under `artifacts/privy/`.

## Arc evidence

- [ ] USDC settlement path works.
- [ ] Investment/distribution transaction is demonstrable.
- [ ] Transaction evidence is under `artifacts/arc/`.
- [ ] README explains Arc as settlement, not identity/policy.

## Build quality

- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Contract tests pass where applicable.
- [ ] Workflow simulations pass.
- [ ] Build passes.
- [ ] Deployment is reachable.
- [ ] No unsafe demo bypass remains in judge path.

## Judge experience

- [ ] Demo completes in a few minutes.
- [ ] README contains exact demo steps.
- [ ] Judge/test credentials documented where safe.
- [ ] Happy path deterministic.
- [ ] At least one compelling DENY path.
- [ ] Audit view explains why action was allowed/denied.
- [ ] Every sponsor claim is backed by real functionality.

## Submission materials

- [ ] Project name: **Catenor One**.
- [ ] Short description finalized.
- [ ] Long description finalized.
- [ ] Partner prize selections finalized.
- [ ] Demo video recorded.
- [ ] Public deployment URL added.
- [ ] Repository URL added.
- [ ] Catenor Protocol URL added.
- [ ] Screenshots/assets prepared.
- [ ] AI disclosure completed.
- [ ] Provenance disclosure completed.
- [ ] Official submission requirements rechecked.
