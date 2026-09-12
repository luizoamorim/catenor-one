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
