# S001 Source-of-Truth Cleanup

**Date:** 2026-09-10  
**Project:** Catenor One  
**Slice:** S001 — Trust Anchor Admission  
**Type:** Human-reviewed source-of-truth alignment  
**Status:** Applied

## Objective

Align the S001 source-of-truth documents with the approved implementation-plan amendments before production code begins.

Files in scope:

```text
slices/S001-trust-anchor-admission/SPEC.md
slices/S001-trust-anchor-admission/ACCEPTANCE.md
slices/S001-trust-anchor-admission/TEST-VECTORS.md

slices/S001-trust-anchor-admission/README.md
artifacts/judges/s001/README.md
artifacts/judges/s001/trust-anchor-flow.html
```

Architecture documentation may also be updated only where previous S001 workflow naming or LLM-in-S001 references became stale.

## Approved cleanup decisions

### Remove LLM completely from S001

Remove from S001 implementation requirements:

```text
LLM_API_KEY
Anthropic / Claude integration
LLM HTTP call
LLM latency/fallback behavior
LLM-specific artifacts
LLM-specific acceptance criteria
LLM-specific test vectors
LLM-specific fields and modes
```

The S001 path becomes fully deterministic:

```text
Sumsub
→ CRE Confidential / handlerInTee
→ deterministic normalization
→ deterministic fact derivation
→ Admission Policy
→ ALLOW / DENY
```

Project-wide rules that an LLM must never be final identity/authority decision-maker may remain in general architecture documentation.

### Three CRE secrets

The S001 persistent CRE secret inventory is:

```text
SUMSUB_APP_TOKEN
SUMSUB_SECRET_KEY
CATENOR_INTERNAL_API_TOKEN
```

No additional long-lived S001 CRE secret should be introduced without explicit justification.

### identity-confidential workflow boundary

Replace stale S001 workflow references with:

```text
workflows/identity-confidential
```

S001 operation/handler:

```text
trust-anchor-admission
```

This keeps the workflow reusable for future confidential identity operations.

### Commitment-only retention

S001 uses:

```text
COMMITMENT_ONLY
```

Catenor stores:

```text
minimized verified facts
evidenceCommitment
private provider references
admission metadata
decision reference
CRE execution reference
```

Catenor does NOT store:

```text
raw Sumsub responses
raw PII
raw provider evidence snapshots
custom ECIES-encrypted evidence packages
```

The Railway private bucket remains part of the wider Catenor One architecture but is not used by S001 for raw identity evidence.

### Evidence commitment semantics

Do not claim that the commitment reconstructs or preserves the original Sumsub response.

Correct semantics:

> The commitment can be recomputed against the retained normalized commitment preimage and provider-response digests. It binds the Admission to what was observed during confidential execution, but does not preserve or reconstruct the raw provider evidence.

### Provider-binding sequence

Correct S001 setup sequence:

```text
StartInitialAdmission
→ create Subject + did:catenor + private bindingRefs
→ configure Sumsub applicants using bindingRefs as externalUserId
→ AttachProviderReferences
→ verify externalUserId == expected bindingRef inside TEE
→ continue confidential verification
```

Applicant IDs remain private.

### Provider-binding mismatch behavior

Add explicit behavior:

```text
Sumsub externalUserId != expected Catenor bindingRef
→ confidential verification cannot establish required facts
→ Admission must not ALLOW
```

This must appear in acceptance criteria and test vectors.

### Confidential HTTP terminology

Use the precise wording:

> HTTPS requests are executed from inside the confidential TEE boundary using the supported CRE `HTTPClient` with `TeeRuntime`.

Do not claim use of the separate CRE product/API named `ConfidentialHTTPClient` unless that product is actually used.

### Bootstrap endorsement binding

The Bootstrap Endorsement should bind a commitment to the complete canonical Verification Method used during Admission.

Conceptually:

```text
verificationMethodCommitment =
SHA-256(JCS({
  id,
  controller,
  type,
  publicKeyMultibase
}))
```

This makes public-key replacement under the same Verification Method ID detectable.

This is Catenor One `[REF-IMPL]` behavior.

### Trust Anchor verification wording

Correct claim:

> S001 cryptographically verifies Admission provenance and bootstrap endorsement, while current lifecycle status is read from the Catenor One operational status projection.

Do not overclaim current lifecycle status as cryptographically proven in S001.

### Retired IDs

Prefer retaining removed acceptance/test identifiers as:

```text
RESERVED
RETIRED
NOT APPLICABLE
```

rather than renumbering existing identifiers.

This preserves traceability across:

```text
SPEC
ACCEPTANCE
TEST-VECTORS
PLAN
TASKS
```

## Final consistency requirement

After cleanup:

```text
SPEC
↔ ACCEPTANCE
↔ TEST-VECTORS
↔ PLAN
↔ TASKS
```

must agree on:

- no LLM in S001;
- three CRE secrets;
- identity-confidential workflow boundary;
- provider binding sequence;
- provider-binding mismatch behavior;
- COMMITMENT_ONLY retention;
- verificationMethodCommitment;
- 180-day freshness reference value;
- Sumsub sandbox labeling;
- narrower Trust Anchor verification claim.

## Implementation gate

No production code, dependency installation, migration, `cre init`, agent creation, or deployment should occur as part of this cleanup step.

Implementation begins only after human review confirms the source-of-truth is aligned.
