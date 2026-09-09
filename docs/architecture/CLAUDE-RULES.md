# Catenor One — Architecture Rules for AI Agents

Import this from root `CLAUDE.md`:

```text
@docs/architecture/ARCHITECTURE.md
@docs/architecture/CLAUDE-RULES.md
```

## Required architecture

```text
Modular Monolith
+ Vertical Slices
+ DDD-lite
+ Clean Architecture boundaries
```

## Rules

- `apps/web` may use Next.js.
- `apps/api` may use NestJS.
- domain packages under `packages/` remain framework-independent.
- Prisma/ORM code belongs to infrastructure.
- sponsor SDK code belongs to infrastructure/workflows.
- sponsor SDKs MUST NOT be imported directly by domain packages.
- controllers are thin.
- business orchestration belongs in Application Use Cases.
- repositories exist at meaningful persistence boundaries, not automatically per table.
- every substantial implementation task maps to an approved vertical slice.

## Sponsor integration agents / skills

Before writing sponsor-specific integration code, use current official agent/skill/documentation tooling when available.

### Chainlink CRE
Confirm current workflow, confidential-compute, secrets, simulation, and deployment APIs. Implement a Catenor-defined port via adapter/workflow. Save artifacts under `artifacts/chainlink/`.

### Privy
Confirm current user wallet, organization wallet, agent wallet/signer, policy, limit, approval/quorum, and signing APIs. Implement key-management/execution ports via adapters. Save artifacts under `artifacts/privy/`.

### Arc
Confirm current settlement/network APIs. Implement the settlement port via adapter. Save artifacts under `artifacts/arc/`.

## Never invent sponsor APIs from memory

If official current tooling exists:

```text
USE IT FIRST
```

If it conflicts with assumptions:

```text
STOP → REPORT → UPDATE PLAN
```

## Domain authority

Integration agents may implement adapters. They MUST NOT redefine Catenor identity, Issuer Authority, Capabilities, Delegation, Trust Anchor Admission, Policy, or Decision semantics.

## AI/provenance

When an official sponsor agent/skill materially contributes:

- update the prompt artifact;
- update `AI_USAGE.md`;
- record dependencies/versions in `PROVENANCE.md`;
- add a `BUILD_LOG.md` entry;
- preserve judge-verifiable artifacts.

## Done means more than SDK success

A sponsor integration is done only when:

```text
slice acceptance criteria pass
negative path is demonstrated
artifacts exist
domain boundary is preserved
tests pass
AI/provenance docs are current
```
