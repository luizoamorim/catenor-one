# Catenor One — Vertical Slices

Catenor One uses spec-driven vertical slices.

A slice is a complete, demonstrable capability crossing all required layers.

Bad sequencing:

```text
build all DB models
→ all APIs
→ all UI
→ all workflows
→ hope they integrate
```

Preferred:

```text
one complete capability
→ verify end-to-end
→ commit
→ next capability
```

## Slice format

```text
SPEC.md
PLAN.md
TASKS.md
ACCEPTANCE.md
TEST-VECTORS.md
```

### SPEC
What must be true.

### PLAN
How this implementation will make it true.

### TASKS
Executable work checklist.

### ACCEPTANCE
Externally testable success/failure criteria.

### TEST VECTORS
Deterministic inputs/outputs/boundaries.

## Planned sequence

### S001 — Trust Anchor Admission
Admit an Initial Trust Anchor through evidence, key-possession proof, Policy evaluation, and an auditable Admission Record.

### S002 — Sponsor Authorization
Allow an admitted Trust Anchor to authorize a Sponsor with scoped Capabilities.

### S003 — Agent Delegation
Give an independent Agent Subject bounded delegated authority without inheriting Sponsor identity.

### S004 — Investor Identity
Establish/recover a canonical investor Subject and privately bind additional accounts through Subject Continuity.

### S005 — Policy Decision
Evaluate verified identity/authority/evidence against a versioned Policy and produce a minimized Decision.

### S006 — Distribution
Let a delegated Agent request a distribution while external wallet policy independently enforces signers, limits, approvals, and transaction rules.

### S007 — Audit
Reconstruct why an action was allowed/denied using identity state, credentials, authority chain, Policy Decision, and execution evidence.

## Definition of done

A slice is not done because code compiles or a UI renders.

A slice is done when:

```text
acceptance criteria pass
negative paths pass
tests pass
artifacts exist
AI/provenance log is updated
human review is complete
```
