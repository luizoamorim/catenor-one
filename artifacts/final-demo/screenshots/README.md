# Final demo — before / after screenshots

**Privy app:** `catenor-one-ethonline-2026` (development). **Instance:** recorded in [`../RUN-LOG.md`](../RUN-LOG.md).
**CRE:** the **deployed** Confidential Workflow for every confidential operation, the Trust Anchor admission included.

These are sponsor dashboard screenshots taken by the maintainer before and after each clean-room stage. Each one shows
what that stage changed outside Catenor. An earlier attempt, whose admission ran on CRE simulation, is kept separately
in [`../aborted-c1-202609121438/`](../aborted-c1-202609121438/RUN-LOG.md).

## How they are collected

1. The maintainer captures the screen and names the stage.
2. Claude Code opens each capture and checks it for secrets and private identifiers. It then copies it here as
   `<stage>-<before|after>-<sponsor>-<view>.png` and adds it to the index. Unreviewed captures never enter git:
   `inbox/` is git-ignored.

**Never capture:**

- the Privy app secret or authorization keys;
- Sumsub app tokens or secret keys;
- `.env` files;
- Railway sealed variable values;
- the CRE secrets.

Sumsub applicant IDs are private: they are cropped or blurred before a capture is committed.

## Index

| File | Stage | Shows |
|---|---|---|
| `10-before-privy-wallets.png` | 10, before | Privy app `catenor-one-ethonline-2026`: **no wallets** |
| `10-before-privy-keys-and-quorums.png` | 10, before | **no key quorums** |
| `10-before-privy-policies.png` | 10, before | **no policies**: the app starts empty |
| `10-after-terminal.png` | 10, after | stage 10 output: signer infrastructure CREATED LIVE; Bootstrap Configuration hash `0x88314d8b…7fff` |
| `10-after-privy-wallets.png` | 10, after | **1 wallet**, Solana (SVM): the Bootstrap Endorsement Key `HKQY5…nVEk` |
| `10-after-privy-policies.png` | 10, after | **2 policies**: `P_BOOTSTRAP` (1 wallet) and `P_ASSERT` (0 wallets until stage 11) |
| `10-after-privy-policy-P_BOOTSTRAP-json.png` | 10, after | `P_BOOTSTRAP` rules: allow `signMessage`; deny `exportPrivateKey` and `exportSeedPhrase` |
| `10-after-privy-policy-P_ASSERT-json.png` | 10, after | `P_ASSERT` rules: the same three |
| `C1-cre-configure-terminal.png` | C1 | CRE config generated in DEPLOYED mode: callback to the Railway relay, HTTP-trigger key `0x18487BeF…4a6c` authorized, issuer rules not set yet (normal before stage 11) |
| `C2-cre-check-relay-terminal.png` | C2 | relay check **OK**: `202 RELAYED` → pull `200` → re-authenticated locally. Railway and this instance share the channel secret |
| `C3-cre-secrets-terminal.png` | C3 | 3 secrets created in the Vault DON (`namespace=main`): `CATENOR_INTERNAL_API_TOKEN`, `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`. Only names are shown; the login URL is a single-use request that has already been consumed |
| `C4-cre-deploy-terminal.png` | C4 | `identity-confidential-production` compiled and registered in the **private registry** (DON family `zone-a`): workflow ID `00e12517…d250`, status **Active** |
| `11-before-cre-workflow.png` | 11, before | CRE dashboard, `identity-confidential-production`: **Active**, Private registry, owner Catenor One, registered 17:38 UTC, **0 executions** |
| `11-before-sumsub-applicants.png` | 11, before | Sumsub sandbox applicants from **earlier runs**: the 2026-09-11 rehearsal (representative, Investor A Approved, Investor B Rejected/Sanctions) and the aborted instance's representative (16:10 UTC). This instance has none yet. **Applicant IDs redacted** |
| `11-diag-cre-deployment-tab.png` | 11, diagnosis | CRE Deployments tab before the fix: `00e1…d250` **Active**, 0 success / 0 error, "No status message" |
| `11-after-terminal.png` | 11, after | admission on the **deployed** workflow: `mode DEPLOYED`, `EVIDENCE_RECEIVED`, `policy:trust-anchor-admission:v1` **ALLOW**, `TRUST_ANCHOR_VALID: true` |
| `11-after-cre-execution-events.png` | 11, after | CRE execution `394f…4bd8`: **Success**, triggered 19:18 UTC, 8 s, $0. Events: `trigger` (19:18:36), then **two `http-actions` `SendRequest`** (19:18:45), the Sumsub sandbox calls made from inside the TEE with the Vault secrets |
| `11-after-sumsub-representative.png` | 11, after | the new Sumsub sandbox representative (synthetic "Catenor DemoRepresentative", level `id-only`): **Approved** at 19:18:17 UTC, before the trigger. **Applicant ID redacted** |
| `11-after-privy-wallets.png` | 11, after | 5 Solana wallets: bootstrap `HKQY5…nVEk` (17:08 UTC); the Trust Anchor's assertion key `9PvXY…PGkT` (19:18); three abandoned attempt keys `CMhqU…`, `5SUTj…`, `GMQ6i…` (see RUN-LOG, stage 11) |
| `11-after-privy-keys-and-quorums.png` | 11, after | `…-assertion` quorum: **signer for 4 wallets** (the assertion keys); `…-bootstrap`: signer for the bootstrap wallet only; the assertion owner key owns 4 wallets and `P_ASSERT` |
| `E2-cre-redeploy-terminal.png` | E1–E2 | config regenerated (`issuerRules`: Trust Anchor key pinned). Deploy #2 of `identity-confidential-production`: **same binary** `9902db58…`, new config `e7703b19…`; the CLI updated the existing workflow; new ID `0000e58d…25c8`, **Active** |
| `20-after-privy-wallets.png` | 20, after | new Solana wallet `GLHPd…oTdX` (19:58 UTC): the Sponsor's Credential Assertion Key. The "before" is `11-after-privy-wallets.png` (5 wallets) |
| `20-terminal.png` | 20 | Sponsor `did:catenor:5b87…761d` with `#assertion-key-1` (NOT a Trust Anchor; no capability yet) |
| `21-terminal.png` | 21 | Relationship `AUTHORIZED_SPONSOR_IN` **valid** + five Capability grants on `spv:catenor-demo-001`, all **ALLOW**; the same capability on another resource → **DENY `CAPABILITY_MISSING`** |
| `20-after-privy-keys-and-quorums.png` | 20, after | the assertion owner key and the `…-assertion` quorum now cover **5 wallets** (4 from the stage 11 attempts + the Sponsor's key); the bootstrap key and quorum still cover **only 1**. One owner and one runtime signer for all signMessage-only assertion keys, kept apart from the bootstrap key |
| `30-terminal.png` | 30 | SPV `did:catenor:bd78…5d44` + Privy EVM wallet `0x182F…9926`, created after the Sponsor's `TOKENIZE_ASSET` ALLOW; the execution-policy controls listed |
| `30-after-privy-wallets.png` | 30, after | new **EVM** wallet `0x182…9926` (20:08 UTC): the SPV execution wallet. The Solana assertion keys stay separate |
| `30-after-privy-policies.png` | 30, after | new EVM policy `catenor-one-spv-execution-4c875d44` (`cygll4bmgocqr05asp2w6f2s`, 1 wallet), next to `P_BOOTSTRAP` (1) and `P_ASSERT` (5) |
| `30-after-privy-policy-spv-json.png` | 30, after | SPV policy JSON: `allow-ats-factory-hedera-testnet`, **`eth_signTransaction` ALLOW only if `chain_id` eq `296` AND `to` eq `0xd1F1…379d`** (ATS v8 Factory); DENY `exportPrivateKey`, `exportSeedPhrase`. This is the Privy control that bounds the SPV's execution key |
| `30-after-privy-keys-and-quorums.png` | 30, after | **new, separate** SPV signer set: the management-owner key `nsnv8alo…` (owns the wallet and its policy) and the runtime quorum `…-spv-runtime` (signer for 1 wallet). The assertion and bootstrap entries are unchanged |
| `31-terminal.png` | 31 | offering `ab27ec9a…` signed by the Sponsor: 1,000 equity-interest units in "Catenor One Demo SPV 001"; eligibility = `policy:offering-eligibility:v1` pinned by hash `0xa3326b33…51a2`; verified **ALLOW** |
| `40-before-sumsub-applicants.png` | 40, before | Sumsub sandbox: the four stage 11 representatives (19:18, 19:12, 17:55, 17:50 UTC), all Approved; **no investors yet**. **Applicant IDs redacted** |
| `40-terminal.png` | 40 | Investor A ("Lisa Simpson", fictional, sandbox only): receiving wallet `0x7de5…2473`; **investor DID and holder-key id redacted** |
| `40-after-sumsub-lisa.png` | 40, after | Sumsub sandbox: **Lisa Simpson**, level `id-only`, **Approved** at 20:26 UTC. **Applicant IDs redacted** |
| `40-after-privy-wallets.png` | 40, after | +1 EVM `0x7de…2473` (Lisa's receiving wallet) and +1 Solana `6UtHf…knvg` (her holder key) |
| `41-terminal.png` | 41 | Investor B ("Bart Simpson", fictional, sandbox only): receiving wallet `0xCfCa…Da73`; **investor DID and holder-key id redacted** |
| `41-after-privy-wallets.png` | 41, after | +1 EVM `0xCfC…Da73` (Bart's receiving wallet) and +1 Solana `BX1N2…GgCa` (his holder key) |
| `41-after-privy-keys-and-quorums.png` | 41, after | two new owner keys, one per receiving wallet (`hywxrz…` for Lisa, `swcl2t…` for Bart): **no signer, no policy**, the wallets only receive. The assertion owner and quorum now cover **7** Ed25519 keys (+2 holder keys); SPV and bootstrap are unchanged |
| `42-before-cre-workflow.png` | 42, before | CRE workflow now `0000e5…3f25c8` (deploy #2), Active, Private, owner Catenor One; **1 execution**: the admission `394f…4bd8` (Success, 19:18:37 UTC, recorded under the deploy #1 ID `00e125…d250`) |
| `42-after-cre-executions.png` | 42, after | CRE: **3 successful executions, 0 unsuccessful**. New: `e66a41…0b8f` (20:34:36 UTC) and `61485b…64f8` (20:35:39 UTC) on workflow `0000e5…25c8`, about 63 s apart (the trigger rate limit); plus the admission `394f…4bd8` |
| `42-terminal.png` | 42 | two `CatenorInvestorEligibilityCredential`s issued by the Trust Anchor after **DEPLOYED** runs (facts identity / AML / fresh all true, an evidence commitment each); the runner waited 44 s between triggers. **Investor DIDs redacted** |
| `43-terminal.png` | 43 | each investor's Verifiable Presentation (holder proof `authentication`, bound to a challenge and the offering domain) passes **7/7 checks**; a Trust Anchor status statement reports `ACTIVE`; a **replay with another challenge fails `HOLDER_PROOF_VALID`**. **Investor DIDs redacted** |
| `44-terminal.png` | 44 | one sealed DEPLOYED run: `policy:offering-eligibility:v1` → **Investor A ALLOW 600 · Investor B ALLOW 400**. Each with its decision ref and commitment, trace (4 requirements TRUE), 7/7 presentation checks, reconciliation CONSISTENT. **Investor DIDs redacted** |
| `44-after-cre-executions.png` | 44, after | CRE: **4 successful, 0 unsuccessful**. New: `fecb52…4715` (20:45:11 UTC) |
| `44-after-cre-execution-logs.png` | 44, after | execution `fecb…4715` Logs tab (8 s, $0). Every DON node's copy of the run emits the same **non-sensitive markers only**: `workflow_started`, `secrets_fetched`, `context_opened`, `operation_routed operation=OFFERING_ELIGIBILITY`, `offering_evaluated status=OK`, `handler_completed status=DELIVERED` |
| `44-after-sumsub-both-green.png` | 44, after | Sumsub sandbox: **Bart Simpson and Lisa Simpson both Approved** (level `id-only`): the "both green" state before the investment. **Applicant IDs redacted** |
| `50-after-hashscan-spv.png` | 50, after | HashScan testnet account `0.0.10509879` = SPV wallet `0x182f…9926`: **25 ℏ** (created by the funding transfer, HIP-583 lazy create) |
| `50-after-hashscan-investor-a.png` | 50, after | account `0.0.10509881` = Investor A receiving wallet `0x7de5…2473`: **1 ℏ** (activation only) |
| `50-after-hashscan-investor-b.png` | 50, after | account `0.0.10509882` = Investor B receiving wallet `0xcfca…da73`: **1 ℏ** (activation only) |
| `60-terminal-policy-extended.png` | 60 | re-run after the fix: equity `0xf37A…7ABC` already deployed (tx `0x2396…c570`), **no new deployment**. The SPV policy is extended, owner-authorized: `allow-issueByPartition-equity`, `allow-grantRole-corporate-action-to-spv`, `allow-setDividend-equity`, all pinned to the equity |
| `60-after-hashscan-deploy-tx.png` | 60, after | the `deployEquity` Ethereum transaction: **SUCCESS**, consensus 21:14:07 UTC, block 40438071; fee **7.864 ℏ** paid by SPV account `0.0.10509879` |
| `60-after-hashscan-equity-contract.png` | 60, after | the new **ATS equity**: contract `0.0.10510175` = EVM `0xf37a…7abc` |
| `60-after-hashscan-spv.png` | 60, after | the SPV account now holds **17.136 ℏ** (25 − the 7.864 ℏ fee) |
| `60-after-hashscan-treasury.png` | 60, after | the Privy treasury account `0.0.10509855` (`0x49e9…5210`): **70.92 ℏ** left of the 100 ℏ from the faucet (27 ℏ sent plus fees) |
| `60-after-hashscan-ats-factory.png` | 60, after | the official **ATS v8 Factory** contract `0.0.9213391` (`0xd1f1…379d`), the only target the SPV policy allowed for the deploy |
| `60-after-privy-spv-policy-rules.png` | 60, after | SPV policy Rules view: under `eth_signTransaction`, `allow-ats-factory-hedera-testnet` + **the three equity-pinned rules**; exports denied; default deny (full JSON in `artifacts/privy/final-demo/clean-room-c1-202609121659/spv-policy-after-equity.json`) |
| `61-terminal.png` | 61 | Investor A's stage 44 ALLOW decision (`decision:8c0a…53dd`, 600 units) + Sponsor `TOKENIZE_ASSET` → **`issueByPartition(600)`** to her private receiving binding, signed by the SPV Privy wallet: tx `0x5935…fa4e`, holder balance **600** |
| `62-terminal.png` | 62 | Investor B's ALLOW decision (`decision:3000…78ef`, 400 units) → **`issueByPartition(400)`**: tx `0x9c6c…0d62`, holder balance **400** |
| `61-after-hashscan-issue-a-tx.png` | 61, after | HashScan: Investor A's issuance, an Ethereum transaction to contract `0.0.10510175` from the SPV `0.0.10509879`: **SUCCESS**, block 40439213, fee 0.52 ℏ |
| `62-after-hashscan-issue-b-tx.png` | 62, after | HashScan: Investor B's issuance, same contract and sender: **SUCCESS**, block 40439263, fee 0.46 ℏ |
| `91-early-verify-hedera.png` | 91 (run early, read-only) | an independent check from public chain data: `deployEquity` + both issuances SUCCESS. Equity "Catenor One Demo SPV 001 (SYNTHETIC)", symbol `C1SPV001`, **totalSupply 1000, Investor A 600, Investor B 400**; no dividend yet |
| `63-terminal.png` | 63 | two confirmed testnet transactions from the SPV Privy wallet: `grantRole(ROLE_CORPORATE_ACTION, SPV)` (`0x7260…9f94`) and `setDividend(amount 1, decimals 2)` (`0xaac4…f865`). Ownership-based entitlements: A 600 → 6, B 400 → 4; **no funds move** |
| `63-after-verify-hedera-entitlements.png` | 63, after | read-only re-check (22:08 UTC, after the record date): 5 transactions SUCCESS. Holdings A 600 / B 400; **entitlements dividend 1: Investor A 6, Investor B 4** |
| `70-terminal.png` | 70 | Sponsor `CREATE_AGENT` → Agent `did:catenor:9b25…c074` + Privy EVM wallet `0x9089…13E3` with its controls. **The Agent's distribution request BEFORE any delegation → DENY `CAPABILITY_MISSING`** (created ≠ authorized) |
| `70-after-privy-policies.png` | 70, after | new EVM policy `catenor-one-distribution-agent-3d8dc074` (`p99xe36icsfvewrovm1mczwq`, 1 wallet), alongside the treasury, SPV, P_BOOTSTRAP and P_ASSERT (7) policies |
| `70-after-privy-keys-and-quorums.png` | 70, after | a **new, separate** Agent signer set: owner key `blemb6kw…` (wallet + policy) and runtime quorum `…-agent-runtime`; the treasury has its own pair |
| `70-after-privy-wallets.png` | 70, after | new EVM wallet `0x908…13E3` (the Agent's execution wallet) |
| `70-after-privy-agent-policy-json.png` | 70, after | Agent policy JSON: `allow-distribution-payout-hedera`, `eth_signTransaction` ALLOW only if `chain_id` eq 296 **AND `to` in [Investor A, Investor B receiving wallets]** AND `value` lte `0x1158e460913d00000` (**20 HBAR**); both exports denied (JSON in `artifacts/privy/final-demo/clean-room-c1-202609121659/agent-policy.json`) |
| `71-terminal.png` | 71 | Relationship Credential **Agent `AGENT_OF` Sponsor** ([REF-IMPL] predicate), signed by the Sponsor, **valid**. The Agent's request with ONLY the relationship → **still DENY `CAPABILITY_MISSING`** (Relationship ≠ Capability) |
| `72-terminal.png` | 72 | delegated **`EXECUTE_DISTRIBUTION`** (grant `7bd93930…`): authority chain **ALLOW**, Trust Anchor → Sponsor (`CREATE_DISTRIBUTION`, `DELEGATE_DISTRIBUTION_AUTHORITY`, until 10-12) → Agent (until 10-02, inside the Sponsor's window). Negatives: delegate `TOKENIZE_ASSET` → **refused `ACTION_NOT_DELEGABLE`, no signature requested**; Investor A presents the Agent's grant → **DENY `SUBJECT_MISMATCH`** |
| `50b-terminal-agent-funding.png` | 50 (second run) | treasury → **Agent 12 HBAR** (`0x229a…c5a2`) and a 25 HBAR SPV top-up (`0xd118…638e`), both SUCCESS (TESTNET BOOTSTRAP FUNDING) |
| `10-after-privy-keys-and-quorums.png` | 10, after | 2 management-owner keys and 2 runtime quorums (`…-assertion`, `…-bootstrap`, signer for 1 wallet) |

## What each stage created, and why

(Filled in after each stage, from the stage output and the Privy / Sumsub / Hedera / CRE views.)

### Stage 11: root Trust Anchor admission, on the deployed CRE

| Created / used | What it is | Why |
|---|---|---|
| `did:catenor:656d…3cab` + Privy Ed25519 assertion wallet (`P_ASSERT`) | the organization's canonical identity and its **Credential Assertion Key** | The Trust Anchor signs credentials with this key. The key can sign messages only; it can never move money or be exported |
| Sumsub sandbox representative (synthetic), Approved | the evidence that a real person represents the organization | Catenor never reads that evidence. Only the workflow does, inside the TEE |
| CRE execution `394f…4bd8` (DEPLOYED, 8 s) | the Confidential Workflow run: it opens the sealed context, fetches the Vault secrets, calls Sumsub twice and derives 6 facts | Sensitive evidence stays in the enclave. What leaves is facts plus a commitment, signed and relayed through Railway |
| Decision ALLOW → bootstrap endorsement → ACTIVE | `policy:trust-anchor-admission:v1` over those facts, then the separate bootstrap key endorses | Trust Anchor authority comes from Admission, not from a database flag |

### Stage 10: Trust Domain bootstrap configuration

The stage creates, in Privy, the signer infrastructure that the Trust Anchor admission (stage 11) needs. It then pins
the acceptance rules by hash.

| Created | What it is | Why |
|---|---|---|
| Wallet `HKQY5…nVEk` (Solana) | the **Bootstrap Endorsement Key**: an Ed25519 key held by Privy | Only this key may endorse the first Trust Anchor after an ALLOW decision. It is a separate key from the Trust Anchor's own assertion key |
| Policy `P_BOOTSTRAP` | allows `signMessage`; denies `exportPrivateKey` and `exportSeedPhrase`; anything else is denied by default | The bootstrap key can sign an endorsement but can never be exported or used for a transaction |
| Policy `P_ASSERT` | the same rules, for credential-assertion wallets | Applied in stage 11 to the Trust Anchor's assertion key: it signs credentials, never money (Credential Assertion Key ≠ Financial Execution Key) |
| Quorums `…-bootstrap` and `…-assertion` | the **runtime signers**: 1-of-1 P-256 authorization keys | The runtime asks Privy for a signature through these. `…-bootstrap` is already the signer of the bootstrap wallet; `…-assertion` becomes a signer in stage 11 |
| 2 management-owner keys (unnamed rows) | the owners of the wallet and the policies | Their private keys stay on the maintainer's machine (`~/.catenor-one/`), never on Railway. A policy change needs the owner, not the runtime |
| Bootstrap Configuration `0x88314d8b…7fff` | the Trust Domain's acceptance rules (policy `trust-anchor-admission:v1`, bootstrap key, evidence profile), hashed | The CRE workflow is deployed with this hash, so the admission is checked against these exact rules |
