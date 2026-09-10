# Build Log — Catenor One / ETHOnline 2026

> Human-readable development timeline. Keep entries concise, factual, and commit-linked when possible.

> **Historical note:** Entries covering work performed before the public Catenor Protocol repository was created were reconstructed on 2026-09-09 from contemporaneous design conversations, notes, generated artifacts, and local project structure. They document when the work actually happened; they are not backdated Git commits.

---

## 2026-09-04 — Protocol design begins during ETHOnline

**Context:** ETHOnline was already underway when the protocol-design work began.

**Goal:** Design a reusable identity and authority layer for regulated real-world systems rather than treating a wallet as the identity itself.

Initial design direction:

```text
wallet != identity
        ↓
canonical subject
        ↓
W3C DID foundation
        ↓
credentials / presentations
        ↓
authority / policy
```

Key concepts explored from the beginning:

- canonical identity independent from a wallet;
- W3C DID as the identity foundation;
- W3C Verifiable Credentials / Presentations;
- account bindings;
- privacy-preserving identity evidence;
- Subject Continuity across changing accounts/providers;
- chain-agnostic and offchain-compatible identity.

AI assistance:

- ChatGPT used as an architecture/research/design partner.
- The human maintainer drove the protocol problem definition, challenged assumptions, selected/rejected designs, and continuously refined the model.

Human work:

- protocol thesis;
- RWA identity requirements;
- canonical-subject reasoning;
- privacy and interoperability requirements;
- review and correction of generated architecture.

Repository state:

- the final public Catenor Protocol repository did not yet exist.

---

## 2026-09-05 to 2026-09-07 — Identity, authority, and implementation model expands

The design moved beyond identity alone.

Concepts developed/refined included:

```text
Canonical Subject
Subject Continuity
Account Bindings
Verifiable Credentials
Verifiable Presentations
Relationships
Capabilities
Delegation
Authority Chains
Issuer Authority
Policy Decisions
```

Important separations established:

```text
Relationship != Capability
Signature validity != claim truth
Credential != database row
Policy Decision != execution authorization
```

The implementation model also began separating:

```text
public DID state
private identity state
private credential/evidence storage
secure key management
operational database/index
```

A working repository/scaffold under an earlier project name was used to organize:

- identity documentation;
- authority documentation;
- policy documentation;
- confidential workflows;
- integration notes;
- schemas;
- AI/provenance artifacts;
- application/package structure.

This was still active protocol-design work during the hackathon, not a finished pre-existing implementation.

---

## 2026-09-07 to 2026-09-08 — Working protocol becomes without name

The model expanded to Humans, Organizations, and Agents.

Key decisions included:

- an Agent receives its own canonical identity;
- authority is delegated rather than inherited;
- issuer authority is explicit and scoped;
- `ISSUE_CREDENTIAL` and `AUTHORIZE_ISSUER` are distinct;
- delegated authority cannot exceed delegator authority;
- credential-signing keys and financial-execution keys should be separated;
- sensitive evidence may require confidential computation;
- full private account bindings should not be exposed through the public DID Document.

The working repository structure became the basis for later Catenor One implementation organization, but the protocol itself was still being actively redesigned.

AI assistance:

- ChatGPT used extensively for architecture, documentation, threat reasoning, data-model examples, diagrams, and design review.

Human review:

- the maintainer repeatedly corrected assumptions and froze conceptual decisions before implementation.

---

## 2026-09-08 — Protocol separated from any company-specific identity

**Decision:** The protocol should be open and implementation-neutral.

The design was reworked so that:

```text
company/product
        !=
protocol
```

The canonical protocol name became:

```text
Catenor Protocol
```

The proposed native DID method became:

```text
did:catenor:<opaque-high-entropy-id>
```

Core specification language was made vendor-neutral.

Important rule:

> The Catenor DID belongs to the Subject, not to the company, provider, wallet, or application that first onboarded the Subject.

Protocol documentation was reorganized around:

- canonical decisions;
- data-model baseline;
- conformance;
- terminology;
- core model;
- identity;
- credentials;
- authority;
- policy;
- privacy;
- audit;
- security.

---

## 2026-09-09 — Catenor Protocol Draft v0.1 consolidated and published

The public Catenor Protocol repository was created and the several days of protocol-design work were consolidated into Draft v0.1.

Protocol:

```text
https://github.com/luizoamorim/catenor
https://catenor.xyz
```

Current pinned protocol commit used by Catenor One:

```text
66ef712694acfc987663f5ffa9bcc9d12d1fe80e
```

Important provenance clarification:

> The initial large Catenor Protocol commit represents publication/consolidation of protocol design performed during the hackathon since 2026-09-04. It does not represent the beginning of the design work.

The documentation website was also brought online at:

```text
https://catenor.xyz
```

---

## 2026-09-09 — Project naming

**Decision:** ETHOnline reference implementation named **Catenor One**.

```text
Catenor Protocol
= open protocol / specification

Catenor One
= first reference implementation / ETHOnline project
```

AI assistance:

- ChatGPT used for naming research and reference-implementation framing.

Human decision:

- final project name selected by maintainer.

---

## 2026-09-09 — New implementation scaffold

Created a new `catenor-one` scaffold with:

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

Vertical slices created:

```text
S001 Trust Anchor Admission
S002 Sponsor Authorization
S003 Agent Delegation
S004 Investor Identity
S005 Policy Decision
S006 Distribution
S007 Audit
```

No slice implementation is complete yet.

AI assistance:

- ChatGPT proposed the structure using lessons from the earlier experimental scaffold.

Human action:

- maintainer created the tree locally.

Commit:

- 6dc775705901f9fb904333de0f485c0e656176f6

---

## 2026-09-09 — Spec-driven workflow

Defined:

```text
SPEC
→ PLAN
→ TASKS
→ ACCEPTANCE
→ TEST VECTORS
→ IMPLEMENTATION
→ TEST
→ REVIEW
→ COMMIT
```

AI usage/provenance is treated as a first-class project artifact.

---

## 2026-09-09 — Project-context bootstrap

Created/updated:

```text
README.md
CLAUDE.md
docs/PROTOCOL-BASELINE.md
docs/hackathon/AI_USAGE.md
docs/hackathon/PROVENANCE.md
docs/hackathon/BUILD_LOG.md
docs/hackathon/SUBMISSION_CHECKLIST.md
docs/hackathon/prompts/2026-09-09-001-project-bootstrap.md
docs/hackathon/plans/2026-09-09-001-project-bootstrap.md
slices/README.md
```

Purpose:

- pin protocol authority;
- prevent semantic drift;
- define AI-assistance rules;
- document project provenance;
- establish slice-driven implementation.

Commit:

- 2b60b889a43fce1fcc9a92674c62be182be95a43

---

---

## 2026-09-10 — Catenor One architecture baseline frozen

**Goal:** Define the implementation architecture before writing slice code.

Architecture selected:

```text
Modular Monolith
+
Vertical Slices
+
DDD-lite
+
Clean Architecture boundaries
```

Reference stack/boundaries established:

```text
apps/web
→ Next.js

apps/api
→ NestJS modular monolith

packages/*
→ framework/vendor-independent domain code

Railway
→ application deployment + PostgreSQL
→ private bucket available for later evidence use

Chainlink CRE Confidential
→ confidential verification adapter/workflows

Privy
→ authentication, wallets/signers, execution controls where appropriate

Hedera ATS
→ planned RWA tokenization/compliance/execution layer
```

Key architectural rule:

> Sponsor/provider integrations implement Catenor-defined ports and MUST NOT redefine Catenor domain semantics.

Commit:

```text
1336ac648aa4727022bc9b8501c23dd3e7c74c6e
```

AI assistance:

- ChatGPT used to design/review the architecture baseline and ADR structure.
- Human maintainer selected and approved the final architecture.

---

## 2026-09-10 — S001 Trust Anchor Admission source-of-truth defined

**Goal:** Define S001 completely before implementation.

S001 documentation established:

```text
slices/S001-trust-anchor-admission/
├── SPEC.md
├── ACCEPTANCE.md
├── TEST-VECTORS.md
└── README.md
```

The S001 design includes:

```text
Bootstrap Access Gate
Trust Domain Bootstrap Configuration
ORGANIZATION Canonical Subject
did:catenor
Credential Assertion Key
Proof of Key Possession
real Sumsub sandbox integration
Chainlink CRE Confidential verification
deterministic Admission Policy
bootstrap endorsement
Trust Anchor Admission Record
ACTIVE operational status projection
Trust Anchor verification
```

A technical Judge Inspector prototype was also created under:

```text
artifacts/judges/s001/
```

No production S001 implementation existed at this stage.

AI assistance:

- ChatGPT drafted/reviewed SPEC, acceptance criteria, test vectors, architecture diagrams, and Judge Inspector prototypes.
- Human maintainer reviewed and froze the semantics before implementation planning.

---

## 2026-09-10 — Official Chainlink CRE skill added

**Goal:** Use current sponsor tooling/documentation instead of implementing CRE APIs from model memory.

Installed in project scope:

```text
smartcontractkit/chainlink-agent-skills
└── chainlink-cre-skill
```

Version:

```text
0.0.22
```

Project paths:

```text
.agents/skills/chainlink-cre-skill
.claude/skills/chainlink-cre-skill
```

The `.claude` path is a symlink to the canonical project-local skill.

Relevant reference material includes:

```text
project-scaffolding
confidential-workflows
simulation
workflow-patterns
triggers
http-client
sdk-reference
cli-reference
operations
concepts
```

Decision:

- CRE implementation will use official current documentation/skill guidance.
- Live documentation takes precedence if the installed skill is stale.
- A project-specific `cre-engineer` Claude Code subagent will later load this skill.
- The subagent may implement CRE mechanics but MUST NOT redefine Catenor protocol/application semantics.

No CRE workflow code was created in this step.

Commit:

```text
separate tooling commit; record SHA when available
```

---

## 2026-09-10 — S001 PLAN / TASKS created and human-reviewed

**Goal:** Convert the frozen S001 requirements into a concrete implementation plan without beginning production code.

Claude Code produced:

```text
slices/S001-trust-anchor-admission/PLAN.md
slices/S001-trust-anchor-admission/TASKS.md
```

The first plan mapped every S001 test vector to a concrete verification method/task and surfaced integration blockers before code.

Human review then amended the plan.

Major decisions:

```text
CRE workflow boundary
→ workflows/identity-confidential
→ trust-anchor-admission is the first operation/handler

LLM
→ removed completely from S001

Evidence retention
→ COMMITMENT_ONLY
→ no raw Sumsub provider responses persisted
→ no custom ECIES scheme

Sumsub provider binding
→ Catenor bindingRefs are created before applicant IDs are attached
→ externalUserId mismatch blocks Admission

CRE secrets
→ SUMSUB_APP_TOKEN
→ SUMSUB_SECRET_KEY
→ CATENOR_INTERNAL_API_TOKEN

CRE registry
→ private preferred

Missing required fact
→ DENY
→ private trace distinguishes MISSING from FALSE

Freshness
→ 180-day Catenor One reference value in hash-pinned Bootstrap Configuration

Trust Anchor verification
→ Admission provenance/bootstrap endorsement are cryptographically verifiable
→ current lifecycle status remains an operational projection in S001
```

The plan also introduced a P0 Fast Lane focused on a real end-to-end hackathon demo before non-critical P1/P2 improvements.

No production code, dependencies, migrations, `cre init`, or deployments were performed during planning.

---

## 2026-09-10 — S001 source-of-truth cleanup completed

**Goal:** Realign SPEC / ACCEPTANCE / TEST-VECTORS with the approved PLAN revision before implementation.

Updated documentation now agrees on:

```text
no LLM in S001
three CRE secrets
identity-confidential workflow boundary
correct provider-binding sequence
provider-binding mismatch failure
COMMITMENT_ONLY retention
verificationMethodCommitment
180-day reference freshness
Sumsub sandbox labeling
narrow Trust Anchor verification claim
```

Removed/retired LLM-specific acceptance criteria and test vectors without renumbering existing identifiers unnecessarily.

Additional test/acceptance coverage was added for:

```text
provider-binding mismatch
Verification Method/public-key replacement detection
```

Result:

```text
S001 source of truth
↔ PLAN
↔ TASKS
```

cross-checked successfully before implementation.

No production code was written.

---

## 2026-09-10 — Execution target updated to Hedera ATS

**Decision:** Hedera Asset Tokenization Studio (ATS) becomes the planned RWA tokenization/compliance/execution layer for Catenor One.

Current integration roles:

```text
Chainlink CRE Confidential
→ private verification/computation

Catenor Protocol / Catenor One
→ canonical identity, authority, delegation, policy decisions

Privy
→ authentication, wallets/signers and execution controls where appropriate

Hedera ATS
→ tokenized real-world asset lifecycle, compliance and execution
```

Arc is no longer the primary hackathon execution/settlement target.

This decision does not change S001.

Future slice direction:

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

No Hedera integration code existed at the time of this decision.

---

## 2026-09-10 — Subject Continuity promoted to explicit next scenario

**Goal:** Preserve canonical identity when wallets/providers change.

Planned S002:

```text
Existing did:catenor
+
new Identity Verification Provider evidence
↓
identity-confidential
↓
private reconciliation
↓
MATCH | REVIEW | NO_MATCH
```

Reference implementation direction:

- Sumsub + Persona provider reconciliation;
- private provider bindings;
- deterministic matching rules;
- ambiguous evidence → `REVIEW`;
- false-merge avoidance prioritized;
- optional future LLM-in-TEE only if unstructured/ambiguous evidence genuinely requires it.

S002 remains unimplemented while S001 is completed first.


## Entry template

```md
## YYYY-MM-DD — Short title

Goal:
Work completed:
Validation:
AI assistance:
Human review:
Artifacts:
Commit:
Notes:
```
