# Final demo — before / after screenshots (instance `c1-202609121438`)

These are sponsor dashboard screenshots taken by the maintainer before and after each clean-room stage. Each one shows
what that stage changed outside Catenor (Privy, Sumsub, Hedera, Chainlink CRE, Railway).

## How they are collected

1. The maintainer saves raw captures into `inbox/`, which is **git-ignored**, so nothing unreviewed can be committed.
   On macOS: ⌘⇧5 → Options → Other Location… → this `inbox/` folder.
2. For each capture, the maintainer says which stage it belongs to and whether it is before or after.
3. Claude Code opens each capture and checks it for secrets and private identifiers. It then renames the capture to
   `<stage>-<before|after>-<sponsor>-<view>.png`, moves it here, and adds it to the index below.

**Never capture:**

- the Privy app secret or authorization keys;
- Sumsub app tokens or secret keys;
- `.env` files;
- Railway sealed variable values;
- the CRE secrets.

Sumsub applicant IDs are private by design. They are cropped or blurred before a capture is committed.

## What to capture per stage

| Stage | Before | After |
|---|---|---|
| 10 Trust Domain | Privy (new app): Wallets, Policies, Authorization keys / key quorums | the bootstrap wallet, `P_ASSERT` / `P_BOOTSTRAP`, two key quorums |
| 11 Trust Anchor | Privy Wallets; Sumsub Individuals | the Trust Anchor assertion wallet; the representative **Approved** |
| 20–21 Sponsor | Privy Wallets | the Sponsor assertion wallet |
| 30 SPV | Privy Wallets / Policies | the SPV EVM wallet and its execution policy |
| 40–41 Investors | Privy Wallets; Sumsub Individuals | two receiving wallets; **Lisa Simpson** and **Bart Simpson** both **Approved** |
| 50 Funding | HashScan: SPV / Agent / Treasury accounts | funded balances |
| 60–63 ATS | HashScan | equity deployed, 600 / 400 issued, dividend set |
| 70–72 Agent | Privy Wallets / Policies | the Agent wallet and its policy (only to A/B, ≤ 20 HBAR) |
| 80 Bart | Sumsub Individuals | Lisa **Approved**, Bart **Rejected (Sanctions)** |
| 82 Distribution | CRE executions (if deployed) | the `CONFIDENTIAL_DISTRIBUTION` execution |
| 83 Payout | HashScan: Agent, Lisa, Bart accounts | Lisa +6 HBAR, Bart unchanged |

## Index

| File | Stage | Shows |
|---|---|---|
| `10-before-privy-wallets.png` | 10, before | Privy app `catenor-one-final-demo` (development mode): **no wallets** |
| `10-before-privy-keys-and-quorums.png` | 10, before | Privy: **no key quorums** |
| `10-before-privy-policies.png` | 10, before | Privy: **no policies** — the new app starts empty |
| `10-after-privy-wallets.png` | 10, after | one Solana (SVM) wallet `yhscbg09z11ofns1lxrb33qy` (address `2Z5uM…oh4j`), the Bootstrap Endorsement Key, balance $0 |
| `10-after-privy-keys-and-quorums.png` | 10, after | two runtime key quorums (`catenor-one-clean-room-bootstrap`, `catenor-one-clean-room-assertion`) and two management-owner keys |
| `10-after-privy-policies.png` | 10, after | `catenor-one-clean-room-P_BOOTSTRAP` (1 wallet) and `catenor-one-clean-room-P_ASSERT` (0 wallets for now) |

## What each stage created, and why

### Stage 10: Trust Domain bootstrap (Privy signer infrastructure)

Catenor signs protocol documents: DID proofs, credentials, the bootstrap endorsement. It never holds those private
keys itself. Each signing key lives in a Privy wallet whose policy allows only one thing: signing a message. Two
separate key purposes are created, because a Credential Assertion Key is not a Bootstrap Endorsement Key (S001 D36).

| Privy object | ID (public ref) | What it is | Why it exists |
|---|---|---|---|
| Wallet (Solana, Ed25519) | `yhscbg09z11ofns1lxrb33qy` | the **Bootstrap Endorsement Key** of the Trust Domain `trust-domain:catenor-one-demo` | It signs the one bootstrap endorsement that turns an Admission **ALLOW** into an ACTIVE Trust Anchor (stage 11). Its public key is pinned inside the Bootstrap Configuration, so nobody can later swap in another key. Solana is used only because it gives an Ed25519 key (`eddsa-jcs-2022` proofs); it holds and moves no money |
| Policy `P_BOOTSTRAP` | `le7gbximdw0xn4v816cio9pt` | the bootstrap wallet's rules | It **allows** `signMessage` and **denies** private-key and seed-phrase export. Anything else has no allow rule, so Privy refuses it: the key can sign an endorsement but can never sign a transaction or leave Privy |
| Policy `P_ASSERT` | `ad39kww1rhrdjuybxc3iyk6x` | the same rules, for **Credential Assertion Key** wallets | Each Subject's assertion wallet (the Trust Anchor in stage 11, the Sponsor in stage 20) is created later under this policy. It shows 0 wallets for now |
| Key quorum `catenor-one-clean-room-bootstrap` | `oh9vraclpkgmfnuf4patym7q` | the **runtime signer** of the bootstrap wallet ("Signer for 1 wallet") | The Catenor runtime asks for signatures through this quorum's authorization key, which stays in local `runtime.env`, 0600. As an additional signer it is still bound by `P_BOOTSTRAP`: it can sign messages, but it cannot change the policy or the wallet |
| Key quorum `catenor-one-clean-room-assertion` | `qsj70xedok2989aae9cfj9q7` | the runtime signer for the assertion wallets | Same role for Credential Assertion Keys. It becomes "Signer for" each Subject's assertion wallet once those wallets are created |
| Key `iwat4x7au0xf1z511brolft7` | — | the **bootstrap management owner** ("Owner of 1 wallet, 1 policy") | Only this key can administer the bootstrap wallet and `P_BOOTSTRAP`. Its private key lives only in `~/.catenor-one/clean-room/c1-202609121438/` (0600) and is never loaded by the runtime or sent to Railway |
| Key `bbww0ajqpr5djym61xzeebu6` | — | the **assertion management owner** ("Owner of 1 policy") | Administers `P_ASSERT` and, later, the assertion wallets. Same local-only custody |

The outcome is the **Bootstrap Configuration** (`.catenor-demo/bootstrap-configuration.json`), pinned by hash
`0x21f0e18af868321df4fdfcd70b5eef611f8265f85b96ea2000461bc2239dbe1c`. It fixes:

- the Trust Domain;
- the admission policy `policy:trust-anchor-admission:v1` and its hash;
- the bootstrap public key above;
- the accepted evidence: HYBRID_DEMO, with a real Sumsub sandbox representative at level `id-only` and a synthetic
  mock company.

Every later check refers back to this hash. That includes the CRE workflow configuration.
