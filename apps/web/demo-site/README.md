# Catenor One — demo and evidence site

A static, single-page site that walks through the final ETHOnline 2026 demo run of Catenor One (instance
`c1-202609121659`, 2026-09-12) and collects the public evidence for each sponsor system:

- the **deployed** Chainlink CRE Confidential Workflow (`identity-confidential-production`, 5 executions);
- the Privy development app (policy-bounded server wallets, receive-only investor wallets);
- Hedera testnet through Asset Tokenization Studio (6 transactions, with HashScan links and a live Mirror Node check);
- the Catenor audit re-verification (79 events, hash chain valid).

## Files

| Path | What it is |
|---|---|
| `index.html` | the whole page: inline CSS and vanilla JS, system fonts, no external scripts, no CDN, no framework |
| `assets/*.jpg` | 34 reviewed, redacted screenshots from `artifacts/final-demo/screenshots/`, converted to JPEG (quality 80, at most 1800 px wide) |

The only network requests the page makes are the ones a visitor triggers with the "Check on the Mirror Node" and
"Check live balances" buttons: read-only `GET`s to the public Hedera testnet Mirror Node
(`https://testnet.mirrornode.hedera.com/api/v1/contracts/results/{hash}` and `/api/v1/accounts/{id}`). If the browser
cannot reach it, the page shows a message and a HashScan link instead.

## Data sources

Every number, ID and hash on the page comes from these committed files:

- `artifacts/final-demo/RUN-LOG.md`
- `artifacts/final-demo/screenshots/README.md` and the PNGs in that folder
- `artifacts/chainlink/final-demo/deployed-run-c1-202609121659.md`
- `artifacts/hedera/final-demo/clean-room-c1-202609121659.md`
- `artifacts/privy/final-demo/clean-room-c1-202609121659/` (`README.md`, `agent-policy.json`, `spv-policy-after-equity.json`)
- `docs/hackathon/demo/2026-09-12-video-script.md` (narrative tone)

## Public-safe only

The page contains only data that is already public in those files: organization and agent DIDs, wallet addresses,
Hedera account IDs, Privy wallet and policy IDs, transaction hashes and CRE execution IDs. It never shows investor
DIDs, Sumsub applicant IDs, provider binding references, VC or VP contents, keys or secrets. The screenshots were reviewed and
redacted before they were committed; one terminal capture that prints credential contents (stage 42) was left out.

Labels are honest throughout: Chainlink CRE **deployed**, Privy **development** app, Sumsub **sandbox** (fictional
applicant names), company KYB **synthetic mock**, Hedera **testnet**.

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
6. Deploy. The site is fully static; no environment variables are needed.
