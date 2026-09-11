# S001 — Privy signers, LIVE (Privy development app)

**Date:** 2026-09-11 · **Evidence class:** LIVE calls to the Privy **development** app (`@privy-io/node` 0.34.0), run by
`pnpm test:privy-live` with maintainer-provisioned values (TASKS T0.4) read from the git-ignored `apps/api/.env`.
Synthetic data only; no funds; no transaction signed or broadcast. Identifiers, addresses and keys are deliberately not
recorded here.

| # | Check | Result |
|---|---|---|
| P1 | Credential Assertion Key wallet created by the runtime from PUBLIC values only (management-owner public key as owner, runtime-signer key quorum as additional signer, P_ASSERT) | PASS |
| P2 | Key-possession proof: W3C `eddsa-jcs-2022` hashData built by the Catenor signer boundary (64 bytes), signed by Privy `signMessage` with the runtime-signer authorization key, verified by Catenor's `verifyKeyPossession` (TV-S001-D01) | PASS — end-to-end Data Integrity interoperability through Privy |
| P3 | Runtime-signer authorization key → `exportPrivateKey` | DENIED — HTTP 401 |
| P4 | Runtime-signer authorization key → wallet update (remove policy) | DENIED — HTTP 401 (`invalid_data`) |
| P5 | Runtime-signer authorization key → policy update | DENIED — HTTP 401 (`invalid_data`) |
| P6 | Bootstrap Endorsement Key (separate wallet): endorsement signed through the signer boundary; `verifyEndorsement` → `{valid: true, failures: []}` (TV-S001-G01) | PASS |
| P7 | D36 key separation: bootstrap runtime key cannot sign with the assertion wallet, and the assertion runtime key cannot sign with the bootstrap wallet | DENIED both ways (HTTP 401/403) |
| P8 | S001 path (step A, `pnpm test:cre-sim`) with the Privy signers: Privy-signed key-possession proof → CRE SIMULATION evidence → ALLOW → Privy-signed bootstrap endorsement → ACTIVE → `TRUST_ANCHOR_VALID = true` | PASS (CRE part is SIMULATION; representative data from a MOCK Sumsub server in step A) |

Not claimed: transaction-sending denial (D35, unconfirmed live — no wallet funding or broadcast); that the Privy policy
enforces the message format or length (the Catenor signer boundary does, D33).
