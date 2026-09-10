# AI Usage — ETHOnline 2026

> Catenor One uses AI-assisted development as part of a human-directed, spec-driven engineering workflow.

**Status:** Living document  
**Last updated:** 2026-09-10

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

Planned project subagent:

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
