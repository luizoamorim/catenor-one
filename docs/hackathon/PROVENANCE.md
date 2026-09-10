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
