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

## What each stage created, and why

(Filled in after each stage, from the stage output and the Privy / Sumsub / Hedera / CRE views.)
