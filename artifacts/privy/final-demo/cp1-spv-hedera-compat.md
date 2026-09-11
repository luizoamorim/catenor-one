# Final demo CP1 — Privy SPV EVM wallet → Hedera Testnet (eip155:296), LIVE signing, NO broadcast

**Date:** 2026-09-11  
**Evidence class:**

- LIVE calls to the Privy **development** app (`@privy-io/node` 0.34.0);
- READ-ONLY Hedera Testnet JSON-RPC (`https://testnet.hashio.io/api`, chain 296).

Run by the `privy-engineer` project subagent (throwaway script under `scratch/`, not committed) and re-checked read-only by the main session.

**No transaction was broadcast. No HBAR was spent.** Privy identifiers and keys are deliberately not recorded here.

## Custody (S001 D34/D36 pattern, dedicated keys)

- Two new P-256 authorization keys: the SPV management owner (maintainer custody, never in the runtime) and the SPV runtime signer.
  - They are written once to a 0600 file outside the repository.
  - They are distinct from every S001 key.
- Key quorum: the runtime-signer public key, threshold 1.
- Policy `catenor-one-SPV-execution` (chain_type `ethereum`), owned by the management-owner key.
- SPV EVM wallet: owner = the management-owner key; policy attached; additional signer = the runtime quorum with `override_policy_ids = [SPV policy]`.

## Policy as stored by Privy (read back)

| Rule | Method | Action | Conditions |
|---|---|---|---|
| allow-signTx-hedera-factory | `eth_signTransaction` | ALLOW | `ethereum_transaction.chain_id eq "296"` AND `ethereum_transaction.to eq 0xd1F118A40f3b02883D35909eF2517e7EDd78379d` (ATS v8 Factory) |
| deny-exportPrivateKey | `exportPrivateKey` | DENY | — |
| deny-exportSeedPhrase | `exportSeedPhrase` | DENY | — |

Everything else is default-denied, including `eth_sendTransaction`, `personal_sign` and typed-data signing.

## Checks

| # | Check | Result |
|---|---|---|
| C1 | Wallet read back: `ethereum` chain type, owner, the policy attached, the additional signer with the override policy | PASS |
| C2 | `deployEquity` calldata (2,180 bytes) encoded with the existing `deployEquityArguments`, with operator = the SPV address | PASS |
| C3 | `eth_signTransaction` {chain 296, to Factory, deployEquity calldata, nonce 0} with the runtime-signer key | SIGNED. The recovered `from` equals the SPV address, chainId 296, `to` the Factory. The raw tx was not broadcast or stored. |
| C4 | Same transaction with chain_id 1 | DENIED — HTTP 400 `policy_violation` |
| C5 | Same transaction with a different `to` | DENIED — HTTP 400 `policy_violation` |
| C6 | Plain value transfer | DENIED — HTTP 400 `policy_violation` |
| C7 | Runtime-signer key → `exportPrivateKey` | DENIED — HTTP 401 |
| C8 | Runtime-signer key → policy update | DENIED — HTTP 401 |
| C9 | READ-ONLY: `eth_call` of the same `deployEquity` (SPV address as admin and issuer) from an existing account | Accepted. Returns an equity address; `eth_estimateGas` 7.40M gas ≈ 8.59 HBAR at 1,160 Gwei-equivalent (weibar). |

## Limits (honest)

- The runtime path is `eth_signTransaction`, then Catenor broadcasts through hashio. `eth_sendTransaction` (Privy broadcast) needs a caip2 chain that Privy serves. It was not tested and is not allowed by the policy.
- The ALLOW rule restricts chain and target contract, not the function. `ethereum_calldata` ABI conditions exist in the SDK types but were not tested here.
- `issueByPartition` targets the equity address, which is unknown until `deployEquity` succeeds. The current policy therefore does **not** allow it. This is an open item for the next checkpoint.
- The `exportPrivateKey` denial comes from authorization (the runtime signer is not the owner). The policy DENY rule is defense in depth.
