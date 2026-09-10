# S001 — Trust Anchor Admission

This directory defines the first implementation slice of Catenor One.

## Purpose

S001 establishes the Initial Trust Anchor of a Catenor Trust Domain through:

```text
Bootstrap Access Gate
        ↓
Trust Domain Bootstrap Configuration
        ↓
Canonical Organization / did:catenor
        ↓
Credential Assertion Key + Proof of Possession
        ↓
Chainlink CRE Confidential Verification
        ↓
Real Sumsub evidence + auxiliary LLM
        ↓
Deterministic Admission Policy
        ↓
Bootstrap Endorsement
        ↓
Trust Anchor Admission Record
        ↓
ACTIVE Trust Anchor
```

## Source-of-truth documents

Read in this order:

1. `SPEC.md`
2. `ACCEPTANCE.md`
3. `TEST-VECTORS.md`
4. repository `docs/architecture/ARCHITECTURE.md`
5. repository `docs/architecture/CLAUDE-RULES.md`
6. repository `docs/PROTOCOL-BASELINE.md`

`PLAN.md` and `TASKS.md` are intentionally not finalized in this package.

They must be proposed only after reviewing the source-of-truth documents and current official integration tooling.

## Architecture

S001 follows:

> **Modular Monolith + Vertical Slices + DDD-lite + Clean Architecture boundaries.**

## Live integration requirements

Hackathon completion requires:

```text
real Chainlink CRE Confidential deployment
real handlerInTee execution
real Vault DON secret retrieval
real confidential Sumsub request
real end-to-end Admission result
```

Simulation is part of development, but simulation alone is not completion.

## Product vs Judge UI

The end-user product flow should remain simple.

Technical implementation evidence belongs in the S001 Judge Inspector under:

```text
artifacts/judges/s001/
```
