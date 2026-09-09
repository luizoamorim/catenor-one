# CLAUDE.md — Catenor One

@README.md
@docs/PROTOCOL-BASELINE.md
@docs/hackathon/AI_USAGE.md
@docs/hackathon/PROVENANCE.md
@docs/hackathon/BUILD_LOG.md
@docs/hackathon/SUBMISSION_CHECKLIST.md

# Mission

Catenor One is the first reference implementation of Catenor Protocol and the ETHOnline 2026 project.

Catenor Protocol is maintained in a separate repository and is the semantic source of truth.

# Protocol authority

Before implementing protocol behavior:

1. Read `docs/PROTOCOL-BASELINE.md`.
2. Inspect the pinned Catenor Protocol version/commit.
3. Do not redefine canonical protocol semantics here.
4. If implementation requirements conflict with the protocol baseline, STOP and report the conflict.
5. Do not silently resolve open protocol design items as normative Catenor decisions.

# Critical invariants

```text
Wallet / Account != Canonical Subject
Provider ID != Canonical Subject ID
PII != DID seed
DID financial Account Binding is private by default
Credential Assertion Key != Financial Execution Key
Credential != database row
Relationship != Capability
Signature validity != claim truth
Issuer authority is explicit and scoped
ISSUE_CREDENTIAL != AUTHORIZE_ISSUER
Delegated authority <= delegator authority
Delegability must be explicit
Trust Anchor authority comes from Admission
Policy Decision != Execution Authorization
Operational database = index, not authority proof
Sensitive evidence should remain private
Minimum necessary verified fact should be disclosed
```

# Repository architecture

Use the existing repository layout:

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

Do not create alternate duplicate top-level architectures without explicit approval.

# Spec-driven vertical slices

Every substantial feature is developed as a vertical slice.

Each slice has:

```text
SPEC.md
PLAN.md
TASKS.md
ACCEPTANCE.md
TEST-VECTORS.md
```

## SPEC.md

Defines goal, story, preconditions, end-to-end flow, protocol objects, invariants, privacy, negative paths, non-goals, dependencies.

## PLAN.md

Defines architecture changes, files/packages, APIs, persistence, workflows, contracts/integrations, tests, rollout order.

Do not implement a substantial slice before PLAN exists.

## TASKS.md

Executable checklist. Mark complete only after implementation and relevant tests exist.

## ACCEPTANCE.md

Use testable GIVEN / WHEN / THEN criteria. Include negative paths.

## TEST-VECTORS.md

Define deterministic inputs, expected outputs, malformed inputs, boundaries, privilege-escalation cases.

# Slice order

```text
S001 Trust Anchor Admission
S002 Sponsor Authorization
S003 Agent Delegation
S004 Investor Identity
S005 Policy Decision
S006 Distribution
S007 Audit
```

# Chainlink integration

Use for confidential workflows where required:
- private API access;
- sensitive evidence evaluation;
- credential verification/re-certification;
- Subject Continuity;
- confidential Policy evaluation;
- distribution calculations.

Do not let an LLM make final compliance/eligibility/authority decisions when deterministic rules can decide them.

Persist judge-verifiable artifacts under:

```text
artifacts/chainlink/
```

# Privy integration

Use for:
- user wallets;
- organization wallets;
- agent wallets/signers;
- secure signing infrastructure;
- wallet policies;
- limits;
- quorum/approvals;
- execution authorization.

Catenor Policy Decision and wallet Execution Authorization remain separate.

Persist artifacts under:

```text
artifacts/privy/
```

A meaningful DENY path must demonstrate no signature / no transaction / no funds moved.

# Arc integration

Use as the settlement rail for the reference financial flow.

Persist transaction evidence under:

```text
artifacts/arc/
```

# Key management

Never store private keys in source files, ordinary database fields, logs, prompts, or committed `.env` files.

Credential assertion keys and financial execution keys remain distinct.

# Persistence

Operational relational storage is query/index state, not authority proof.

Sensitive full credentials/evidence belong in encrypted private storage.

Public DID state and private account/identity mappings remain separated.

# AI usage and provenance

For every substantial AI-assisted work unit:

1. create/update a prompt artifact under `docs/hackathon/prompts/`;
2. create/update the corresponding plan under `docs/hackathon/plans/` or the slice PLAN;
3. update `BUILD_LOG.md`;
4. update `AI_USAGE.md` if a new tool/usage category appears;
5. update `PROVENANCE.md` when external code/assets/SDKs/templates/prior work are introduced.

Do not fabricate verbatim AI transcripts. If exact prompt text is unavailable, label it as a prompt summary.

# Commit discipline

Prefer small, coherent commits.

Suggested pattern:

```text
docs: define S001 trust anchor admission
feat(identity): create canonical subject
feat(authority): implement trust anchor admission
test(authority): add admission negative paths
docs(hackathon): update build provenance
```

# From-scratch discipline

Do not import old application/protocol code without explicit approval, provenance documentation, license review, and hackathon eligibility review.

Official sponsor SDKs and permitted dependencies may be used, but record them.

# Validation before done

Run relevant unit tests, integration tests, schema validation, lint, typecheck, build, workflow simulation, contract tests, and negative-path tests.

Report failures instead of hiding them.

# Human authority

The human maintainer decides protocol interpretation, scope, slice approval, architecture tradeoffs, final merge, and submission claims.

AI tools assist implementation. They do not own protocol governance.
