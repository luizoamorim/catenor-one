# Final demo CP4 — Privy function-level policy for ATS `issueByPartition` (LIVE probe, NO broadcast)

**Date:** 2026-09-11  
**Evidence class:** LIVE calls to the Privy **development** app (`@privy-io/node` 0.34.0).

- Run by the `privy-engineer` project subagent on **throwaway** resources: in-memory keys, a probe policy and wallet, never funded.
- The wrapper check was re-run by the main session.
- The real SPV policy was **not** touched by the probe.
- **No transaction was broadcast.** Privy identifiers and keys are not recorded.

## Result: function-level restriction CONFIRMED

Probe rule: ALLOW `eth_signTransaction` iff all of:

- `ethereum_transaction.chain_id eq "296"`;
- `ethereum_transaction.to eq 0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418` (rehearsal ATS equity);
- `ethereum_calldata.function_name eq "issueByPartition"`, with the ABI `issueByPartition((bytes32 partition, address tokenHolder, uint256 value, bytes data) _issueData)`.

| # | Signed with the runtime-signer key | Result |
|---|---|---|
| 1 | `issueByPartition(0x…01, holder, 600, 0x)` → equity, chain 296 | SIGNED (recovered from = probe wallet, chainId 296) |
| 2 | same, chain 1 | DENIED — 400 `policy_violation` |
| 3 | same calldata → ATS Factory | DENIED — 400 |
| 4 | `grantRole` → equity | DENIED — 400 |
| 5 | `controllerTransferByPartition` → equity | DENIED — 400 |
| 6 | `redeemByPartition` → equity | DENIED — 400 |
| 7 | `issueByPartition` selector + undecodable bytes | DENIED — 400 |

**Nested tuple field CONFIRMED:** `ethereum_calldata.issueByPartition._issueData.partition eq 0x…01`. Partition `0x…01` was signed; partition `0x…02` was DENIED (400).

**Policy update mechanics CONFIRMED:**

- Owner-authorized rule creation and policy update succeed.
- The same request with the runtime-signer key → 401.
- The SDK wrapper `policies().createRule(policyId, { …rule, authorization_context })` stored the exact four-condition rule on a throwaway policy. That policy was then deleted with the owner key.

## Approved SPV issuance rule (applied by the maintainer, not by the runtime)

`apps/api/scripts/privy/add-spv-issuance-rule.mjs` adds exactly one rule to the SPV policy:

```text
allow-issueByPartition-rehearsal-equity:
  ALLOW eth_signTransaction iff chain_id == 296
                              ∧ to == 0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418
                              ∧ function == issueByPartition
                              ∧ issueByPartition._issueData.partition == 0x…01
```

- The existing rules (deployEquity via the ATS Factory; export denied) are unchanged.
- There is no chain-only rule.
- The Catenor signer boundary still builds the exact calldata from structured input and requires the signed transaction to equal it (defense in depth).

## Not constrained by the policy (honest)

`tokenHolder` and `value` are not restricted by Privy. The Catenor signer boundary builds the calldata for the exact holder and amount, and refuses the SPV wallet itself as a holder, a zero amount and any other signed payload.
