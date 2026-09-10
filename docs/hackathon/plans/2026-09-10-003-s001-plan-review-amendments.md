# Plan — 2026-09-10-003 — S001 Plan Review Amendments

**Project:** Catenor One  
**Slice:** S001 — Trust Anchor Admission  
**Related prompt:** `docs/hackathon/prompts/2026-09-10-004-s001-plan-review-amendments.md`  
**Status:** Completed / applied to S001 planning  
**Type:** Human-reviewed implementation-plan revision

## Goal

Review the first Claude Code proposal for `PLAN.md` / `TASKS.md` and remove architectural or hackathon-risk issues before implementation.

## Inputs

```text
Catenor Protocol pinned baseline
Catenor One architecture baseline
S001 SPEC
S001 ACCEPTANCE
S001 TEST-VECTORS
Claude Code PLAN/TASKS revision 1
current Chainlink / Privy / Sumsub documentation
```

## Human-approved decisions

### CRE boundary

```text
workflows/identity-confidential
└── trust-anchor-admission
```

Use workflow boundaries for cohesive confidential responsibilities rather than one workflow per slice.

### S001 becomes fully deterministic

Remove the LLM from S001.

```text
Sumsub
→ CRE handlerInTee
→ deterministic normalization
→ deterministic fact derivation
→ Catenor Admission Policy
```

### Evidence retention

Use:

```text
COMMITMENT_ONLY
```

No custom ECIES scheme and no raw Sumsub evidence retention.

### Provider-binding sequence

```text
StartInitialAdmission
→ generate Subject / did:catenor / bindingRefs
→ configure Sumsub applicants with those refs
→ AttachProviderReferences
→ verify provider binding inside TEE
```

### Hackathon delivery

Add an explicit P0 Fast Lane prioritizing:

```text
real end-to-end demo
real CRE deployment
real Sumsub sandbox call
live happy path
live DENY path
judge-verifiable artifacts
```

P1/P2 work must not block P0.

## Other decisions

- Privy assertion signer approved provisionally, pending spike.
- Separate bootstrap signer approved.
- Crypto profile remains Catenor One reference behavior.
- Missing required policy facts → DENY; private trace preserves MISSING.
- Freshness threshold = 180 days as reference implementation configuration.
- Sumsub sandbox approved and must be clearly labeled.
- `CATENOR_INTERNAL_API_TOKEN` approved for private request/result channel if the spike validates the design.
- HTTPS inside `handlerInTee` uses the normal CRE HTTP client with `TeeRuntime`.
- Private CRE deployment registry preferred.
- DON-signed result report treated as desirable P1.
- Current Trust Anchor lifecycle status is an operational projection in S001.
- `cre-engineer` subagent required before substantial CRE implementation.
- Official `cre init` scaffolding required when implementation starts.

## Files affected

```text
slices/S001-trust-anchor-admission/PLAN.md
slices/S001-trust-anchor-admission/TASKS.md
```

No source-of-truth files were modified during this plan-review step.

## Validation

Claude Code was instructed to:

- retain full test-vector traceability;
- update the decision register;
- identify source-of-truth cleanup required;
- stop before code.

## Outcome

S001 PLAN/TASKS revision 2 was produced and returned for human review.

## Next step

Run the separate source-of-truth cleanup plan before implementation begins.
