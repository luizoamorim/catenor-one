# Final demo CP7 — Chainlink CRE Confidential Workflow `INVESTOR_ELIGIBILITY` (SIMULATION, REAL Sumsub sandbox)

**Historical record, superseded.** This run used `cre workflow simulate`, and its SIMULATION label is accurate. The final demo (2026-09-12, instance `c1-202609121659`) ran every confidential operation on the **deployed** Confidential Workflow: see [`deployed-run-c1-202609121659.md`](deployed-run-c1-202609121659.md). Anything below about enrollment (B1) or deployment being open describes the state on this record's date.

**Date:** 2026-09-11  
**Evidence class:** **SIMULATION**. `cre workflow simulate` of `workflows/identity-confidential` (`handlerInTee`), driven by the Catenor API during `pnpm demo:s001 --distribution`.

- This is **not** a deployed or production TEE. Confidential Workflows deployment enrollment (B1) was still open at the time.
- The provider calls inside the handler went to the **REAL Sumsub sandbox** (`https://api.sumsub.com`, synthetic applicants). The mock Sumsub server was **not** used.
- Company/KYB evidence is not part of this operation; in S001 it remains SYNTHETIC MOCK.

## Path (per investor holder)

1. The API seals the private context with AES-256-GCM (AAD = operation ‖ runId): investor did, Sumsub applicant id, bindingRef, notAfter. It is the same channel as S001.
2. Inside `handlerInTee`:
   1. one signed Sumsub sandbox `GET /resources/applicants/{id}/one`;
   2. binding gate: `externalUserId == bindingRef` and type `individual`;
   3. N1–N6 normalization;
   4. three facts: `INVESTOR_IDENTITY_VERIFIED`, `INVESTOR_AML_CLEAR`, `EVIDENCE_FRESH`;
   5. minimal reconciliation;
   6. evidence commitment, `SHA-256(JCS(commitmentInput ‖ salt))`.
3. The raw provider response stays in the TEE. The authenticated callback (HMAC, ±5 min, commitment recomputed by the API) carries only facts, sanitized reason codes, the reconciliation class and the commitment.
4. The API applies `policy:distribution-eligibility:v1` [REF-IMPL] and creates one protocol Decision per holder (action `RECEIVE_DISTRIBUTION` [REF-IMPL]).

## Results (demo run 2026-09-11T18:23Z)

| Holder | Units (Hedera testnet, read-only) | Sumsub sandbox current review | Facts | Reconciliation | Evidence commitment | Decision |
|---|---|---|---|---|---|---|
| Investor A | 600 | GREEN | identity TRUE, AML TRUE, fresh TRUE | CONSISTENT | `0xdf8a7300e579a00768b53eb67a74bab6fe11cd7b2e8456f5752b777e48729260` | **ALLOW → PAY 6 HBAR** |
| Investor B | 400 | RED (`SANCTIONS`, `FINAL`) | identity FALSE, AML FALSE, fresh TRUE | MISMATCH | `0x2a7633c7be9ad5bb7e6df249edf23b1edecdba1899b7222fc747ab1ff73d7e61` | **DENY → HOLD 4 HBAR** |

- The blind DRY RUN (holdings only) proposed A 6 HBAR / B 4 HBAR. **Nothing was sent.**
- Investor B keeps its 400 units: ownership ≠ current eligibility.
- Decision commitments: A `0x011c78b2…9588`, B `0x534049ff…2bdf`.
- Mechanics check: `cre-engineer` ran the D6 simulation suite and an `INVESTOR_ELIGIBILITY` case with synthetic secrets (see BUILD_LOG CP7).
