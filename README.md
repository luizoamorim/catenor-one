# Catenor One

> **The first reference implementation of [Catenor Protocol](https://github.com/luizoamorim/catenor).** Built for
> ETHOnline 2026 with Chainlink CRE Confidential Workflows, Privy and Hedera Asset Tokenization Studio.

**Tokenized assets prove who holds them. They don't prove who may be paid today.**

In our demo, an investor holds 400 units of a tokenized SPV and Hedera ATS records his dividend entitlement: **4 HBAR.
He is paid 0.** His sanctions check turned RED after he invested. A Chainlink Confidential Workflow re-checked the
current identity evidence inside a TEE and decided HOLD. The Privy-controlled Distribution Agent paid only the eligible
investor, and it never even requested a signature for the one on hold.

```text
Wallets are accounts.  Credentials are claims.  Authority is scoped.  Identity persists.
```

| | |
|---|---|
| **Demo video** | [youtube.com/watch?v=EbxR1HgVIx0](https://www.youtube.com/watch?v=EbxR1HgVIx0) — the replay console, narrated |
| **Technical walkthrough** | [youtube.com/watch?v=X3nXRfowpfk](https://www.youtube.com/watch?v=X3nXRfowpfk) — the real terminals and dashboards, and the prompts behind the build |
| **Replay console + evidence site** | [`apps/web/demo-site/`](apps/web/demo-site/): open `index.html` (a click-through replay of the real run) and `history.html` (full run history and evidence per sponsor) |
| **Reproducible runbook** | [`DEMO.md`](DEMO.md): every step is a numbered script under [`scripts/demo/`](scripts/demo/) |
| **Run log of the final demo** | [`artifacts/final-demo/RUN-LOG.md`](artifacts/final-demo/RUN-LOG.md) and the [screenshots](artifacts/final-demo/screenshots/) |
| **Protocol** | [github.com/luizoamorim/catenor](https://github.com/luizoamorim/catenor) · [catenor.xyz](https://catenor.xyz) |

---

## What the final run did

The final run was instance `c1-202609121659`, on 2026-09-12. It started from an empty Privy app and an empty database.

| | Result |
|---|---|
| Demo stages | **24 / 24 ok** (`scripts/demo/99-verify-complete-demo.sh`) |
| Chainlink CRE | **5 executions of the DEPLOYED Confidential Workflow, all SUCCESS** |
| Hedera testnet | **6 transactions, all SUCCESS**: `deployEquity`, 2 × `issueByPartition`, `grantRole`, `setDividend`, and the payout |
| Privy | every key and wallet created by the run, each under its own policy; **0 signature requests** for the investor on hold |
| Catenor audit | hash chain valid, 79 events |
| Outcome | Investor A: entitled to 6, **paid 6**. Investor B: entitled to 4, **paid 0**. He still holds his 400 units |

## The story

```text
Root Trust Anchor ── admitted by a Confidential Workflow (KYC in the TEE) + a deterministic policy
   │ grants 5 scoped Capabilities
   ▼
Sponsor ── TOKENIZE_ASSET ─────────▶ SPV + Privy execution wallet (policy: only the ATS Factory on Hedera testnet)
        ── DEFINE_OFFERING_POLICY ──▶ signed offering
        ── CREATE_AGENT ───────────▶ Distribution Agent + Privy wallet (policy: pay only A or B, ≤ 20 HBAR)
        ── delegates EXECUTE_DISTRIBUTION ─▶ Agent   (a relationship alone is DENY; delegation can't exceed the Sponsor's)
   ▼
Investors A and B ── Sumsub sandbox KYC → W3C credentials → presentations checked in the TEE → ALLOW 600 / ALLOW 400
   ▼
Hedera ATS ── equity deployed · 600 + 400 units issued · dividend set → entitlements A 6 / B 4
   ▼
Investor B is sanctioned (still holds his units and a valid credential)
   ▼
Confidential distribution in the TEE (reads TODAY's evidence) → A PAY 6 · B HOLD 4
   ▼
Agent pays A 6 HBAR on Hedera testnet · B: no transaction built, no signature requested
```

Every DENY path is part of the demo:

- a capability outside the Sponsor's scope;
- an Agent with a wallet but no authority;
- an Agent with only a relationship;
- a non-delegable action;
- the HOLD investor.

---

## Chainlink CRE: Confidential Workflow (deployed)

Chainlink CRE is the confidential decision layer. The workflow [`workflows/identity-confidential`](workflows/identity-confidential/)
registers one `cre.handlerInTee(...)` handler. That handler runs five operations inside the TEE: Trust Anchor admission,
investor eligibility, credential issuance checks, offering eligibility and the confidential distribution.

**What happens in the enclave:**

- the Sumsub API credentials are fetched from the **Vault DON**;
- the signed Sumsub sandbox calls are made **from inside the TEE**;
- the provider responses are normalized into facts and reconciled with the investor's credentials;
- the policy is applied;
- for the distribution, the pro-rata shares **and** PAY/HOLD are computed there too.

**What leaves the enclave:** only decisions, facts, check results, coarse reason codes and commitments. No Sumsub
response, name, document or applicant data leaves it.

| Field | Value |
|---|---|
| Workflow | `identity-confidential-production`, private registry. Deploy #2 ID `0000e58d50da8eaf29fb4212c236f374d11d7eb2452502c3bad0afe74d3f25c8` |
| Executions | admission `579f70e6…`, eligibility A `3529711c…`, eligibility B `5a85768b…`, offering `b6c4ff63…`, distribution `a623ebaa…`. All SUCCESS |
| Evidence | [`artifacts/chainlink/final-demo/deployed-run-c1-202609121659.md`](artifacts/chainlink/final-demo/deployed-run-c1-202609121659.md), plus dashboard screenshots `11-*`, `42-*`, `44-*`, `82-*`, `99-*` |

The earlier simulation evidence (`cre workflow simulate`) is kept separately in
[`artifacts/chainlink/final-demo/`](artifacts/chainlink/final-demo/).

## Privy: authority-derived wallets and execution controls

Privy holds every key and enforces what each one can sign. Catenor decides **whether** an action is allowed, and a Privy
policy bounds **what** each key can sign. Every wallet is created by the API, and only after the matching Catenor
authorization.

| Wallet | What its Privy policy allows (everything else denied, exports denied) |
|---|---|
| Trust Anchor and Sponsor assertion keys (Ed25519) | `signMessage` only (credentials, grants, presentations). Never a financial key |
| Bootstrap endorsement key | `signMessage` only, with its own owner and quorum |
| SPV execution wallet | `eth_signTransaction` on chain 296 to the ATS Factory. After the deploy, only `issueByPartition` (default partition), `grantRole(CORPORATE_ACTION, SPV)` and `setDividend`, pinned to the equity |
| Distribution Agent wallet | `eth_signTransaction` on chain 296 **only to Investor A or B, ≤ 20 HBAR** |
| Investor wallets | receive-only: no signer, no policy |

Each execution wallet has a **management-owner key kept outside the runtime**, and a 1-of-1 **runtime key quorum**
limited to the wallet's policy. The running service can therefore request signatures but can never loosen its own
limits. Evidence: [`artifacts/privy/final-demo/clean-room-c1-202609121659/`](artifacts/privy/final-demo/clean-room-c1-202609121659/README.md),
including the exact policy JSON.

### How Privy improves the experience

- **No one manages keys.** An operator who sets up an SPV or a Distribution Agent never generates, stores or backs up
  a private key or seed phrase. The wallet appears when the authorization is granted, and exports are denied.
- **Automated payouts without blind trust.** The Distribution Agent pays investors without a human signing every
  transfer, yet its policy makes a wrong payout unsignable: an unknown recipient, more than 20 HBAR, or the wrong
  chain is refused.
- **Investors don't need a wallet setup to get paid.** In the demo, each investor receives through a Privy wallet
  created for them. They sign nothing and need no gas to receive.
- **Clean failures instead of on-chain reverts.** A disallowed action is refused before a signature exists, so it
  costs no gas and leaves no half-built transaction. The investor on hold received no transaction at all.
- **Separation of duties by default.** Management owners and runtime signers are distinct key quorums, so a
  compromised or buggy service cannot rewrite its own spending rules.

## Hedera: Asset Tokenization Studio on testnet

Hedera ATS is the tokenization and lifecycle layer. The SPV's Privy wallet deploys an ATS v8 equity through the
official Factory, issues exactly the units the TEE approved, and sets a dividend. The Distribution Agent then pays only
the eligible holder.

| # | Operation | Catenor gate | Transaction |
|---|---|---|---|
| 1 | `deployEquity`: "Catenor One Demo SPV 001 (SYNTHETIC)", `C1SPV001` | Sponsor `TOKENIZE_ASSET` ALLOW | [HashScan](https://hashscan.io/testnet/transaction/1789247647.562188157) |
| 2 | `issueByPartition` → Investor A, **600** | A's offering ALLOW from the deployed CRE | [HashScan](https://hashscan.io/testnet/transaction/1789250118.469812177) |
| 3 | `issueByPartition` → Investor B, **400** | B's offering ALLOW from the deployed CRE | [HashScan](https://hashscan.io/testnet/transaction/1789250225.239984917) |
| 4 | `grantRole(ROLE_CORPORATE_ACTION, SPV)` (configuration) | SPV policy pinned to that role and account | [HashScan](https://hashscan.io/testnet/transaction/1789250729.664064104) |
| 5 | `setDividend`: entitlements **A 6, B 4** (lifecycle) | SPV policy pinned to the equity | [HashScan](https://hashscan.io/testnet/transaction/1789250748.487765802) |
| 6 | payout → Investor A, **6 HBAR** (distribution) | delegated `EXECUTE_DISTRIBUTION` **and** the TEE plan A PAY 6 | [HashScan](https://hashscan.io/testnet/transaction/1789253122.442165104) |
| — | payout → Investor B | TEE plan **HOLD 4** | none: no transaction, no signature |

- **Equity:** [`0.0.10510175`](https://hashscan.io/testnet/contract/0.0.10510175) (`0xf37A91c3aC757ac5f14e4b8BC92D4b1001D97ABC`).
- **ATS v8 Factory:** [`0.0.9213391`](https://hashscan.io/testnet/contract/0.0.9213391).
- **Evidence:** [`artifacts/hedera/final-demo/clean-room-c1-202609121659.md`](artifacts/hedera/final-demo/clean-room-c1-202609121659.md).
- **Re-verify with no credentials:** `scripts/demo/91-verify-hedera.sh`, which uses only the public JSON-RPC relay and
  the Mirror Node.

**Contract verification.** Catenor One deploys no Solidity of its own; [`contracts/`](contracts/) is empty. The equity
is created by the official ATS v8 Factory from the `@hashgraph/asset-tokenization-contracts` 8.0.0 package, and every
call is made against those unmodified ATS contracts. There is no project contract to verify on HashScan.

---

## What is real, sandbox or mock

We label every environment explicitly, in the code, the evidence and the video.

| Component | Status |
|---|---|
| Chainlink CRE Confidential Workflow | **DEPLOYED** (private registry). Catenor did not verify an enclave attestation itself; `reportFromDon` verification is not implemented |
| Privy | **REAL** development app |
| Sumsub | **REAL SANDBOX**, with synthetic applicants |
| Company KYB evidence (Trust Anchor admission only) | **SYNTHETIC MOCK** (Sumsub KYB not available on our plan) |
| Hedera ATS | **REAL testnet** (chain 296) |
| The asset | **SYNTHETIC** real-estate SPV |
| Revenue event | demo trigger |
| Railway | the API and the CRE callback relay only, plus the operational database |

## Architecture

```text
apps/api            Catenor application services, Prisma persistence, sponsor adapters, the demo stage runner, the Railway relay
apps/web/demo-site  static replay console + evidence site (no backend calls; read-only Mirror Node checks)
packages/           framework-free domain: identity (did:catenor), credentials (W3C VC/VP, eddsa-jcs-2022),
                    authority (Trust Anchor, capabilities, delegation), policy, audit (hash chain)
workflows/          the Chainlink CRE Confidential Workflow (identity-confidential)
scripts/demo/       the numbered clean-room runbook (00 → 99) and the CRE deploy scripts
artifacts/          judge-verifiable evidence per sponsor
slices/             spec-driven vertical slices (SPEC / PLAN / TASKS / ACCEPTANCE / TEST-VECTORS)
```

Sponsors sit behind ports and adapters. They execute within Catenor's decisions and do not define its semantics:

```text
Canonical identity ≠ wallet      Relationship ≠ Capability      Credential Assertion Key ≠ Financial Execution Key
Signature validity ≠ claim truth      Catenor Policy Decision ≠ wallet Execution Authorization
```

## Run and verify

```bash
pnpm install
pnpm check              # lint, typecheck, build, unit tests, dependency boundaries, secret scan
pnpm test:integration   # needs Docker: PostgreSQL migrations plus the end-to-end clean-room chain
scripts/demo/91-verify-hedera.sh --rehearsal   # no credentials: re-reads testnet transactions from public data
```

The full clean-room run needs a Privy app, Sumsub sandbox credentials, a CRE account and testnet HBAR. See
[`DEMO.md`](DEMO.md) for the prerequisites, every stage and the judge matrix.

## Hackathon provenance

Catenor One was built from scratch during ETHOnline 2026. The Catenor Protocol design started on 2026-09-04, and the
implementation repository on 2026-09-09. The work is recorded in small commits and in:

- [`docs/hackathon/BUILD_LOG.md`](docs/hackathon/BUILD_LOG.md): the timeline;
- [`docs/hackathon/AI_USAGE.md`](docs/hackathon/AI_USAGE.md): how ChatGPT and Claude Code were used, including the
  sponsor-skill subagents;
- [`docs/hackathon/PROVENANCE.md`](docs/hackathon/PROVENANCE.md): every dependency, template and sponsor resource;
- [`docs/hackathon/prompts/`](docs/hackathon/prompts/) and [`docs/hackathon/plans/`](docs/hackathon/plans/).

Arc was explored early as a USDC settlement rail and replaced by Hedera ATS on 2026-09-10.

## Not done yet

- `reportFromDon` / offchain verification of the CRE report.
- Subject Continuity across identity providers (planned S002).
- A live product UI: the console replays the recorded run; the actions ran through the scripts.
- The operator login gate (the admission is operator-initiated).

## License

[Apache-2.0](LICENSE)
