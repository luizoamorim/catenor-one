# Plan — 2026-09-09-001 — Catenor One Project Bootstrap

## Goal

Establish the minimum project governance/context required to begin AI-assisted implementation without losing protocol semantics or hackathon provenance.

## Deliverables

```text
README.md
CLAUDE.md
docs/PROTOCOL-BASELINE.md
docs/hackathon/AI_USAGE.md
docs/hackathon/PROVENANCE.md
docs/hackathon/BUILD_LOG.md
docs/hackathon/SUBMISSION_CHECKLIST.md
slices/README.md
prompt artifact
plan artifact
```

## Rules established

1. Catenor Protocol is the semantic source of truth.
2. Catenor One pins an exact protocol commit.
3. Vertical slices are the implementation unit.
4. Every substantial AI-assisted unit is logged.
5. Reused/external work is recorded in provenance.
6. Negative-path acceptance is required.
7. Database state does not replace cryptographic proof.
8. Policy authority and execution authorization remain separate.
9. Credential assertion and financial execution keys remain separate.
10. No secrets/private keys live in ordinary source/database fields.

## Next action

Create/review:

```text
slices/S001-trust-anchor-admission/SPEC.md
```

Then S001 PLAN, TASKS, ACCEPTANCE, and TEST-VECTORS before implementation.
