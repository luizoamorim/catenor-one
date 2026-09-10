# Plan — 2026-09-10-004 — S001 Source-of-Truth Cleanup

**Project:** Catenor One  
**Slice:** S001 — Trust Anchor Admission  
**Related prompt:** `docs/hackathon/prompts/2026-09-10-005-s001-source-of-truth-cleanup.md`  
**Status:** Completed  
**Type:** Documentation/source-of-truth alignment

## Goal

Align S001 SPEC / ACCEPTANCE / TEST-VECTORS and related judge/architecture documentation with the approved PLAN revision before implementation.

## Files in scope

```text
slices/S001-trust-anchor-admission/SPEC.md
slices/S001-trust-anchor-admission/ACCEPTANCE.md
slices/S001-trust-anchor-admission/TEST-VECTORS.md
slices/S001-trust-anchor-admission/README.md

artifacts/judges/s001/README.md
artifacts/judges/s001/trust-anchor-flow.html

docs/architecture/ARCHITECTURE.md
README.md
```

`PLAN.md` / `TASKS.md` were updated only as needed to record the final approved decisions.

## Human decisions incorporated

### Verification Method commitment

Bootstrap endorsement binds a commitment to the canonical Verification Method, including:

```text
id
controller
type
publicKeyMultibase
```

Conceptually:

```text
verificationMethodCommitment =
SHA-256(JCS(canonical VerificationMethod))
```

Purpose: detect replacement of a public key under the same Verification Method ID.

### Provider-binding mismatch

```text
Sumsub applicant externalUserId
!=
expected Catenor bindingRef
→ required confidential verification cannot succeed
→ Admission must not ALLOW
```

Add explicit acceptance/test coverage.

### Railway bucket

Do not provision/use the Railway private bucket for S001 evidence retention.

S001 remains:

```text
COMMITMENT_ONLY
```

### Evidence commitment wording

The commitment:

- binds the Admission to the normalized commitment preimage/provider-response digests;
- does not preserve or reconstruct raw provider evidence.

## Cleanup requirements

- remove all S001 LLM/Anthropic requirements;
- use exactly three CRE persistent secrets:
  - `SUMSUB_APP_TOKEN`
  - `SUMSUB_SECRET_KEY`
  - `CATENOR_INTERNAL_API_TOKEN`
- use `identity-confidential` as the CRE workflow boundary;
- use `trust-anchor-admission` as the S001 operation;
- fix the Sumsub/provider binding sequence;
- add provider-binding mismatch behavior;
- use commitment-only retention;
- remove custom evidence encryption;
- use precise HTTPS-inside-TEE terminology;
- narrow Trust Anchor verification claims;
- bind `verificationMethodCommitment`;
- preserve stable AC/TV identifiers by retiring/reserving removed IDs.

## Validation

Cross-check:

```text
SPEC
↔ ACCEPTANCE
↔ TEST-VECTORS
↔ PLAN
↔ TASKS
```

Expected final state:

```text
no LLM in S001
three CRE secrets
identity-confidential boundary
provider-binding sequence aligned
provider-binding mismatch covered
COMMITMENT_ONLY
verificationMethodCommitment
180-day freshness reference
Sumsub sandbox labeling
narrow lifecycle-status claim
```

## Outcome

Claude Code reported:

- all test-vector IDs mapped to PLAN verification/tasks;
- acceptance references valid;
- S001 source-of-truth aligned with PLAN/TASKS;
- only documentation files changed;
- no production code/dependencies/migrations/CRE project/deployments created.

## Next step

Begin Phase 0 technical validation:

```text
create/review cre-engineer
→ Privy signing spike
→ CRE runtime/scaffolding spike
→ Sumsub sandbox spike
→ report results
→ human approval
→ start P0 implementation
```
