# Final demo — LIVE ATS `issueByPartition` → Investor B, signed by the Privy SPV wallet (rehearsal asset)

**Date:** 2026-09-11 (consensus timestamp `1789148914.260632325`)  
**Evidence class:** REAL Hedera **Testnet** transaction (chain 296). This is the one Investor B issuance the maintainer authorized (prompt `2026-09-11-014`). No lifecycle/dividend operation has been done.  
**Command:** `pnpm --filter @catenor-one/api issue:investor B --broadcast`. Output plus a read-back: `issue-investor-b.json`.

**Path:** the same as Investor A (`issue-investor-a.md`):

1. The Catenor signer boundary builds `issueByPartition({partition: 0x…01, tokenHolder: Investor B, value: 400, data: 0x})`.
2. READ-ONLY `eth_call` + `eth_estimateGas` from the SPV wallet.
3. Privy `eth_signTransaction` under the SPV rule `allow-issueByPartition-rehearsal-equity`.
4. The signed transaction must equal the prepared one, then it is broadcast through hashio. No raw operator key; one attempt; no retry.

## Result (read back)

| | |
|---|---|
| Transaction | [`0x5ea23774ef08a9046ae2135bfeb243e1bd385d153b8d1d8a703c883d4c8c58f7`](https://hashscan.io/testnet/transaction/0x5ea23774ef08a9046ae2135bfeb243e1bd385d153b8d1d8a703c883d4c8c58f7) — receipt SUCCESS; Mirror Node SUCCESS |
| Token | ATS equity [`0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418`](https://hashscan.io/testnet/contract/0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418) |
| Sender | `0x6c6AD33BA7FB4DA58A1b7412706f8ECB10Ba9C93` (Privy SPV wallet, `ROLE_ISSUER`); nonce 2 → 3 (exactly one increment) |
| Holder | Investor B `0x72f94a15A815853B488BCf225ec3cb67eC5ba444` (Privy receiving wallet) |
| Balances | Investor B 0 → **400** (default partition 400); Investor A **600** (unchanged); total supply 600 → **1,000**; security holders 2 |
| Gas | limit 1,000,000; used 405,329; price 1,130,000,000,000 weibar |
| Actual cost | **0.45802177 HBAR** (SPV balance 91.82632458 → 91.36830281) |

## Rehearsal-asset summary (all LIVE, Hedera Testnet, all signed by the Privy SPV wallet)

| Step | Transaction | Cost (HBAR) |
|---|---|---|
| `deployEquity` (after a Catenor ALLOW) | `0x8265479f…5897` | 7.65768465 |
| `issueByPartition` → Investor A (600) | `0x9e6c86c4…04bf` | 0.51599077 |
| `issueByPartition` → Investor B (400) | `0x5ea23774…58f7` | 0.45802177 |

## OPEN final-demo gaps (not solved by this rehearsal)

1. **FD-2:** dynamic SPV Privy wallet and policy provisioning after the Sponsor's TOKENIZE_ASSET ALLOW. This rehearsal used the pre-provisioned CP1 wallet.
2. **Issuance authorization and binding through Catenor:** the two issuances were maintainer-authorized rehearsal scripts. The Catenor runtime authorization of issuance and the private `did:catenor` ↔ wallet Account Binding it resolves are not implemented.
