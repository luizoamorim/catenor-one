# Final demo CP7 — CREATE DISTRIBUTION AGENT: live Privy Agent wallet + narrow policy (NO transaction)

**Date:** 2026-09-11  
**Evidence class:** LIVE calls to the Privy **development** app (`@privy-io/node` 0.34.0), made by the Catenor runtime during `pnpm demo:s001 --distribution`.  
No transaction was signed or broadcast; the Agent wallet is unfunded. Privy ids and keys are not recorded.

## What Catenor did (live demo action)

1. Created an AGENT Subject with a random `did:catenor`: `did:catenor:bb5870b9b4d00001b71a8a60ece520f3`.
2. Created, through the Privy API and from public values only:
   - the Agent wallet policy, owned by the Agent management-owner key (outside the runtime);
   - a dedicated Agent EVM wallet, `0x5037705014596A9050A51Bc131c9B55Cf98fFC51`, with that policy attached and the Agent runtime-signer quorum as an override-scoped additional signer.
   - The runtime read back the wallet and checked that exactly this policy and this signer scope were stored.
3. Stored the wallet as a **private** Account Binding (`AGENT_EXECUTION`, CAIP-10 `eip155:296:0x5037…FC51`).
4. The ACTIVE Trust Anchor (S001) granted a signed Capability (`eddsa-jcs-2022`, Trust Anchor's Privy Credential Assertion Key):
   `{ subject: did:catenor:bb58…20f3, action: EXECUTE_DISTRIBUTION [REF-IMPL], resource: spv:catenor-demo-001, constraints: { validUntil } }`.

## Agent policy — narrower than the SPV policy

| | SPV execution wallet | Distribution Agent wallet |
|---|---|---|
| May sign | `eth_signTransaction` to the ATS Factory (`deployEquity`) and `issueByPartition` on the rehearsal equity, partition `0x…01` | `eth_signTransaction` of a **value transfer ≤ 20 HBAR** to **only the SPV asset's investor receiving wallets** (`to ∈ {Investor A, Investor B}`) |
| Chain | 296 | 296 |
| ATS contracts | Factory + equity (function-restricted) | **none** |
| Export | denied | denied |
| Policy owner | SPV management-owner key (outside the runtime) | Agent management-owner key (outside the runtime) |

Agent rule, as created:

```text
ALLOW eth_signTransaction iff chain_id == 296
                            ∧ to ∈ {0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78, 0x72f94a15A815853B488BCf225ec3cb67eC5ba444}
                            ∧ value ≤ 0x1158e460913d00000 (20 HBAR, 18-decimal weibar)
DENY exportPrivateKey, exportSeedPhrase; everything else default-denied
```

## Probe evidence (privy-engineer, throwaway resources, CP7)

| Signed with the runtime-signer key | Result |
|---|---|
| to A, 1 HBAR · to B, 1 HBAR · to A, exactly 20 HBAR | SIGNED (recovered sender = probe wallet, chain 296) |
| to A, 21 HBAR | DENIED (400 `policy_violation`), so the value comparison is numeric |
| chain 1 · to the SPV wallet · to the ATS equity with calldata · to the ATS Factory | DENIED (400) |
| policy update with the runtime key | DENIED (401) |
| to A, 1 HBAR with non-empty calldata | SIGNED. Privy cannot require empty calldata; the Catenor signer boundary must enforce plain transfers when the Agent signs a payout. |

## Honest limits

- Both investors are in the Privy allowlist on purpose. Privy constrains the **class** of action; **Catenor decides per-holder eligibility** (Policy Decision ≠ Execution Authorization). In the CP7 plan Investor B is HELD by Catenor before any signature would be requested.
- No payout signing path exists yet; the Agent runtime-signer key is not in the runtime.
