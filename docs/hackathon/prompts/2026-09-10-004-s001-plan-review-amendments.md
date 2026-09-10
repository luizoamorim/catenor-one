# S001 Plan Review Amendments

**Date:** 2026-09-10  
**Project:** Catenor One  
**Slice:** S001 — Trust Anchor Admission  
**Type:** Human-reviewed planning amendments  
**Status:** Applied to `PLAN.md` / `TASKS.md`

## Objective

Review the initial S001 implementation plan and tasks before any production code is written, preserving the approved protocol and architecture while reducing hackathon risk and removing unnecessary complexity.

## Human-reviewed decisions

### CRE workflow boundary

Replace:

```text
workflows/trust-anchor-admission/
```

with:

```text
workflows/identity-confidential/
```

S001 contributes the first capability/handler:

```text
identity-confidential
└── trust-anchor-admission
```

Future Subject Continuity / Provider Reconciliation may add another handler to the same workflow.

Architectural rule:

```text
WORKFLOW
=
security boundary
+
cohesive business responsibility
+
lifecycle/deployment boundary

HANDLER
=
specific operation / entry point
```

### Remove LLM from S001

Remove Anthropic / Claude / any LLM integration completely from S001.

The confidential path becomes:

```text
Sumsub
→ Chainlink CRE Confidential Workflow
→ handlerInTee
→ deterministic provider normalization
→ deterministic fact derivation
→ minimized verified facts
→ Catenor Admission Policy
→ ALLOW / DENY
```

LLM-in-TEE remains only a possible future technique for Subject Continuity if ambiguous or unstructured evidence genuinely requires semantic interpretation.

### Commitment-only evidence retention

Do not implement custom ECIES / X25519 evidence encryption in S001.

S001 uses:

```text
minimized verified facts
evidenceCommitment
private provider references
CRE execution references
```

Raw Sumsub responses and raw PII are not persisted by Catenor.

Railway private bucket remains part of the broader architecture but is not required for S001 evidence retention.

### Provider-binding sequence

Catenor-generated provider binding references must exist before Sumsub applicants are expected to use them as `externalUserId`.

Correct sequence:

```text
StartInitialAdmission
→ create Subject + did:catenor + bindingRefs
→ operator configures Sumsub applicants using bindingRefs
→ AttachProviderReferences
→ verify externalUserId == expected bindingRef inside TEE
→ continue confidential verification
```

Applicant IDs remain private operational state.

### P0 Fast Lane

Add an explicit hackathon P0 path so P1/P2 engineering does not block the live demo.

Priority path:

```text
minimal foundation
→ domain primitives
→ private PostgreSQL state
→ Privy auth + allowlist
→ did:catenor
→ assertion key + key possession
→ Bootstrap Configuration
→ identity-confidential
→ Sumsub confidential verification
→ minimized facts + evidenceCommitment
→ Admission Policy
→ bootstrap endorsement
→ Admission Record + ACTIVE projection
→ verification view
→ product UI
→ Judge Inspector
→ Railway deployment
→ real CRE deploy
→ live happy path
→ live DENY paths
→ artifacts + provenance
```

## Decision register summary

```text
D1  Privy Ed25519 assertion signer
    → provisionally approved, pending spike

D2  separate bootstrap signer
    → approved, no mandatory two-person rule

D3  crypto profile
    → approved as Catenor One [REF-IMPL]

D4  missing fact
    → DENY, while trace distinguishes MISSING from FALSE

D5  freshness rules
    → Bootstrap Configuration, 180-day reference value

D6  Sumsub sandbox
    → approved with explicit sandbox labeling

D7  representative authority
    → deterministic provider evidence only

D8  LLM
    → removed from S001

D9  CRE deployment registry
    → private

D10 CATENOR_INTERNAL_API_TOKEN
    → approved

D11 sealed trigger context
    → conditionally approved pending runtime spike

D11a HTTPS via HTTPClient inside handlerInTee
     → confirmed

D12 DON-signed report
    → approved P1

D13 custom ECIES evidence retention
    → rejected; use COMMITMENT_ONLY

D14 Admission Record extensions
    → approved as Catenor One [REF-IMPL]

D15 one Initial Trust Anchor per Trust Domain
    → approved; rehearsals use resettable staging

D16 audit hash chain
    → approved; append-only DB trigger P1

D17 tooling/dependencies
    → approved after removing unnecessary LLM/encryption deps

D18 Privy email auth
    → approved

D19 Railway dashboard config
    → approved

D20 CRE workflow
    → amended to identity-confidential

D21 lifecycle changes through test harness only in S001
    → approved

D22 public read-only Judge Inspector
    → approved for hackathon

D23 failed key proof
    → immediate DENY, no CRE provider call

D24 ADRs
    → approved near end of slice
```

## Additional architecture decisions

- `verificationMethodCommitment` should bind the complete canonical Verification Method, not only its ID.
- Trust Anchor Admission provenance is cryptographically verifiable.
- Current lifecycle status (`ACTIVE`, `SUSPENDED`, etc.) remains an operational projection in S001 unless a later signed status model is added.
- Real CRE deployment is mandatory; simulation is necessary but insufficient.
- Official sponsor tooling/docs must be consulted before concrete adapter implementation.

## Implementation rule

No production code should be written until the amended `PLAN.md`, `TASKS.md`, and source-of-truth cleanup are human-reviewed.
