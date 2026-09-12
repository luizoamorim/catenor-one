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
