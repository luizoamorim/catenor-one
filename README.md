# Catenor One

> **The first reference implementation of Catenor Protocol.**

**Status:** ETHOnline 2026 — active development  
**Protocol baseline:** Catenor Protocol Draft v0.1  
**Protocol website:** https://catenor.xyz  
**Protocol repository:** https://github.com/luizoamorim/catenor

## What is Catenor One?

Catenor One is the first end-to-end reference implementation of **Catenor Protocol**, built for ETHOnline 2026.

Catenor Protocol defines the open, vendor-neutral semantics for canonical identity, `did:catenor`, Verifiable Credentials and Presentations, Subject Continuity, Account Bindings, Relationships, Capabilities, Delegation, Authority Chains, Trust Anchor Admission, Policy Decisions, confidential verification requirements, and auditability.

> **Catenor Protocol is the standard. Catenor One is an implementation of that standard.**

## Core thesis

```text
Wallets are accounts.
Credentials are claims.
Authority is scoped.
Identity persists.
```

## Demo story

```text
Initial Trust Anchor
        ↓
Sponsor Authorization
        ↓
SPV / Organization
        ↓
Delegated Distribution Agent
        ↓
Investor Identity + Subject Continuity
        ↓
Policy Decision
        ↓
Institutional Wallet Authorization
        ↓
USDC Distribution
        ↓
Audit Trail
```

The demo must prove both successful and denied paths.

## Vertical slices

```text
S001 — Trust Anchor Admission
S002 — Sponsor Authorization
S003 — Agent Delegation
S004 — Investor Identity
S005 — Policy Decision
S006 — Distribution
S007 — Audit
```

Each slice contains:

```text
SPEC.md
PLAN.md
TASKS.md
ACCEPTANCE.md
TEST-VECTORS.md
```

See `slices/README.md`.

## Repository architecture

```text
apps/
  web/
  api/

packages/
  identity/
  credentials/
  authority/
  policy/
  sdk/

workflows/
  credential-recertifier/
  subject-continuity/
  distribution/

contracts/
artifacts/
schemas/
test-vectors/
tests/
scripts/
```

## Reference implementation technologies

Catenor One may use concrete sponsor technologies because it is a reference implementation, not the vendor-neutral protocol specification.

Current direction:

- **Chainlink CRE Confidential** — confidential verification, credential re-certification, Subject Continuity, and distribution/policy logic.
- **Privy** — user wallets, organization wallets, agent wallets/signers, secure key infrastructure, wallet policies, limits, approvals, and execution authorization.
- **Arc** — USDC settlement rail.
- **Identity Verification Provider** — verified real-world identity evidence.
- **Relational operational database** — query/index layer.
- **Encrypted object storage** — sensitive credential/evidence storage.

Concrete integrations must be documented under `docs/integrations/`.

## Critical architecture separation

```text
Canonical identity != wallet/account
Credential != database row
Relationship != Capability
Signature validity != claim truth
Catenor Policy Decision != wallet execution authorization
Credential Assertion Key != Financial Execution Key
```

## Protocol baseline

The exact Catenor Protocol commit implemented by this repository is pinned in:

```text
docs/PROTOCOL-BASELINE.md
```

## AI-assisted development

AI use is intentionally documented under:

```text
docs/hackathon/AI_USAGE.md
docs/hackathon/PROVENANCE.md
docs/hackathon/BUILD_LOG.md
docs/hackathon/prompts/
docs/hackathon/plans/
```

AI may assist implementation, tests, planning, review, documentation, and design. It must not silently redefine frozen protocol semantics.

## Development workflow

```text
Protocol Baseline
        ↓
SPEC
        ↓
PLAN
        ↓
TASKS
        ↓
ACCEPTANCE + TEST VECTORS
        ↓
IMPLEMENTATION
        ↓
TEST
        ↓
REVIEW
        ↓
COMMIT
        ↓
BUILD LOG / AI LOG
```

## Current status

The implementation scaffold exists.

The immediate next step is:

> **S001 — Trust Anchor Admission**

No slice is complete until acceptance criteria and negative-path tests pass.
