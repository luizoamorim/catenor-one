# Final demo run log

**Date:** 2026-09-12 (UTC). **Operator:** the maintainer, running `scripts/demo/*` by hand, one stage at a time.
**Screenshots:** [`screenshots/`](screenshots/README.md).

This is the public, reviewed record of each stage. The full stage records stay local in `.catenor-demo/runs/`, which
is git-ignored. This log never contains:

- investor DIDs;
- Sumsub applicant IDs or `bindingRef`s;
- VCs or VPs;
- keys or secrets.

**Sponsors:**

| Sponsor | Environment |
|---|---|
| Privy | new **development** app `catenor-one-ethonline-2026` |
| Sumsub | **SANDBOX**, with synthetic applicants and level `id-only` |
| Company KYB | **SYNTHETIC MOCK**, used only for the S001 admission |
| Chainlink CRE | the **deployed** `identity-confidential` Confidential Workflow, admission included. Results reach Catenor through the Railway relay |
| Hedera | **Testnet**, chain 296 |
| Railway | `https://catenor-one-production.up.railway.app`: API and CRE relay only, inert. Its **Postgres** holds the demo's operational state: the local runner writes to it through the TCP proxy |

**Order.** The workflow is deployed twice:

1. After stage 10, with the Bootstrap Configuration hash, for the admission.
2. After stage 11, adding the Trust Anchor's issuer key, for the investor operations.

See `DEMO.md` §15.

An earlier attempt (`c1-202609121438`) was stopped after stage 11 because its admission ran on CRE simulation. Its
record is in [`aborted-c1-202609121438/`](aborted-c1-202609121438/RUN-LOG.md).

## Stages

### Phase A — Local preparation (2026-09-12, 16:59 UTC)

**Instance:** `c1-202609121659`.

| Step | Result |
|---|---|
| `02-reset-local-demo --yes` | The local Docker PostgreSQL and the aborted instance's state files were moved aside. The Railway Postgres was left untouched and holds 0 Catenor rows |
| `01-setup-env` | `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, the Sumsub sandbox token and secret, and `CATENOR_INTERNAL_API_TOKEN_VAR` are all **PRESENT** (never printed). The channel token is the value sealed on Railway, not a new one. CRE CLI logged in |
| Database | **Railway PostgreSQL**, the deployed backend's database, reached through its public TCP proxy: 0 Catenor rows, 5 migrations, up to date |

**Why the database is on Railway.** The maintainer decided that the demo state lives in the deployed backend's
database rather than on this machine. The API is unchanged: it stays inert and only probes the database.

**Record labels.** The stage 01 record labels CRE as SIMULATION because no workflow is configured yet; stage 01 makes
no CRE call. The label becomes DEPLOYED after Phase C.
