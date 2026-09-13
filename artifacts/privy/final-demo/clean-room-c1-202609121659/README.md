# Final demo: Privy controls, instance `c1-202609121659`

**Date:** 2026-09-12 (UTC) · **Privy app:** development app `catenor-one-ethonline-2026`, created empty for this run ·
**Run log:** [`artifacts/final-demo/RUN-LOG.md`](../../../final-demo/RUN-LOG.md)

**Signing model.** Catenor decides **whether** an action is allowed: a scoped authority chain plus a confidential
eligibility decision from the deployed Chainlink CRE workflow. A Privy policy bounds **what** each key can sign. Every
execution wallet has:

- its own management-owner key, kept on the maintainer's machine and never in the runtime;
- its own runtime signer, a 1-of-1 key quorum that is override-scoped to the wallet's policy.

The runtime can therefore request signatures but cannot change a policy. Hedera transactions are signed with
`eth_signTransaction` for chain 296 and broadcast by the runner.

## Wallets and policies

Read back live in stage 92, and checked against the dashboard screenshots.

| Wallet | Chain | Policy | What it allows (everything else denied; exports denied) |
|---|---|---|---|
| Bootstrap Endorsement Key `HKQY5…nVEk` | Solana (Ed25519) | `P_BOOTSTRAP` `vzww22mkxmtn4f333fdqpse7` | `signMessage` only. It endorses the root Trust Anchor after an ALLOW decision, and has its own owner and runtime quorum |
| Assertion keys (Trust Anchor `9PvXY…PGkT`, Sponsor `GLHPd…oTdX`, investor holder keys, 3 abandoned stage 11 attempts) | Solana (Ed25519) | `P_ASSERT` `e8d0ndsssfq6rr7p2im0ptt4` (7 wallets) | `signMessage` only: credentials, grants, presentations. **Never a financial key** |
| SPV `0x182F…9926` | EVM | `catenor-one-spv-execution-4c875d44` `cygll4bmgocqr05asp2w6f2s` | `eth_signTransaction` on chain 296 to the ATS v8 Factory. After `deployEquity`, the owner added `issueByPartition` (default partition), `grantRole(ROLE_CORPORATE_ACTION, SPV)` and `setDividend`, each pinned to equity `0xf37A…7ABC`. JSON: [`spv-policy-after-equity.json`](spv-policy-after-equity.json) |
| Distribution Agent `0x9089…13E3` | EVM | `catenor-one-distribution-agent-3d8dc074` `p99xe36icsfvewrovm1mczwq` | `eth_signTransaction` on chain 296 **only to Investor A's or Investor B's receiving wallet, value ≤ 20 HBAR**. JSON: [`agent-policy.json`](agent-policy.json). Stage 92: "Agent policy exactly the approved boundary: true" |
| Treasury `0x49e9…5210` | EVM | `catenor-one-clean-room-testnet-treasury` `zqr5ynnrd3mi6o9snqq8ex8g` | chain 296 transfers ≤ 30 HBAR. Bootstrap funding only |
| Investor A `0x7de5…2473` and Investor B `0xCfCa…Da73` | EVM | none | **receive-only**: an owner key, no signer, no policy. Catenor cannot sign for them |

## What the controls did in the run

- **Created only after authorization.** The SPV wallet and policy were created only after the Sponsor's
  `TOKENIZE_ASSET` was ALLOW. The Agent wallet and policy were created under `CREATE_AGENT`. The Agent still could
  not distribute until the delegated `EXECUTE_DISTRIBUTION`: before delegation, and with the relationship alone, both
  requests were DENY `CAPABILITY_MISSING`.
- **Every signature fit a rule.** Each Hedera transaction was dry-signed first (the signature was discarded), then
  signed live under exactly one rule. The deploy, both issuances, `grantRole` and `setDividend` were signed by the SPV.
  The payout was signed by the Agent.
- **The HOLD holder got nothing.** Investor B's 4 HBAR were held by the TEE plan, and **no transaction was built and
  no Privy signature was requested**: `investorBSignatureRequests: 0`, Agent nonce 0 → 1.

## Limitations

The Privy dashboard shows these wallets at `$0.00`, and its Transactions tab lists none of them. Privy's balance lookup
does not cover Hedera (chain 296), and Privy only signed; the runner broadcast the transactions. The money side is on
HashScan: [`artifacts/hedera/final-demo/clean-room-c1-202609121659.md`](../../../hedera/final-demo/clean-room-c1-202609121659.md).

Screenshots: `artifacts/final-demo/screenshots/`, files `10-*`, `20-*`, `30-*`, `70-*` and `92-verify-privy.png`.
