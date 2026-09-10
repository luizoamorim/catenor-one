# S001 — Trust Anchor Admission

This directory defines the first implementation slice of Catenor One.

## Purpose

S001 establishes the Initial Trust Anchor of a Catenor Trust Domain through:

```text
Bootstrap Access Gate
        ↓
Trust Domain Bootstrap Configuration
        ↓
Canonical Organization / did:catenor + private provider bindingRefs
        ↓
Credential Assertion Key + Proof of Possession
        ↓
Chainlink CRE Confidential Workflow identity-confidential
(operation trust-anchor-admission, handlerInTee)
        ↓
Real Sumsub sandbox evidence → deterministic facts + evidence commitment
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

`PLAN.md` (Rev 2) and `TASKS.md` were approved on 2026-09-10 after review of the source-of-truth documents and current official integration tooling. The Rev 2 amendments are applied to `SPEC.md`, `ACCEPTANCE.md` and `TEST-VECTORS.md` (T0.9).

## Architecture

S001 follows:

> **Modular Monolith + Vertical Slices + DDD-lite + Clean Architecture boundaries.**

## Live integration requirements

Hackathon completion requires:

```text
real Chainlink CRE Confidential deployment (identity-confidential, private registry)
real handlerInTee execution (trust-anchor-admission)
real Vault DON secret retrieval (3 secrets)
real Sumsub sandbox request executed over HTTPS from inside the TEE
real end-to-end Admission result
```

S001 uses no LLM. Evidence retention is COMMITMENT_ONLY: Catenor never persists raw Sumsub responses.

Simulation is part of development, but simulation alone is not completion.

## Product vs Judge UI

The end-user product flow should remain simple.

Technical implementation evidence belongs in the S001 Judge Inspector under:

```text
artifacts/judges/s001/
```
