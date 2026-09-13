# Provenance — Catenor One / ETHOnline 2026

> Records the origin of code, specifications, assets, dependencies, and prior work used by Catenor One.

**Status:** Living document  
**Last updated:** 2026-09-10

---

## 1. Protocol design began during ETHOnline before the public repository existed

Catenor Protocol was not imported as a completed pre-hackathon project.

Protocol-design work began on **2026-09-04**, after ETHOnline had already started.

From 2026-09-04 through 2026-09-09, the protocol was iteratively designed around:

- W3C DID concepts;
- canonical identity independent from wallets;
- Subject Continuity;
- Account Bindings;
- Verifiable Credentials and Presentations;
- Relationships;
- Capabilities;
- Delegation;
- Authority Chains;
- issuer authorization;
- Trust Anchor Admission;
- policy-based decisions;
- confidential verification;
- key-purpose separation;
- public vs private identity state;
- auditability.

The design evolved through human-directed research, architecture work, iterative discussion, written specifications, diagrams, and AI-assisted drafting/review.

### Public-repository timing

The public Catenor Protocol repository was created after several days of this design work.

Therefore:

> **The initial large public protocol commit is a consolidation/publication commit, not the start date of the protocol-design work.**

Earlier design history is documented in:

```text
docs/hackathon/BUILD_LOG.md
docs/hackathon/AI_USAGE.md
docs/hackathon/prompts/
docs/hackathon/plans/
```

This history is documented explicitly rather than by backdating or rewriting Git commits.

---

## 2. Earlier working-name repository and scaffold

During the protocol-design phase, a local experimental repository used an earlier working identity/project name.

That repository was used to organize design and hackathon work such as:

```text
apps/
packages/
confidential workflows/
identity docs/
authority docs/
policy docs/
schemas/
tests/
AI/provenance artifacts/
```

The protocol later evolved substantially and was separated into the standalone, vendor-neutral **Catenor Protocol** repository.

For Catenor One:

> **The useful repository-organization ideas were recreated in a new implementation scaffold.**

The old working-name protocol specification is not the Catenor One semantic source of truth.

Old identifier terminology must not be introduced into Catenor One as canonical Catenor behavior.

If actual implementation code is later copied from the earlier experimental repository, that reuse must be recorded here with the exact files, origin, date, and eligibility/license review.

---

## 3. Catenor One repository

Catenor One is a new reference-implementation repository created for ETHOnline 2026.

It began as an empty scaffold with:

```text
apps/
packages/
workflows/
contracts/
artifacts/
slices/
docs/
schemas/
test-vectors/
tests/
scripts/
```

No production slice implementation existed in the new repository at scaffold creation.

Catenor One is intentionally separated from the protocol repository:

```text
Catenor Protocol
= specification / protocol source of truth

Catenor One
= ETHOnline reference implementation
```

---

## 4. Catenor Protocol

Catenor One implements **Catenor Protocol**, maintained in a separate public repository:

```text
https://github.com/luizoamorim/catenor
https://catenor.xyz
```

Pinned protocol commit:

```text
66ef712694acfc987663f5ffa9bcc9d12d1fe80e
```

The exact protocol baseline is recorded in:

```text
docs/PROTOCOL-BASELINE.md
```

Catenor Protocol is specification/reference material, not copied product implementation code.

---

## 5. AI-assisted work

AI assistance is documented in:

```text
docs/hackathon/AI_USAGE.md
docs/hackathon/prompts/
docs/hackathon/plans/
docs/hackathon/BUILD_LOG.md
```

AI has been used for:

- architecture discussion;
- research support;
- specification drafting;
- data-model review;
- implementation planning;
- security reasoning;
- documentation;
- visual/design exploration;
- coding assistance.

The human maintainer remains responsible for protocol decisions, architecture approval, review, implementation acceptance, commits, and submission claims.

---

## 6. Generated visual assets

Catenor branding/visual exploration used AI image generation.

Any generated asset committed to Catenor One should be listed with:

```text
filename
date
tool
human selection/modification notes
```

---

## 7. Sponsor / third-party SDKs

For meaningful integrations record:

```text
name
source package/repository
version/commit where practical
license
date introduced
what was reused
what Catenor One implemented
```

Do not copy third-party source without license review.

---

## 8. Open-source dependencies

Preserve package lockfiles, package metadata, and licenses where required.

Major architectural dependencies should be recorded in integration docs.

---

## 9. Copy/paste rule

Do not copy code from prior projects, blogs, repositories, other hackathon projects, or third-party examples without reviewing eligibility/license/provenance implications.

When reused, record the source.

---

## 10. From-scratch evidence

Preserve incremental evidence through:

```text
small Git commits
slice specifications
plans
tasks
test vectors
build logs
AI prompts
simulation artifacts
integration artifacts
transaction evidence
```

For protocol design performed before the public repository existed, contemporaneous notes, chat history, design artifacts, local repository structure, and generated documentation provide additional chronology.

---

## 11. Entry template

```md
### YYYY-MM-DD — <artifact/dependency>

Type:
Source:
Version / commit:
License:
Introduced by:
Purpose:
Files affected:
AI-assisted:
Human modifications:
Notes:
```
---

## 12. 2026-09-10 — Official Chainlink CRE agent skill

Type:

```text
Official sponsor skill / implementation reference
```

Source:

```text
smartcontractkit/chainlink-agent-skills
chainlink-cre-skill
```

Installed version:

```text
0.0.22
```

Installed in project scope through:

```text
npx skills add smartcontractkit/chainlink-agent-skills
```

Project paths:

```text
.agents/skills/chainlink-cre-skill
.claude/skills/chainlink-cre-skill -> ../../.agents/skills/chainlink-cre-skill
skills-lock.json
```

Purpose:

- CRE CLI/scaffolding guidance;
- Confidential Workflows implementation guidance;
- simulation/deployment guidance;
- QuickJS/WASM/runtime constraints;
- security-boundary guidance.

Reuse status:

> No production Catenor One implementation code was copied from the skill during the documentation/planning phase.

Current official live documentation is treated as authoritative if it conflicts with stale skill content.

License:

> Use is governed by the upstream repository/package terms. Review any copied source/example code separately before committing it as application code.

AI-assisted:

- Claude Code may load/use the skill.
- A Catenor One `cre-engineer` subagent is planned to use it under restricted responsibilities.

---

## 13. 2026-09-10 — Chainlink Confidential Workflow references

Type:

```text
Official documentation / educational reference
```

Sources consulted include:

```text
Chainlink CRE Confidential Workflows documentation
Chainlink CRE Confidential bootcamp
official CRE templates
official CRE CLI/SDK references
```

Purpose:

- understand `handlerInTee`;
- `TeeRuntime`;
- batched secret retrieval;
- HTTPS requests executed inside the TEE;
- simulation vs real deployment;
- deployment registries;
- workflow/runtime limits.

Reuse status:

> Architecture and implementation patterns were studied. Liquidation/demo-specific domain logic is not part of Catenor One.

If code is later copied/adapted from a template/example, record the exact source, commit/version, license and files affected.

---

## 14. 2026-09-10 — S001 AI-assisted planning artifacts

Type:

```text
AI-assisted specification / implementation planning
```

Sources:

```text
ChatGPT
Claude Code
approved Catenor Protocol baseline
Catenor One architecture baseline
official sponsor/provider documentation
```

Artifacts:

```text
slices/S001-trust-anchor-admission/SPEC.md
slices/S001-trust-anchor-admission/ACCEPTANCE.md
slices/S001-trust-anchor-admission/TEST-VECTORS.md
slices/S001-trust-anchor-admission/PLAN.md
slices/S001-trust-anchor-admission/TASKS.md
artifacts/judges/s001/
docs/hackathon/prompts/
docs/hackathon/plans/
```

Human role:

- selected/rejected architectural proposals;
- removed LLM from S001;
- selected commitment-only evidence retention;
- approved provider-binding sequencing;
- approved the `identity-confidential` CRE workflow boundary;
- approved the P0 Fast Lane;
- approved/refined the bootstrap endorsement and verification model.

No production S001 code existed at completion of this planning phase.

---

## 15. 2026-09-10 — S001 Judge Inspector visual artifact

Type:

```text
AI-assisted HTML visualization
```

Tool:

```text
ChatGPT
```

Purpose:

- visualize the Trust Anchor Admission flow;
- demonstrate happy/DENY scenarios conceptually;
- help judges inspect technical architecture separately from the simplified product UI.

Important limitation:

> The static HTML visualization is not itself evidence that Chainlink, Privy or Sumsub integration is deployed or live.

Live sponsor evidence must be stored separately under the relevant `artifacts/` directories.

---

## 16. 2026-09-10 — Hedera ATS selected as planned execution layer

Type:

```text
Architecture / sponsor-integration decision
```

Decision:

```text
Hedera Asset Tokenization Studio
→ planned tokenized RWA lifecycle/compliance/execution layer
```

Current Catenor One integration roles:

```text
Chainlink CRE Confidential
→ private verification/computation

Catenor
→ canonical identity, authority, delegation and policy

Privy
→ authentication, wallets/signers/execution controls

Hedera ATS
→ tokenized asset lifecycle/compliance/execution
```

Arc was explored earlier but is no longer the primary hackathon execution/settlement target.

Reuse status:

> No Hedera ATS implementation code had been imported at the time of this decision. Any SDK/template/code introduced later must be recorded with source/version/license.

---

## 17. 2026-09-10 — Current slice sequence

The implementation roadmap was revised before downstream slices were implemented:

```text
S001 Trust Anchor Admission
S002 Subject Continuity / Identity Provider Reconciliation
S003 Sponsor Authorization
S004 Agent Delegation
S005 Investor Identity & Account Binding
S006 Policy Decision
S007 Hedera Tokenization / Compliance Execution
S008 Audit & Explainability
```

The renumbering affects not-yet-implemented slices only.

S001 remains the first implementation slice.

---

## 18. 2026-09-10 — `cre-engineer` project subagent

Type:

```text
Project-authored Claude Code subagent definition (not a Chainlink-provided agent)
```

File:

```text
.claude/agents/cre-engineer.md
```

Source: written for Catenor One by Claude Code under maintainer instruction (PLAN §17.7, TASKS T0.6). It preloads the official `chainlink-cre-skill` (§12) through the Claude Code subagent `skills:` frontmatter field. No third-party text was copied into it.

---

## 19. 2026-09-10 — S001 Phase 0 CRE runtime spike tooling (scratch only, not committed)

Type:

```text
Official sponsor CLI / template / SDK + open-source libraries, used in a git-ignored spike
```

Used only under `scratch/` (git-ignored via `scratch/.gitignore`); **no file from the spike is committed and no spike code is imported by Catenor One**. Sanitized findings are committed in `slices/S001-trust-anchor-admission/spikes/T0.7-cre-runtime.md`.

| Item | Source | Version | License |
|---|---|---|---|
| CRE CLI | Chainlink (`~/.cre/bin/cre`) | v1.33.0 | Chainlink terms |
| `hello-confidential-workflows-ts` template | `smartcontractkit/cre-templates` (`starter-templates/hello-confidential-workflows`), fetched by `cre init` | branch `main`, fetched 2026-09-10 | per upstream repository |
| `@chainlink/cre-sdk` | npm (pinned by the template) | 1.18.0 | **BUSL-1.1** — official SDK required to build CRE workflows; license note to be carried into production use review (T8.1) |
| `@noble/hashes` | npm | 2.4.0 | MIT |
| `@noble/ciphers` | npm | 2.4.0 | MIT |
| `canonicalize` (RFC 8785 JCS) | npm | 5.0.0 | Apache-2.0 |
| `viem`, `zod`, `typescript` | npm (template dependencies) | 2.34.0, 3.25.76, 5.9.3 | MIT, MIT, Apache-2.0 |

Official documentation consulted: the pages listed in `slices/S001-trust-anchor-admission/PLAN.md` Appendix A.1 (service quotas, HTTP client TS reference, Confidential Workflows concepts/guide/client reference, TypeScript WASM runtime).

---

## 20. 2026-09-10 — Sumsub sandbox spike references (scratch only, not committed)

Type:

```text
Official provider documentation + locally written spike harness
```

Documentation: docs.sumsub.com (authentication, create-applicant, link-beneficiary-to-company-kyb-20, get-applicant-data, get-applicant-review-status, request-applicant-check, simulate-review-response-in-sandbox, get-additional-company-check-data, mock-company-data, rejection-labels, rate-limits, verify-businesses, how-business-verification-works, test-in-sandbox, app-tokens) and the official signing examples repository `github.com/SumSubstance/AppTokenUsageExamples` (now `github.com/sumsub/AppTokenUsageExamples`) — read only, no code copied.

Harness: `scratch/sumsub-spike/` (git-ignored), written from the documented request format using only Node built-ins. Findings (documentation evidence plus the live individual-applicant sandbox run of 2026-09-10) are committed in `slices/S001-trust-anchor-admission/spikes/T0.8-sumsub-sandbox.md`.

---

## 21. 2026-09-10 — S001 T0.5 Privy assertion-key spike tooling (scratch only, not committed)

| Item | Source | Version | License |
|---|---|---|---|
| `@privy-io/node` | npm (official Privy server SDK; `@privy-io/server-auth` is deprecated) | 0.34.0 | Apache-2.0 |
| `@noble/curves` | npm | 2.4.0 | MIT |
| `@scure/base` | npm | 2.4.0 | MIT |

Used only under `scratch/privy-spike/` (git-ignored) against a Privy development app with synthetic data; no spike code is imported by Catenor One. Official documentation consulted: docs.privy.io (list in `slices/S001-trust-anchor-admission/spikes/T0.5-privy-assertion-key.md` §1). Sanitized findings are committed in that file.

---

## 22. 2026-09-10 — S001 P0 foundation and domain packages: tooling, dependencies and vendored references

Introduced in the repository (first S001 implementation work; TASKS T1.1–T1.5, T2.1–T2.9).

| Item | Version | License | Where |
|---|---|---|---|
| pnpm (workspace) | 10.11.0 | MIT | root |
| Node.js (`.nvmrc`) | 24 | MIT | root |
| TypeScript | 6.0.3 | Apache-2.0 | root (7.x not used: typescript-eslint 8.70 supports TypeScript < 6.1) |
| Vitest | 5.0.0 | MIT | root |
| ESLint, @eslint/js, typescript-eslint, globals | 10.10.0, 10.0.1, 8.70.0, 17.12.0 | MIT | root |
| Prettier | 3.9.6 | MIT | root |
| dependency-cruiser | 18.2.0 | MIT | root (PLAN §2.3 boundaries) |
| ajv, ajv-formats | 8.20.0, 3.0.1 | MIT | test-vectors (tests only) |
| @types/node | 24.13.4 | MIT | root |
| @noble/hashes, @noble/curves, @scure/base | 2.4.0 | MIT | domain packages (D17 allowlist) |
| canonicalize (RFC 8785 JCS) | 5.0.0 | Apache-2.0 | packages/audit |
| GitHub Actions: actions/checkout, actions/setup-node, pnpm/action-setup | v7, v7, v6 | MIT | `.github/workflows/ci.yml` |

Vendored reference artifacts (unmodified, test inputs only):

- **Catenor Protocol JSON Schemas** (`policy`, `decision`, `audit-event`) copied byte-for-byte with `git show 66ef712694acfc987663f5ffa9bcc9d12d1fe80e:schemas/<name>.schema.json` into `schemas/catenor-protocol/66ef712694acfc987663f5ffa9bcc9d12d1fe80e/` (Apache-2.0, same maintainer; SHA-256 recorded there and checked by a test). **Maintainer approval recorded 2026-09-11** (CLAUDE.md "From-scratch discipline"): approved on the condition that the files stay unmodified copies of the pinned commit with hashes and provenance recorded.
- **RFC 8785 test data** (§3.2.2, §3.2.3, Appendix B) transcribed into `test-vectors/s001/rfc8785-jcs.json`.
- **W3C vc-di-eddsa Appendix B.3 (`eddsa-jcs-2022`) test vector** (Examples 29–39) extracted from https://www.w3.org/TR/vc-di-eddsa/ into `test-vectors/s001/w3c-vc-di-eddsa-jcs-2022.json`; the published test *secret* key is deliberately not copied (verification needs only public material).

No application code was copied from any prior project, template or third-party example. The domain packages are original Catenor One code written in this work session.

Golden-vector signing keys (2026-09-11): TEST-ONLY, NON-SECRET Ed25519 keys derived from public labels (`seed = SHA-256(UTF-8(label))`, `test-vectors/src/test-keys.ts`); they are not secrets and sign nothing outside test vectors.

T3.2 persistence dependencies (2026-09-11, `apps/api`):

| Item | Version | License | Where |
|---|---|---|---|
| prisma (CLI), @prisma/client, @prisma/adapter-pg | 7.10.0 | Apache-2.0 | apps/api (npm `latest` tag pointed at 8.0.0-rc.13; the stable 7.10.0 is pinned) |
| pg, @types/pg | 8.23.0, 8.23.1 | MIT | apps/api (dev; integration tests) |
| testcontainers, @testcontainers/postgresql | 12.1.0 | MIT | apps/api (dev; integration tests) |
| Docker image `postgres:17.11-alpine` | 17.11 | PostgreSQL License | integration tests only (T15.1 must confirm the Railway major version) |

pnpm build scripts of `prisma`, `@prisma/engines`, `cpu-features`, `ssh2`, `protobufjs` were left unapproved; the Prisma CLI fetches its schema engine on first use.

S001 vertical path dependencies (2026-09-11, `apps/api`): `@privy-io/node` 0.34.0 (Apache-2.0; official Privy server SDK, the version validated in the T0.5 spike, now a runtime dependency of the Privy signer adapters), `@noble/curves` 2.4.0 and `@scure/base` 2.4.0 (MIT; signer-boundary verification and address decoding). The Privy provisioning script is original code written for Catenor One; no SDK example code was copied.

Scratch-only review tooling for T3.1 (2026-09-11; not repository dependencies, not committed): Prisma CLI / `@prisma/client` 7.10.0 (Apache-2.0) for `validate`, `format` and offline `migrate diff`; PGlite 0.4.3 (`@electric-sql/pglite`, Apache-2.0) as a throwaway in-memory Postgres to syntax-check the draft CHECK constraints.

---

## 23. 2026-09-11 — `workflows/identity-confidential` (Chainlink CRE Confidential Workflow)

Type: official sponsor template + SDK, plus original Catenor One code.

| Item | Source | Version | License |
|---|---|---|---|
| `hello-confidential-workflows-ts` template | `smartcontractkit/cre-templates` (`starter-templates/hello-confidential-workflows`), fetched by `cre init` | branch `main`, fetched 2026-09-11 | per upstream repository |
| CRE CLI | Chainlink | v1.33.0 | Chainlink terms |
| `@chainlink/cre-sdk` | npm | 1.18.0 | **BUSL-1.1** — the official SDK required to build CRE workflows; production-use license review still to be done (T8.1 note) |
| `viem`, `zod` (template dependencies) | npm | 2.34.0, 3.25.76 | MIT, MIT |
| `@noble/ciphers`, `@noble/hashes` | npm | 2.4.0 | MIT |
| `canonicalize` (RFC 8785) | npm | 5.0.0 | Apache-2.0 |
| TypeScript (workflow) | npm | 5.9.3 (template pin) | Apache-2.0 |
| Bun (workflow package manager, used by the template) | bun.sh | 1.4.0 | MIT |
| `oven-sh/setup-bun` GitHub Action | GitHub | v2 | MIT |

Template-derived files: `main.ts`, `package.json`, `tsconfig.json`, `workflow.yaml`, `project.yaml`, `secrets.yaml` (all adapted). Written for Catenor One: `workflow.ts` router and `shared/*` (`cre-engineer` subagent), `src/trust-anchor-admission/*` semantics (main session), `fixtures/seal-context.mjs`, `test/*`. No other template or example code was copied.

Workflow package license set to Apache-2.0 (the template scaffold said `UNLICENSED`). The scaffold's unused `ethereum-mainnet` RPC entry was removed.

S001 demo tooling (2026-09-11, `apps/api` dev dependency): `tsx` 4.23.13 (MIT) runs the TypeScript demo command `pnpm demo:s001`.

---

## 24. 2026-09-11 — Hedera ATS testnet execution adapter (Part B)

| Item | Source | Version | License |
|---|---|---|---|
| `@hashgraph/asset-tokenization-contracts` (typechain bindings + Solidity sources) | npm / `hashgraph/asset-tokenization-studio` | 8.0.0 | Apache-2.0 |
| `ethers` | npm | 6.17.0 | MIT |

- Used by `apps/api/src/infrastructure/execution/hedera-ats-executor.ts`, which is original Catenor One code.
- The testnet factory and resolver addresses come from the ATS repository's `packages/ats/contracts/deployments/hedera-testnet` records.
  The documentation site's deployed-address page still lists v4.
- The role constant and ISIN check come from the package's `contracts/constants/roles.sol` and `contracts/factory/isinValidator.sol`.
  They were read to mirror the behavior; no Solidity was copied.
- The research that selected this path was done by a general-purpose Claude Code subagent. It checked current npm packages, the ATS repository and the live testnet with read-only `eth_call`s; its throwaway scripts stayed in the session scratchpad and none were committed.
- `@hashgraph/asset-tokenization-sdk` 8.0.0 was evaluated and not adopted. It has no server-side private-key wallet mode, and its ESM build does not import under Node.

---

## 25. 2026-09-11 — Official Privy / Hedera agent skills and project subagents

Type: official sponsor skills (instructions and reference documents for AI coding agents; no application code) plus project-authored Claude Code subagent definitions.

| Skill | Source | Installed with | Lock hash (`skills-lock.json`) | License |
|---|---|---|---|---|
| `privy` (`.claude/skills/privy/`) | `https://docs.privy.io` well-known skills endpoint (Mintlify-generated, frontmatter version 1.0) | `npx skills add https://docs.privy.io -a claude-code --project -y` | computed `078d8c23…`, well-known digest `sha256:a8bb782d…` | per Privy documentation terms |
| `hedera-hackathon-submission-validator` | `hedera-dev/hedera-skills` `plugins/hackathon-helper/skills/validate-submission` (commit `8b1fccd`) | `npx skills@latest add hedera-dev/hedera-skills --skill … -a claude-code --project -y` | `1031b8d9…` | Apache-2.0 |
| `hedera-hackathon-prd` | `hedera-dev/hedera-skills` `plugins/hackathon-helper/skills/hackathon-prd` (commit `8b1fccd`) | same | `04a27c0b…` | Apache-2.0 |
| `hts-system-contract` | `hedera-dev/hedera-skills` `plugins/system-contracts/skills/hts-system-contract` (commit `8b1fccd`) | same | `b955e168…` | Apache-2.0 |

- The skills CLI was 1.5.25.
- The skill contents are unmodified.
- Other `hedera-dev/hedera-skills` skills were deliberately not installed because they are not on the approved ATS + ethers path:
  - agent-kit;
  - native-services-js (HTS/HCS SDK);
  - oracles;
  - cross-chain;
  - harness;
  - dev-intelligence;
  - hiero-cli.

Project subagents `.claude/agents/privy-engineer.md` and `.claude/agents/hedera-engineer.md` were written for Catenor One by Claude Code under maintainer instruction (prompt `docs/hackathon/prompts/2026-09-11-008-privy-hedera-specialist-agents.md`), following `.claude/agents/cre-engineer.md`. No third-party text was copied into them.

---

## 26. 2026-09-11 — Final demo: Privy SPV wallet → Hedera ATS execution (live testnet)

No new dependencies. It uses `@privy-io/node` 0.34.0 (Apache-2.0), `@hashgraph/asset-tokenization-contracts` 8.0.0 (Apache-2.0) and `ethers` 6.17.0 (MIT), all recorded in §21–§24.

Original Catenor One code, written by Claude Code in the main session:

- `apps/api/src/infrastructure/execution/privy-spv-ats-executor.ts`;
- `apps/api/scripts/hedera/preflight-spv-deploy-equity.ts`;
- `apps/api/scripts/hedera/verify-ats-equity.ts`.

The Privy calls (`wallets().ethereum().signTransaction`, `wallets().get`, `policies().get`) follow the installed SDK types and the CP1 findings of the `privy-engineer` subagent. No SDK example code was copied.

Live sponsor resources:

- **Privy development app:** the SPV EVM wallet, the `catenor-one-SPV-execution` policy and the runtime-signer key quorum, provisioned in CP1. The authorization keys are outside the repository (maintainer custody for the owner key; the runtime-signer key only in the git-ignored `apps/api/.env`).
- **Hedera Testnet:** ATS equity `0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418` (`0.0.10479921`), created by transaction `0x8265479fc7236b7b092899b49cfaf0d8d1ecb05e7ce2ff69aeda587e4ad75897` through the ATS v8 Factory `0.0.9213391`.
- Evidence: `artifacts/hedera/final-demo/`.

Added in CP4 (2026-09-11), also original Catenor One code without new dependencies:

- `apps/api/scripts/privy/provision-investor-wallets.mjs` — two receiving-only Privy EVM wallets; owner keys outside the repository;
- `apps/api/scripts/privy/add-spv-issuance-rule.mjs` — maintainer-run, owner-authorized rule creation;
- `apps/api/scripts/hedera/preflight-spv-issuance.ts`;
- `apps/api/scripts/demo/final-demo-config.ts` — public addresses only;
- the issuance path in `privy-spv-ats-executor.ts`.

The Privy calldata-condition shapes (`function_name`, the nested tuple field) come from the current Privy policy documentation and the live CP4 probe by `privy-engineer`. The `issueByPartition` ABI fragment matches `@hashgraph/asset-tokenization-contracts` 8.0.0 (the script checks the signature at run time).

CP5 (2026-09-11): `apps/api/scripts/hedera/issue-to-investor.ts` is original Catenor One code. It runs one issuance through the Privy SPV executor; preflight is the default and broadcast requires an explicit flag. Live result: `issueByPartition` → Investor A, tx `0x9e6c86c4e8d2674f3d49142b14f7c9d194cb025dfa604ee684ad362e034a04bf` (`artifacts/hedera/final-demo/`).

CP6 (2026-09-11): the same script issued to Investor B, tx `0x5ea23774ef08a9046ae2135bfeb243e1bd385d153b8d1d8a703c883d4c8c58f7`. The rehearsal equity now has total supply 1,000 (A 600, B 400).

## 27. 2026-09-11 — Final demo CP7: Distribution Agent, investor eligibility (CRE), distribution plan

No new dependencies. Original Catenor One code, written by Claude Code in the main session:

- `workflows/identity-confidential/src/investor-eligibility/` — Catenor semantics; reuses the S001 normalization, facts and commitment helpers; router and config wiring in `workflow.ts`;
- `packages/policy/src/distribution-eligibility.ts`;
- `apps/api/src/modules/distribution/`;
- `apps/api/src/modules/capability-grants/`;
- `apps/api/src/infrastructure/key-management/privy-distribution-agent.ts`;
- `apps/api/src/infrastructure/execution/hedera-ats-holdings.ts`;
- `apps/api/scripts/privy/provision-agent-signer.mjs`;
- the `AccountBinding` migration;
- demo Part C.

Sources:

- The Privy policy condition shapes (`in` on `to`, hex `value lte`) come from current Privy documentation and the live CP7 probe by `privy-engineer`; no SDK example code was copied.
- The CRE mechanics were validated in simulation by `cre-engineer`.

Live sponsor resources:

- **Privy development app:** the Agent runtime-signer key quorum (pre-seeded), plus one Agent policy and one Agent EVM wallet created by the demo run. The keys are outside the repository.
- **Sumsub sandbox:** synthetic investor applicants, created per run.

CP8 (2026-09-11), original Catenor One code without new dependencies:

- the dividend-lifecycle preparation in `privy-spv-ats-executor.ts`;
- `apps/api/scripts/hedera/preflight-spv-lifecycle.ts`;
- `apps/api/scripts/privy/add-spv-lifecycle-rules.mjs`;
- `DEMO_DIVIDEND`.

The ATS role and function facts come from the `@hashgraph/asset-tokenization-contracts` 8.0.0 sources and types (`contracts/constants/roles.sol`, `contracts/facets/dividend/`), found by `hedera-engineer`. The Privy calldata-rule shapes come from the live CP8 probe by `privy-engineer`.

CP9 (2026-09-11): `apps/api/scripts/hedera/dividend-lifecycle.ts` is original Catenor One code. Live results: `grantRole` tx `0x8b4baf363089b7eb4c225bb8fe202e9ac81aebe2fdfe4f1ffd26a84c102740e7` and `setDividend` tx `0x8ae0c07651a545d8a54092813ab21cbb05c58d130a7b99b6dc11004b712a5bcb` (dividend 1) on the rehearsal equity (`artifacts/hedera/final-demo/dividend-lifecycle.md`).

CP10 (2026-09-11), original Catenor One code without new dependencies:

- `apps/api/src/infrastructure/execution/privy-agent-payout-executor.ts`;
- pre-seeded resolution in `privy-distribution-agent.ts`;
- `DistributionService.approvedPayout`;
- `apps/api/scripts/hedera/preflight-agent-payout.ts`;
- the demo Part C payout step.

CP13 (2026-09-11): `apps/api/scripts/hedera/bootstrap-investor-accounts.ts` is original Catenor One code. Pre-demo testnet account activation only: 1 HBAR each to the investor receiving wallets from the Privy Agent wallet, txs `0x40c48ff3…6e07` and `0x0260e56f…548d` (`artifacts/hedera/pre-demo-bootstrap/`).

CP14 (2026-09-11): the live selective payout, 6 HBAR to Investor A from the Privy Distribution Agent wallet, tx `0x5db611642921708fc1fa88b78ed883acebd5d99316ede4481c141e076be42b88`. It was produced by the live Catenor-controlled plan (`artifacts/hedera/final-demo/selective-payout.md`). No new dependencies.

## 28. 2026-09-12 — Clean-room demo runbook (prompt 2026-09-11-023)

New dependencies (workflow only): `@noble/curves` 2.4.0 and `@scure/base` 2.4.0 (MIT), added to `workflows/identity-confidential` for Ed25519 / base58btc inside `handlerInTee`. They are the same versions the repository's domain packages already use (§22). No new API dependency.

Original Catenor One code, written by Claude Code in the main session:

- `packages/credentials/src/verifiable-credentials.ts`;
- `packages/authority/src/{relationship,offering}.ts` and the delegation in `capability.ts`;
- `packages/policy/src/investor-policies.ts`;
- `workflows/identity-confidential/src/{credentials,investor-credentials}/`;
- `apps/api/src/modules/{sponsor-authorization,investor-credentials}/`;
- `apps/api/src/infrastructure/key-management/{privy-spv-wallet,signable-document}.ts`;
- `apps/api/src/infrastructure/confidential-compute/cre-gateway-verifier.ts`;
- `apps/api/scripts/demo/clean-room/`;
- `scripts/demo/`;
- `DEMO.md`.

Specification sources read (no text or code copied):

- the pinned Catenor Protocol (`credentials/01–04`, `authority/01–04`, DATA-MODEL-BASELINE §13–16);
- W3C VC 2.0 / Data Integrity `eddsa-jcs-2022` (already the approved profile);
- Chainlink "Triggering Deployed Workflows" for the gateway JSON-RPC + JWT format.

The BUSL-1.1 reference `smartcontractkit/cre-sdk-typescript/packages/cre-http-trigger` (`create-jwt.ts`) was read only to confirm two details, the recovery-id encoding (0/1) and the sorted-key digest. No code was copied.

`scripts/demo/cre/*.sh` were drafted by the `cre-engineer` subagent and rewritten in the main session. Every command was checked against the installed CRE CLI v1.33.0 `--help`.

Live sponsor resources created by the non-spending clean-room run (instance `c1-202609120048`, Privy development app / Sumsub sandbox):

- a fresh S001 signer infrastructure: two key quorums, P_ASSERT / P_BOOTSTRAP, the bootstrap wallet;
- Ed25519 assertion wallets for the Trust Anchor and the Sponsor, plus investor holder keys;
- SPV and Agent EVM wallets with their Catenor-created policies;
- two investor receiving wallets;
- synthetic Sumsub sandbox applicants.

Owner keys are kept outside the repository. No Hedera transaction was sent.


## 29. 2026-09-12 — Railway-ready API backend (prompt 2026-09-12-024)

No new npm dependency; `pnpm-lock.yaml` is unchanged. `tsx` 4.23.13, already an `apps/api` devDependency, is now also the production runner.

Container and deployment inputs, used only in `apps/api/Dockerfile`:

| Input | Version | License | Use |
|---|---|---|---|
| Docker image `node:24.10.0-bookworm-slim` | 24.10.0 | Node.js MIT; Debian packages under their own licenses | runtime base image (matches `.nvmrc` / local Node) |
| Debian `openssl`, `ca-certificates` | bookworm | OpenSSL Apache-2.0; MPL-2.0 (CA bundle) | Prisma CLI (`migrate deploy`) and outbound TLS |
| `pnpm` via `npm install -g` | 10.11.0 | MIT | the workspace install (same as `packageManager`) |

Railway's public config schema (`https://backboard.railway.app/railway.schema.json`) was read to confirm the `railway.toml` key names (`builder = "DOCKERFILE"`, `dockerfilePath`, `healthcheckPath`, `numReplicas`, `overlapSeconds`, `drainingSeconds`). No text or code was copied.

Original Catenor One code, written by Claude Code in the main session:

- `apps/api/src/main.ts`;
- `apps/api/src/infrastructure/http/api-server.ts`;
- `apps/api/src/infrastructure/confidential-compute/cre-callback-relay.ts`, whose relay key is [REF-IMPL]: HKDF info `catenor-one/identity-confidential/relay/v1`;
- `apps/api/src/infrastructure/persistence/prisma/database-probe.ts`;
- the relay wiring in `apps/api/scripts/demo/clean-room/{context,stages/cre}.ts`;
- `apps/api/Dockerfile`, `apps/api/railway.toml`, `.dockerignore`;
- `docs/deployment/RAILWAY.md`.

No sponsor resource was created or changed (Railway, Privy, Sumsub, Hedera, Chainlink).


## 30. 2026-09-12 — Final demo run on the deployed CRE workflow (prompt 2026-09-12-025)

No new npm dependency; `pnpm-lock.yaml` is unchanged.

Original Catenor One code, written by Claude Code in the main session during the run:

- **The Railway database mode** in `apps/api/scripts/demo/clean-room/stages/setup.ts`, and the database label in
  `run-stage.ts`.
- **Gateway handling** in `apps/api/src/infrastructure/confidential-compute/cre-gateway-verifier.ts`: it surfaces the
  gateway's JSON-RPC error (`gatewayErrorDetail`, with a test) and defaults to `https://01.gateway.zone-a.cre.chain.link`.
  That URL was taken from the strings of the installed CRE CLI v1.33.0 binary and confirmed with a live control
  request. The `DEMO_CRE_GATEWAY_URL` override is in `context.ts`.
- **Stage 60** in `stages/hedera.ts`: `equityAddressOf` and the no-redeploy completion of the SPV policy extension.
- **Script wording:** `scripts/demo/cre/deploy.sh` and `invoke.sh`, and the `workflows/.env.example` note.

**The control workflow**, `catenor-http-control` (deployed ID `0038de787580f971728b4e2599d83107eb6e8933a632b8021f67c72a3672a66f`):

- a minimal non-TEE HTTP-trigger workflow, written in the git-ignored `scratch/cre-http-control/`;
- it reuses the `identity-confidential` `node_modules` through a symlink, uses `@chainlink/cre-sdk` 1.18.0 and `zod`,
  and is not committed;
- it existed only to isolate the gateway problem, and is to be deleted after the demo.

**Live sponsor resources created by the run** (the owner keys are outside the repository):

| Sponsor | Resources |
|---|---|
| Privy development app `catenor-one-ethonline-2026` | the S001 signer infrastructure; assertion and holder keys; SPV, Agent and testnet-treasury EVM wallets, each with its policy and runtime quorum; two receive-only investor wallets |
| Sumsub sandbox | synthetic applicants: four representatives from the stage 11 attempts, and investors "Lisa Simpson" and "Bart Simpson" |
| Chainlink CRE | `identity-confidential-production` (private registry): deploy #1 and deploy #2; the Vault DON secrets; the control workflow |
| Hedera testnet | ATS equity `0xf37A91c3aC757ac5f14e4b8BC92D4b1001D97ABC` (`0.0.10510175`), its lifecycle transactions and the payout; the funding transfers |

Evidence: `artifacts/final-demo/`, `artifacts/chainlink/final-demo/deployed-run-c1-202609121659.md`,
`artifacts/hedera/final-demo/clean-room-c1-202609121659.md`, and
`artifacts/privy/final-demo/clean-room-c1-202609121659/`.

**Demo site and video assets (2026-09-13).**

- **The site:** `apps/web/demo-site/` holds `index.html` (the replay console), `history.html` (the run history and
  evidence) and `assets/`. It is original code written by Claude Code subagents under the maintainer's direction, and
  it shows only public-safe data taken from the committed artifacts.
- **Logos** in `apps/web/demo-site/assets/logos/` and in the video cards:
  - the Catenor mark and lockup come from the maintainer's own Catenor social-preview image;
  - the Chainlink icon comes from the official `chainlink-cre-skill` assets (§12);
  - the Hedera logo comes from Simple Icons (`simple-icons` on jsDelivr, CC0);
  - the Privy symbol is the official file `Privy_Symbol_Black.svg`, supplied by the maintainer.

  The sponsor logos are used only to identify each sponsor's technology in this hackathon demo.
- **Video tooling:** in `docs/hackathon/demo/video/`, written for this project; it uses Pillow and ffmpeg. The console
  recordings were made with Playwright driving a local Chrome, and that recorder stays in the git-ignored scratchpad.

**AI-generated video clip (2026-09-13).**

- **The clip:** the 10 s corridor clip behind the landing-page loop (`one-did-every-door-landing.mp4`, not committed) was
  generated by the maintainer in **Luma Dream Machine** (model Seedance 2.0) from a text prompt written in this session.
- **What was added over it:** the titles and the closing line, added by `docs/hackathon/demo/video/luma_titles.py`
  (Pillow + ffmpeg).
- **Status:** it is decorative marketing footage. It is not demo evidence and makes no protocol claim.

