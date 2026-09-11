# Final demo — LIVE Hedera ATS `deployEquity` signed by the Privy SPV wallet, after a Catenor ALLOW

**Date:** 2026-09-11 (consensus timestamp `1789145624.531106104`)  
**Evidence class:** REAL Hedera **Testnet** transaction (chain 296). This is the one live transaction the maintainer authorized; no issuance has been done yet.  
**Run:** `pnpm demo:s001 --hedera-live`

- REAL: PostgreSQL, Privy development app, Sumsub **sandbox** representative.
- SIMULATION: Chainlink CRE (`cre workflow simulate`; B1 is open).
- MOCK: company evidence (SYNTHETIC MOCK).

**Re-verify from public data:** `pnpm --filter @catenor-one/api verify:ats 0x8265479fc7236b7b092899b49cfaf0d8d1ecb05e7ce2ff69aeda587e4ad75897`. Output: `deploy-equity.verify.json`.

## What happened, in order

1. **S001:** the Trust Anchor `did:catenor:f04bd5243a916b53a1ee168d09449e1a` was admitted and is ACTIVE; `TRUST_ANCHOR_VALID` true, 0 failed checks.
2. **Grant:** the Trust Anchor granted Org B (`did:catenor:410b9c645a229ad9bb1c0b91213a1d72`) the Capability `TOKENIZE_ASSET` on `spv:catenor-demo-001` [REF-IMPL]. The grant id is `capability-grant:5282690f-eb8a-4d18-bcbe-3a75a98d3be1`, signed `eddsa-jcs-2022` with the Trust Anchor's Privy Credential Assertion Key.
3. **DENY paths:**
   - Org C presenting Org B's grant → DENY `SUBJECT_MISMATCH`.
   - A tampered resource → DENY `SIGNATURE_INVALID`.
   - The SPV wallet nonce was 0 before and after: no transaction.
4. **Preflight:** READ-ONLY `eth_call` and `eth_estimateGas` of the exact transaction from the SPV wallet: 7,405,139 gas, maximum 17.55 HBAR.
5. **ALLOW → execution:**
   - Privy `eth_signTransaction` by the SPV runtime-signer key, under Privy policy `a417f2izlkwzvh1e0pl5juh1` (chain 296 ∧ ATS Factory only).
   - Catenor signer boundary: the signed transaction equals the prepared one.
   - Broadcast through `https://testnet.hashio.io/api`.
   - No raw operator key was used.
6. The Catenor audit chain ends `… ASSET_ACTION_AUTHORIZED, ASSET_ACTION_EXECUTED` and verifies.

## On-chain result (read back)

| | |
|---|---|
| Transaction | [`0x8265479fc7236b7b092899b49cfaf0d8d1ecb05e7ce2ff69aeda587e4ad75897`](https://hashscan.io/testnet/transaction/0x8265479fc7236b7b092899b49cfaf0d8d1ecb05e7ce2ff69aeda587e4ad75897) — SUCCESS (receipt and Mirror Node) |
| From | `0x6c6AD33BA7FB4DA58A1b7412706f8ECB10Ba9C93` (Privy SPV wallet; nonce 0, the first transaction from this account) |
| To | `0xd1F118A40f3b02883D35909eF2517e7EDd78379d` — ATS v8 Factory `0.0.9213391`, `deployEquity`, value 0 |
| ATS equity | [`0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418`](https://hashscan.io/testnet/contract/0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418) — contract `0.0.10479921` |
| Token | "Catenor One Demo Asset 001 (SYNTHETIC)", `C1DA001`, ISIN `XXCATENOR019` (synthetic; passes the factory checksum), 0 decimals, total supply 0, max supply 1,000,000 |
| Roles | the SPV wallet holds `DEFAULT_ADMIN_ROLE` and `ROLE_ISSUER`; internal KYC off |
| Grant link (on-chain input) | regulation `info` = `catenor-one:TOKENIZE_ASSET:spv:catenor-demo-001:grant:capability-grant:5282690f-eb8a-4d18-bcbe-3a75a98d3be1` |
| Gas | limit 15,000,000; used 6,898,815; price 1,110,000,000,000 weibar |
| Actual cost | **7.65768465 HBAR**. The SPV balance went 100.0 → 92.34231535; this equals gas used × gas price, so unused gas was refunded. |

## Limits (honest)

- The SPV wallet and its policy were provisioned before this run (CP1) and funded by the maintainer. Creating them at runtime after ALLOW (FD-2) is still open.
- The Privy policy restricts chain and target contract, not the function.
- The Catenor database was a throwaway PostgreSQL. The grant, DIDs and audit chain of this run are recorded in the local run record, not in a persistent deployment.
