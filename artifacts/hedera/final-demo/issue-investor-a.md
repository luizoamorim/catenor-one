# Final demo — LIVE ATS `issueByPartition` → Investor A, signed by the Privy SPV wallet

**Date:** 2026-09-11 (consensus timestamp `1789148632.288073294`)  
**Evidence class:** REAL Hedera **Testnet** transaction (chain 296). This is the one issuance the maintainer authorized (prompt `2026-09-11-013`). Investor B has **not** been issued.  
**Command:** `pnpm --filter @catenor-one/api issue:investor A --broadcast`. Output: `issue-investor-a.json`.

## Path

1. The Catenor signer boundary builds the calldata from structured input: `issueByPartition({partition: 0x…01, tokenHolder: Investor A, value: 600, data: 0x})`.
2. READ-ONLY `eth_call` + `eth_estimateGas` from the SPV wallet (485,034 gas).
3. Privy `eth_signTransaction` by the SPV runtime-signer key. It is allowed only by the SPV policy rule `allow-issueByPartition-rehearsal-equity`: chain 296 ∧ to = equity ∧ function `issueByPartition` ∧ partition `0x…01`. The maintainer added that rule with the owner key; the runtime never holds it.
4. The signed transaction must equal the prepared one, then it is broadcast through hashio. No raw operator key was used; no retry.

## Result (read back)

| | |
|---|---|
| Transaction | [`0x9e6c86c4e8d2674f3d49142b14f7c9d194cb025dfa604ee684ad362e034a04bf`](https://hashscan.io/testnet/transaction/0x9e6c86c4e8d2674f3d49142b14f7c9d194cb025dfa604ee684ad362e034a04bf) — receipt SUCCESS; Mirror Node SUCCESS |
| Token | ATS equity [`0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418`](https://hashscan.io/testnet/contract/0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418) ("Catenor One Demo Asset 001 (SYNTHETIC)") |
| Sender | `0x6c6AD33BA7FB4DA58A1b7412706f8ECB10Ba9C93` (Privy SPV wallet, `ROLE_ISSUER`); nonce 1 → 2 |
| Holder | Investor A `0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78` (Privy receiving wallet) |
| Balances | Investor A 0 → **600** (default partition 600); total supply 0 → **600**; security holders 1; Investor B 0 (unchanged) |
| Gas | limit 1,000,000; used 456,629; price 1,130,000,000,000 weibar |
| Actual cost | **0.51599077 HBAR** (SPV balance 92.34231535 → 91.82632458) |

## Limits (honest)

- This rehearsal issuance was authorized by the maintainer and run through the Privy SPV signer path by a script. The Catenor runtime authorization of issuance, and the private `did:catenor` ↔ wallet Account Binding it would resolve, are not implemented yet (FD-4 remainder).
- The SPV wallet, its policy and this equity are rehearsal/checkpoint infrastructure. FD-2 (dynamic SPV wallet and policy provisioning after the Sponsor's ALLOW) is required for the final recorded demo.
