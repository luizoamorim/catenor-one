# S001 — Step A: trust-anchor-admission through `cre workflow simulate` (MOCK Sumsub server)

**Historical record, superseded.** This run used `cre workflow simulate`, and its SIMULATION label is accurate. The final demo (2026-09-12, instance `c1-202609121659`) ran every confidential operation on the **deployed** Confidential Workflow: see [`../../final-demo/deployed-run-c1-202609121659.md`](../../final-demo/deployed-run-c1-202609121659.md). Anything below about enrollment (B1) or deployment being open describes the state on this record's date.

**Date:** 2026-09-11 · **Evidence class:** SIMULATION — `cre workflow simulate` (CRE CLI v1.33.0, `@chainlink/cre-sdk` 1.18.0),
production-like limits file. **The simulator is not a TEE; nothing here is evidence of a deployed Confidential Workflow (B1).**
**Representative data came from a local MOCK Sumsub server (synthetic applicant); company evidence is the SYNTHETIC MOCK fixture.**
This is not Sumsub evidence of any kind. Step B (REAL Sumsub sandbox representative) is recorded separately.

Reproduce: `pnpm test:cre-sim` (needs the CRE CLI, `bun install` in `workflows/identity-confidential`, and the git-ignored
`workflows/.env.simulation-synthetic` with synthetic values).

## Path exercised

```text
Catenor API (application service, real PostgreSQL via Testcontainers, FAKE signers — labeled)
  → U7: private context sealed (AES-256-GCM, HKDF from the channel token, base64 transport)
  → cre workflow simulate identity-confidential (config generated from the pinned Bootstrap Configuration)
      handlerInTee: batched getSecrets → open sealed context → TRUST_ANCHOR_ADMISSION
        → MOCK company fixture (MOCK_COMPANY_ACTIVE_GREEN) + HTTP GET representative /one (MOCK Sumsub server,
          request signature verified by the server) → provider-binding gate → normalization (§20.8)
          → fact derivation (§20.4) → minimal reconciliation → evidence commitment (§23)
        → HTTP POST callback (HMAC over timestamp + body)
  → API callback receiver: HMAC + timestamp + commitment recomputation → U8 → U9 policy → U10 endorsement → ACTIVE
  → U13 Trust Anchor verification
```

## Results

| Case | Result | Status |
|---|---|---|
| Representative GREEN | six evidence facts true; reconciliation CONSISTENT/CONSISTENT; ALLOW → endorsement → ACTIVE → `TRUST_ANCHOR_VALID = true` (12/12 checks); audit chain valid | SIMULATION-CONFIRMED |
| Representative RED (SANCTIONS, FINAL) | `AUTHORIZED_REPRESENTATIVE_VERIFIED = false` (trace FALSE, reasons SANCTIONS, FINAL) → DENY | SIMULATION-CONFIRMED |
| Standalone suite (no receiver) | valid context → handler runs → `FAILED / CALLBACK_UNREACHABLE`; wrong key, other operation, other runId, flipped ciphertext bit, flipped tag bit, expired → `SEALED_CONTEXT_OPEN_FAILED`; unknown operation → `UNKNOWN_OPERATION` | SIMULATION-CONFIRMED |

Simulator user-log excerpt (GREEN run; TEE logs are treated as public and carry allowlisted events only):

```text
[USER LOG] workflow_started
[USER LOG] secrets_fetched
[USER LOG] context_opened
[USER LOG] operation_routed operation=TRUST_ANCHOR_ADMISSION
[USER LOG] tta_evaluated status=OK code=OK
[USER LOG] handler_completed status=DELIVERED code=OK
Workflow Simulation Result: "{\"status\":\"DELIVERED\",\"code\":\"OK\"}"
```

Findings: the TEE handler is synchronous (SDK capability calls resolve with `.result()`); `--config` paths are capped at
97 characters and resolved relative to the workflow folder; localhost HTTP works in simulation only (production requires
HTTPS).
