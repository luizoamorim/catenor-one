# Catenor One — demo console and evidence site

A static, two-page site for the final ETHOnline 2026 demo run of Catenor One (instance `c1-202609121659`,
2026-09-12). Both pages are front-end only: inline CSS and vanilla JS, system fonts, no external scripts, no CDN, no
framework, no build step.

## Pages

| Path | What it is |
|---|---|
| `index.html` | **The console.** A clickable product console that **replays** the recorded run, step by step. Results are real (every ID, hash and decision comes from the run record); the actions are replayed, not executed. This is the page for the demo video (designed for 1920×1080, responsive down to 375 px) |
| `history.html` | **Run history & evidence.** The long-form page: all 16 chapters of the run, the TEE decision, the evidence per sponsor (Chainlink CRE, Privy, Hedera, Catenor), the run log with its incidents, and study notes |
| `assets/*.jpg` | 34 reviewed, redacted screenshots from `artifacts/final-demo/screenshots/`, converted to JPEG (quality 80, at most 1800 px wide). Both pages open them in a lightbox |

### The console (`index.html`)

- **Layout:** a journey sidebar (a horizontal stepper on mobile), a stage with the controls on the left and the result
  canvas on the right, and an activity log at the bottom. Log times are the recorded UTC times; entries marked
  `live` come from a Mirror Node check made now.
- **Ten steps:** Trust Domain → Trust Anchor → Sponsor → SPV & Offering → Investors → Hedera ATS → Distribution Agent →
  the twist (Bart sanctioned) → Confidential distribution (PAY 6 / HOLD 4, then the payout) → Verify.
  Negative paths (DENY `CAPABILITY_MISSING`, `HOLDER_PROOF_VALID` false, `ACTION_NOT_DELEGABLE`) have their own buttons.
- **Navigation:** steps unlock in order and can all be revisited. `→` next step, `←` back, `Enter` runs the next
  action of the current step. **Reset replay** (header, click twice) starts over.
- **State:** progress is kept in `localStorage` (key `catenor-console-v1`), so a refresh keeps the replay where it was.
  `index.html?done=N` pre-completes steps 1…N and opens step N (useful for screenshots or to jump ahead);
  `#step-N` opens an unlocked step.
- **Honest labels:** a persistent header badge (“Replay of the recorded run c1-202609121659 · results are real, actions
  are replayed · verify on-chain”) and per-step “What’s real here” labels with tooltips: Chainlink CRE **DEPLOYED**,
  Privy **REAL development app**, Sumsub **SANDBOX**, company KYB **SYNTHETIC MOCK**, Hedera **TESTNET**.
- **Sponsor chips:** every sub-step, result card and log line names the system that acted — Catenor (ink),
  Chainlink CRE (blue; “Chainlink CRE · TEE” inside `handlerInTee`), Privy (violet), Hedera ATS (teal),
  Sumsub · SANDBOX (rose) — with the same accents on `history.html`. The first step where a sponsor appears shows a
  “What it is · why we use it” callout (Catenor, Privy and Chainlink CRE in step 1; Hedera ATS in step 6). Every
  Privy policy is labeled “Privy policy” and framed in the Privy accent.

## Network use

The console makes **no** call to the Catenor backend, Railway, Privy, Sumsub or Chainlink CRE. On both pages the only
network requests are the ones a visitor triggers with the “Verify live”, “Verify all on-chain”, “Check on the Mirror
Node” and “Check live balances” buttons: read-only `GET`s to the public Hedera testnet Mirror Node
(`https://testnet.mirrornode.hedera.com/api/v1/contracts/results/{hash}` and `/api/v1/accounts/{id}`). If the browser
cannot reach it, the page shows a message and a HashScan link instead. HashScan links open in a new tab.

## Data sources

Every number, ID and hash on both pages comes from these committed files:

- `artifacts/final-demo/RUN-LOG.md`
- `artifacts/final-demo/screenshots/README.md` and the PNGs in that folder
- `artifacts/chainlink/final-demo/deployed-run-c1-202609121659.md`
- `artifacts/hedera/final-demo/clean-room-c1-202609121659.md`
- `artifacts/privy/final-demo/clean-room-c1-202609121659/` (`README.md`, `agent-policy.json`, `spv-policy-after-equity.json`;
  the console embeds both JSON files verbatim for its policy viewer)
- `docs/hackathon/demo/2026-09-12-video-script.md` (narrative tone of `history.html`)

## Public-safe only

The pages contain only data that is already public in those files: organization and agent DIDs, wallet addresses,
Hedera account IDs, Privy wallet and policy IDs, transaction hashes and CRE execution IDs. They never show investor
DIDs, Sumsub applicant IDs, provider binding references, VC or VP contents, keys or secrets. The screenshots were
reviewed and redacted before they were committed; one terminal capture that prints credential contents (stage 42) was
left out.

## Preview locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080 --directory apps/web/demo-site
```

## Deploy on Vercel

1. Vercel → **Add New… → Project** → import the GitHub repository `luizoamorim/catenor-one`.
2. **Root Directory:** `apps/web/demo-site`.
3. **Framework Preset:** Other.
4. **Build Command:** none (leave empty / override to empty).
5. **Output Directory:** `.`
6. Deploy. The site is fully static; no environment variables are needed. `index.html` (the console) is the entry page.
