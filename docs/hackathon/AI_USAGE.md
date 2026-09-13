# AI Usage — ETHOnline 2026

> Catenor One uses AI-assisted development as part of a human-directed, spec-driven engineering workflow.

**Status:** Living document  
**Last updated:** 2026-09-13

## Principles

AI is used to accelerate:
- protocol discussion and review;
- software architecture;
- specification drafting;
- implementation planning;
- coding;
- tests;
- security review;
- documentation;
- visual/design exploration.

The human maintainer remains responsible for:
- protocol decisions;
- project scope;
- architecture approval;
- acceptance criteria;
- review of generated code;
- merge decisions;
- submission claims.

AI-generated output is never treated as automatically correct.

## ChatGPT

Used for:
- Catenor Protocol architecture discussion;
- DID / VC / VP explanations;
- Subject Continuity design;
- authority, Capability, Delegation, and Trust Anchor Admission design;
- privacy and key-purpose-separation design;
- Catenor Protocol Draft v0.1 documentation;
- Catenor One project architecture;
- vertical-slice / spec-driven workflow design;
- security and negative-path reasoning;
- website/documentation UX direction;
- naming research;
- branding exploration and generated visual assets;
- provenance and hackathon documentation.

Human direction included:
- selecting Catenor Protocol;
- selecting `did:catenor`;
- accepting/rejecting architecture proposals;
- correcting privacy/account-binding assumptions;
- defining the separation between protocol and reference implementation;
- selecting Catenor One;
- selecting the brand direction;
- approving slices and implementation direction.

## Claude Code

Used for:
- repository inspection;
- S001 implementation planning from approved SPEC / ACCEPTANCE / TEST-VECTORS;
- generation and revision of `PLAN.md` / `TASKS.md`;
- test-vector traceability checks;
- S001 source-of-truth consistency cleanup;
- current sponsor/provider documentation review during planning.

Planned for:
- coding;
- integration work;
- tests;
- refactoring;
- build/lint/typecheck fixes;
- CRE implementation through a scoped `cre-engineer` subagent;
- deployment/debugging support;
- consistency checks.

Claude Code must:
- follow `CLAUDE.md`;
- follow the pinned protocol baseline;
- not silently redefine protocol semantics;
- not finalize open protocol decisions without approval;
- preserve AI/provenance artifacts;
- validate before claiming work complete.

## AI-generated visual assets

AI image generation has been used to explore Catenor branding and social/visual assets.

Selected assets are human-reviewed.

Generated visual concepts do not define protocol semantics.

When an AI-generated asset is committed, record it in `PROVENANCE.md`.

## Spec-driven AI workflow

```text
Human intent
    ↓
Slice SPEC
    ↓
AI-assisted PLAN
    ↓
Human approval
    ↓
AI-assisted implementation
    ↓
Acceptance tests
    ↓
Human review
    ↓
Commit
```

Prompts and plans live under:

```text
docs/hackathon/prompts/
docs/hackathon/plans/
slices/<slice>/
```

## Not delegated to AI

AI does not independently decide:
- protocol governance;
- legal conclusions;
- hackathon eligibility claims;
- final authority/compliance policy;
- acceptable vulnerabilities;
- production security assumptions;
- submission facts.

## Logging policy

For substantial AI-assisted work, record:

```text
date
AI tool
goal
prompt or prompt summary
plan/spec used
files/areas affected
human review notes
commit SHA when available
```

Do not fabricate missing transcripts.

If exact prompt text is unavailable, label it `Prompt summary`.

## Official sponsor skills / agent tooling

### Chainlink CRE skill

Installed in project scope:

```text
smartcontractkit/chainlink-agent-skills
└── chainlink-cre-skill v0.0.22
```

Canonical project path:

```text
.agents/skills/chainlink-cre-skill
```

Claude Code path:

```text
.claude/skills/chainlink-cre-skill
```

Purpose:

- current CRE CLI guidance;
- official scaffolding;
- Confidential Workflows;
- `handlerInTee`;
- `TeeRuntime`;
- secrets;
- HTTP inside TEE;
- simulation;
- deployment;
- activation;
- execution inspection.

Rule:

> The sponsor skill helps implement adapters/workflows. It does not define Catenor identity, authority, delegation or policy semantics.

Current live Chainlink documentation must be consulted where it differs from the installed skill.

### Project-specific `cre-engineer` subagent

Created 2026-09-10 (TASKS T0.6); preloads `chainlink-cre-skill` through the Claude Code subagent `skills:` frontmatter field. Project subagent:

```text
.claude/agents/cre-engineer.md
```

It will load the official `chainlink-cre-skill`.

Allowed scope:

```text
CRE CLI
cre init / official scaffolding
QuickJS/WASM compatibility
handlerInTee / TeeRuntime
secrets
simulation
deployment
activation
debugging
```

Forbidden scope:

```text
redefining Catenor Protocol
changing canonical identity semantics
changing authority/delegation semantics
changing approved policies
changing S001 requirements
```

The main Claude context and the human maintainer retain authority over protocol/application design.

### Privy and Hedera official skills + `privy-engineer` / `hedera-engineer` subagents (2026-09-11)

Official sponsor skills installed in project scope (skills CLI 1.5.25, copied into `.claude/skills/`, recorded in `skills-lock.json`):

```text
privy                                   ← https://docs.privy.io (well-known endpoint)
hedera-hackathon-submission-validator   ← hedera-dev/hedera-skills, hackathon-helper plugin
hedera-hackathon-prd                    ← hedera-dev/hedera-skills, hackathon-helper plugin
hts-system-contract                     ← hedera-dev/hedera-skills, system-contracts plugin
```

Project subagents, built on the same pattern as `cre-engineer`:

```text
.claude/agents/privy-engineer.md   preloads: privy
.claude/agents/hedera-engineer.md  preloads: hedera-hackathon-submission-validator, hedera-hackathon-prd, hts-system-contract
```

Allowed scope:

- `privy-engineer`: Privy wallets, authorization keys, owners and additional signers, policies, EVM/Solana signing, server-wallet transactions, live Privy tests.
- `hedera-engineer`: Hedera testnet, JSON-RPC relay, Mirror Node, ATS contracts through the typechain bindings with ethers v6, receipts, prize-requirement checks.

Forbidden scope for both, the same as `cre-engineer`:

- redefining Catenor identity, authority, capability, delegation or policy semantics;
- broadcasting a live transaction without explicit maintainer authorization;
- reading or printing secrets;
- silently falling back to a raw private key.

Rule:

> Catenor decides authority. Privy constrains wallet execution. Hedera executes only after Catenor authorization.

No Privy or Hedera MCP server is configured. The Hedera skills do not cover Asset Tokenization Studio, so the ATS contract types and the testnet stay the references for ATS work.

## 2026-09-10 S001 planning record

Claude Code created and revised S001 `PLAN.md` / `TASKS.md` from the approved source-of-truth documents.

ChatGPT was used to review the generated plan with the human maintainer and identify amendments including:

```text
identity-confidential workflow boundary
removal of the LLM from S001
COMMITMENT_ONLY evidence retention
provider-binding sequence correction
P0 Fast Lane
narrower verification claims
```

Claude Code then aligned S001 SPEC / ACCEPTANCE / TEST-VECTORS with those approved decisions.

No production code had been written at the completion of this planning/source-of-truth phase.

## 2026-09-10 S001 Phase 0 technical-validation record

New usage category: **AI-executed technical spikes through a scoped sponsor-skill subagent.**

```text
Claude Code main session
→ created .claude/agents/cre-engineer.md (loads the official chainlink-cre-skill)
→ delegated the CRE runtime spike (two runs, simulation only) to cre-engineer
   (headless Claude Code sessions; deploy/secrets/key-link/login/git-write commands blocked)
→ delegated Sumsub documentation research to a general-purpose subagent
→ audited both spike transcripts against raw simulator output and corrected overstated conclusions
→ wrote sanitized findings under slices/S001-trust-anchor-admission/spikes/
```

Human direction: the maintainer defined the scope (Phase 0 items independent of the pending Privy decision), the STOP conditions and the no-fallback rule. The maintainer has not yet reviewed the results.

The subagent and the sponsor skill executed and reported; they did not change PLAN, TASKS, SPEC, protocol semantics or the crypto profile.

Prompt/plan: `docs/hackathon/prompts/2026-09-10-006-s001-phase0-cre-sumsub-spikes.md`, `docs/hackathon/plans/2026-09-10-005-s001-phase0-cre-sumsub-spikes.md`.

## 2026-09-10 S001 Phase 0 final review round

Claude Code applied the maintainer's final Phase 0 decisions to PLAN/TASKS and the S001 source of truth, then ran the documentation/traceability cross-check. The decisions were Q7 (bootstrap owner/runtime-signer separation), T0.6 approval, T0.7 approval with SIMULATION-CONFIRMED wording, and the key terminology clarification (2 Catenor Ed25519 signing keys + 4 Privy P-256 authorization keys).

While recording T0.7, Claude Code found that the spike had carried the sealed context as hex. The approved base64 transport is therefore recorded as APPROVED DESIGN, NOT YET SIMULATION-CONFIRMED rather than confirmed.

The T0.5 Privy spike earlier the same day was executed by the Claude Code main session with a documentation-only research subagent; no sponsor agent was involved. The human maintainer made every decision (T0.5 amendment, Q4–Q7, D31–D37); AI tools executed, measured and reported.

## 2026-09-11 — Hackathon Delivery Mode implementation

Claude Code main session implemented the S001 vertical path in small checkpoints (persistence, orchestration, Privy adapters, the confidential workflow's Catenor semantics, API channel, tests). The `cre-engineer` project subagent was used again in a headless Claude Code session (same pattern as Phase 0: official `chainlink-cre-skill` preloaded; deploy/activate/update/pause/delete, `cre secrets`, key linking, login/logout, git writes and `.env` reads blocked at the tool-permission layer) for the official scaffold, the CRE runtime wiring and the base64 sealed-context simulation suite. The main session reviewed its output against the transcript and the simulator logs before integrating. The maintainer made every scope and semantic decision (D38, D39, Part B scope).

## 2026-09-11 — Final demo, checkpoint 1 (Privy → Hedera compatibility)

The main session delegated sponsor mechanics to the `privy-engineer` and `hedera-engineer` project subagents, each in a headless Claude Code session. Git writes and reads of `.env` and the key directory were blocked at the tool-permission layer.

- `privy-engineer` provisioned a live SPV EVM wallet, policy and key quorum on the Privy development app and tested policy-constrained signing for chain 296. It sent no transaction.
- `hedera-engineer` did read-only testnet estimation and a prize-requirement review.

The main session audited both transcripts and re-ran the Hedera read-only check. Catenor semantics (the story, custody pattern, resource names and capability issuer) stayed with the main session and the maintainer. Prompt: `docs/hackathon/prompts/2026-09-11-009-final-ethonline-demo-story.md`.

Checkpoint 4 (same day): `privy-engineer` ran a live policy-capability probe on throwaway Privy resources: a function-level `issueByPartition` restriction and owner-authorized policy updates. The main session audited the probe scripts and re-ran the SDK wrapper check before writing the maintainer-run policy-update script. The maintainer decided the issuance-policy rule, the investor-wallet model and the STOP before any issuance broadcast.

Checkpoint 7 (same day):

- `privy-engineer` probed the Distribution Agent policy predicates live on throwaway resources.
- `cre-engineer` validated the new `INVESTOR_ELIGIBILITY` operation in `cre workflow simulate`: the existing suite plus investor cases with synthetic secrets, simulation only, forbidden commands blocked.
- The main session wrote the Catenor semantics: investor facts, the distribution-eligibility policy, the Agent capability and the plan. It also audited both subagents' outputs.
- The maintainer decided the FD-2 clarification, the issuance-integration requirement and the STOP before the Hedera lifecycle operation.

Checkpoint 8 (same day): `hedera-engineer` researched the ATS dividend lifecycle read-only against the deployed token and the package sources; `privy-engineer` probed the lifecycle policy rules live on throwaway resources. The main session wrote the signer-boundary checks, the preflight and the maintainer script, and audited both reports; one preflight expectation was corrected against the known CP1 Factory rule.

## 2026-09-12 — Clean-room runbook (prompt 2026-09-11-023)

- **Main session.** Wrote the Catenor semantics and the code:
  - VC/VP, relationships, delegation, offering;
  - the in-TEE operations;
  - the services and the stage runner;
  - `DEMO.md`.

  It also ran every non-spending stage live from zero and audited all subagent output.
- **`cre-engineer`** (headless; deploy / activate / secrets / login / git writes and `.env` reads blocked). It
  researched the current CLI commands and ran a throwaway simulation spike confirming Ed25519 verification inside
  `handlerInTee`. It also drafted the deployment scripts.
- **What the main session corrected** in that output:
  - the secrets command: the private registry needs `cre secrets create <secrets.yaml> --secrets-auth browser`;
  - the deploy command: it now uses a generated DEPLOYED config;
  - the gateway invocation, which the subagent had marked UNCERTAIN: taken from the Chainlink specification.
- **Maintainer.** Made the scope decisions and set the STOP gate before any new live broadcast.


## 2026-09-12 — Railway-ready API backend (prompt 2026-09-12-024)

- **Main session only**; no subagent.
- **What it did:**
  - inspected the API, Prisma, the CRE callback path and the environment usage (from code only; no `.env` file read);
  - wrote the inert entrypoint, the relay, the deployment files and `docs/deployment/RAILWAY.md`;
  - rehearsed the image, the manual migration and the relay locally in Docker with a throwaway Postgres and a
    throwaway token.
- **Maintainer decision.** Server plus CRE relay, chosen over health-only or route-only (AskUserQuestion). This was
  needed because investor-operation results are awaited in the local runner's memory.
- **External actions:** none. No Railway login, link or deploy, and no Privy, Sumsub, Hedera or CRE action.


## 2026-09-12 — Final demo on the deployed CRE workflow (prompt 2026-09-12-025)

**Main session only; no subagent.**

**New usage category: an AI co-operator in a live, maintainer-run demo.** The maintainer ran every stage and
confirmed every live action. Claude Code:

- **reviewed each output** against the expected result, and stopped the flow on every failure;
- **diagnosed failures from evidence**:
  - the gateway's error body;
  - the documentation;
  - the strings of the CLI binary;
  - a local simulation of the deployed config;
  - a control workflow the maintainer deployed;
  - mirror-node reads;
- **patched the runner** between stages, each change with a test or check, and committed it locally;
- **kept the public record:** the run log, the screenshot gallery with redacted investor DIDs and applicant IDs, and
  the sponsor evidence;
- **drafted the sponsor community posts** and the video plan, and **read the ETHGlobal submission rules** live.

**One mistake, corrected in the session.** A wrong Desktop file (an unredacted Sumsub screenshot) was briefly
committed. The commit was removed from local history before any push.


## 2026-09-13 — Demo site, video and submission preparation

- **Demo site and video.** Claude Code subagents wrote `apps/web/demo-site/` (the replay console and the evidence
  site) and the video tooling in `docs/hackathon/demo/video/`, under the maintainer's direction. The site shows only
  public-safe data from the committed artifacts. Both videos are narrated in the maintainer's own voice: no AI voice and
  no speed-up, as the ETHGlobal rules require. Details and asset sources are in `PROVENANCE.md` §30.
- **Submission check (main session only).** Claude Code:
  - read the ETHOnline 2026 prize requirements live and checked each selected prize against the repository;
  - rewrote `README.md`;
  - marked the simulation-era artifacts as superseded, without changing their evidence labels;
  - audited `SUBMISSION_CHECKLIST.md` against the final run, re-running `pnpm check` and `pnpm test:integration`.

  The maintainer decides the prize selection and the submission text.
