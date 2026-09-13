# Catenor One — demo video script (ETHOnline 2026)

**Target:** ~3:30. The accepted range is 2:00–4:00, and anything outside it is rejected on upload.

**Rules** (ETHGlobal, checked 2026-09-12):

- at least 720p (we export 1080p);
- **no speed-up** (waiting is cut, never accelerated);
- **no AI voice** (the maintainer narrates);
- no music-with-text instead of narration;
- intro ≤ 20 s;
- slides ≤ 4 bullets.

**Material:** the reviewed screenshots in `artifacts/final-demo/screenshots/`, plus title and summary cards. Every
number and ID shown comes from the real run (`artifacts/final-demo/RUN-LOG.md`). Investor DIDs and Sumsub applicant
IDs stay redacted.

**How it is made:**

1. Claude builds a silent 1080p cut from this shot list. Each shot is held long enough for its narration line.
2. The maintainer records the narration while watching the cut, in a quiet room with the laptop mic or a headset. The
   voice file goes to `~/Movies/catenor-one-final-demo/`.
3. Claude muxes the voice onto the cut and adjusts shot lengths to the voice, without speeding anything up.

## Shot list and narration

About 370 words: roughly 2:50 of speech at a calm pace, plus pauses on the key shots.

| # | Time | Shot (screenshot or card) | Narration (maintainer, English) |
|---|---|---|---|
| 1 | 0:00–0:15 | **Card:** the Catenor logo · "Catenor One — the first reference implementation of Catenor Protocol" → the demo site hero ("Identity persists. Authority stays scoped." · Possession ≠ current eligibility) → the site thesis ("Entitled to 4. Paid 0.") | "This is Catenor One, the first reference implementation of Catenor Protocol. Tokenized assets prove who *holds* them. They don't prove who may be *paid* today. We fix that." |
| 2 | 0:15–0:40 | **Card:** "Four technologies. One job each." Logos, roles and why: Catenor (identity + scoped authority) · Chainlink CRE (deployed Confidential Workflow; Vault secrets → Sumsub in the enclave; decides admission, eligibility, PAY/HOLD) · Privy (which key can sign what: sign-only Trust Anchor and Sponsor keys, the SPV wallet, the Agent wallet, receive-only investor wallets) · Hedera ATS (tokenized SPV equity, issuance, dividend, payout, publicly verifiable) | "Four technologies, each with one job. Catenor holds identity and scoped authority. Chainlink's Confidential Workflow reads private KYC evidence inside a TEE, and decides. Privy constrains which key can sign what: the Trust Anchor's signing keys, the SPV and Agent wallets, and the investors' receive-only wallets. And Hedera's Asset Tokenization Studio runs the asset, verifiable by anyone." |
| 3 | 0:35–1:00 | `11-before-cre-workflow` → `11-after-terminal` → `11-after-cre-execution-events` | "Trust starts with admission. The representative's KYC, from the Sumsub sandbox, plus a mocked company check, is read inside our **deployed** Confidential Workflow. The secrets come from the Vault DON, the Sumsub calls happen in the enclave, and only facts and a commitment come out. The policy says ALLOW, a separate bootstrap key endorses, and the Trust Anchor is valid." |
| 4 | 1:00–1:20 | `21-terminal` (five capabilities + the DENY) → `30-after-privy-policy-spv-json` | "The Trust Anchor grants the Sponsor five scoped capabilities. Outside that scope it's DENY. Only after `TOKENIZE_ASSET` is allowed does the SPV get a Privy wallet, and its policy can only sign on Hedera testnet, to the ATS Factory." |
| 5 | 1:20–1:45 | `44-after-sumsub-both-green` → `42-after-cre-executions` → `44-terminal` (crop: the two ALLOW decisions) | "Two investors, Lisa and Bart, pass KYC in the Sumsub sandbox. The TEE verifies their evidence, and the Trust Anchor issues W3C credentials. Their presentations are then checked confidentially against the offering policy: Lisa may buy 600 units, Bart 400." |
| 6 | 1:45–2:10 | `60-after-hashscan-deploy-tx` → `63-after-verify-hedera-entitlements` | "On Hedera testnet, the SPV's Privy wallet deploys an ATS equity, issues exactly the approved units, 600 and 400, and sets a dividend. ATS computes the entitlements by ownership: Lisa 6, Bart 4." |
| 7 | 2:10–2:30 | `70-terminal` (the DENY) → `72-terminal` (chain ALLOW, `TOKENIZE_ASSET` refused) → `70-after-privy-agent-policy-json` | "A Distribution Agent gets a wallet, but no authority: DENY. A relationship alone: still DENY. Only a delegated `EXECUTE_DISTRIBUTION` works, and it can never exceed the Sponsor's own. Its Privy policy can only pay Lisa or Bart, up to 20 HBAR." |
| 8 | 2:30–3:05 | `80-after-sumsub-bart-red` → `82-terminal` (crop: PAY / HOLD) → `82-after-cre-execution-events` → `83-terminal` → `83-after-hashscan-payout-tx` | "Now Bart gets sanctioned. He still holds 400 units and a *valid* credential. At distribution time, the TEE re-checks today's evidence: Lisa, PAY 6; Bart, HOLD 4. The raw evidence never leaves the enclave. The Agent pays Lisa 6 HBAR on-chain. For Bart, no transaction is built and no signature is even requested." |
| 9 | 3:05–3:25 | **Card:** the five CRE executions with ✅ (from `99-after-cre-five-executions`) → `91-verify-hedera-final` → `99-verify-complete-demo-stages` | "And everyone can check it: five executions on the deployed workflow, six testnet transactions, Lisa entitled to 6 and paid 6, Bart entitled to 4 and paid zero, and a valid audit chain. Twenty-four out of twenty-four stages." |
| 10 | 3:25–3:35 | **Card:** "Wallets are accounts. Credentials are claims. Authority is scoped. Identity persists." · github.com/luizoamorim/catenor-one · catenor.xyz | "Wallets are accounts. Credentials are claims. Authority is scoped. Identity persists. That's Catenor." |

## Honesty checks

Every narrated claim above is labeled accurately:

- **"deployed"** is true for all five CRE executions;
- **"Sumsub sandbox"** is said out loud: the investors are synthetic sandbox applicants;
- the admission's company evidence is a **SYNTHETIC MOCK**, and the narration says "a mocked company check";
- **"on-chain"** means Hedera **testnet**;
- **"raw evidence never leaves the enclave"**: coarse reason codes (`FINAL`, `SANCTIONS`) do reach Catenor, and the
  narration does not claim otherwise.

## Optional longer evidence cut

A 6–8 min version, not for upload, with every stage's before/after screenshots. It is useful for the sponsor channels
and the repository README.
