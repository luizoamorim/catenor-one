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
| `10-after-privy-keys-and-quorums.png` | 10, after | 2 management-owner keys and 2 runtime quorums (`…-assertion`, `…-bootstrap`, signer for 1 wallet) |

## What each stage created, and why

(Filled in after each stage, from the stage output and the Privy / Sumsub / Hedera / CRE views.)

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
