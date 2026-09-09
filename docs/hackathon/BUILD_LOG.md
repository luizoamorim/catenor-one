# Build Log — Catenor One / ETHOnline 2026

> Human-readable development timeline. Keep entries concise, factual, and commit-linked when possible.

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
- ChatGPT proposed the structure using lessons from an earlier experimental scaffold.

Human action:
- maintainer created the tree locally.

Commit:
- `TODO_FILL_COMMIT_SHA`

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
- `TODO_FILL_AFTER_COMMIT`

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
