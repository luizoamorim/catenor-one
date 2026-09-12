# Catenor One API on Railway

**Prompt:** `docs/hackathon/prompts/2026-09-12-024-railway-backend-preparation.md` · **Status:** prepared, **not deployed**.
Nothing on this page has been executed against Railway, Privy, Sumsub, Hedera or Chainlink. Every external step is in
§8 for the maintainer to run by hand.

## 1. What is deployed

| Item | Value |
|---|---|
| Service | `@catenor-one/api` (`apps/api`), one Railway service |
| Root Directory | `/` (repository root). The API imports the workspace packages `packages/*`, so the whole pnpm workspace is the build context |
| Config-as-code path | `/apps/api/railway.toml` (set explicitly: Railway does not look for it under a Root Directory) |
| Builder | `DOCKERFILE`, using `apps/api/Dockerfile` (Node 24.10.0 slim, pnpm 10.11.0) |
| Build | `pnpm install --frozen-lockfile --filter "@catenor-one/api..."`, then `pnpm --filter @catenor-one/api db:generate` (runs inside the Dockerfile; needs no database and no secret) |
| Start | `node --conditions=@catenor-one/source --import tsx src/main.ts` (cwd `apps/api`; same as `pnpm --filter @catenor-one/api start`) |
| PORT | reads `PORT`, which Railway injects (default 8080); listens on `::` (IPv4 and IPv6) |
| Health check | `GET /v1/health`: static, with no database or sponsor call |
| Replicas | exactly 1 (`numReplicas = 1`), because the CRE relay mailbox is held in memory |
| Migrations | **not automatic**; run by the maintainer (§8, step 6) |

There was no HTTP server in `apps/api` before this change: every flow ran from the local stage runner. `src/main.ts`
is new and deliberately minimal. It is not the planned NestJS app; T4.1 is still open.

## 2. Inert startup (non-negotiable)

`main.ts` does four things:

- reads `PORT`, `HOST`, `CATENOR_INTERNAL_API_TOKEN` and `DATABASE_URL`;
- derives the CRE channel keys in memory;
- prints one line saying which features are enabled (never a value);
- listens.

It **never**:

- connects to the database at startup, and never migrates;
- calls Privy, Sumsub, Hedera or Chainlink;
- admits, issues, delegates, deploys, pays, or creates any Subject, wallet, policy or applicant.

A malformed `CATENOR_INTERNAL_API_TOKEN` makes it refuse to start, without echoing the value.

This is enforced by `apps/api/src/main.inert.test.ts`. The test walks every static and lazy import reachable from
`main.ts` and fails if any of them reaches:

- the Privy, ATS or ethers SDKs;
- `child_process`;
- `@catenor-one/authority`;
- the application services (`src/modules/`);
- the key-management, identity-provider, execution or runtime adapters;
- the CRE gateway or simulator.

### Never on Railway

The following stay on the maintainer's machine:

- **Management-owner private keys.** `~/.catenor-one/clean-room/<instance>/`, 0600. They are outside every build
  context and the `.dockerignore` excludes them as well.
- **Runtime authorization keys.** `.catenor-demo/runtime.env`.
- **The CRE trigger key.**
- **The Privy app secret.**
- **The Sumsub credentials.**
- **The clean-room state.**
- **Every `--live` operation.**

The Docker context also excludes, in `.dockerignore`:

- every `.env` and `.env.*` file;
- `.catenor-demo/`;
- `workflows/` (its `.env` holds the Vault DON secret values);
- `scratch/`, `.git/` and local tooling.

## 3. Routes

| Method and path | Purpose | Authentication |
|---|---|---|
| `GET /v1/health` | liveness; reports `startup: INERT`, whether the CRE relay is enabled and whether a database is configured | none |
| `GET /v1/health/db` | read-only readiness: database reachable, and migrations `applied` vs `packaged` | none; never writes |
| `POST /v1/internal/cre/identity-confidential/results` | the **existing** CRE callback path (`CALLBACK_PATH`), now served publicly | callback HMAC (below) |
| `GET /v1/internal/cre/identity-confidential/results/<runId>` | one-time pull of a relayed result by the local stage runner | relay HMAC (below) |

Every other route answers 404. Responses carry stable codes only; bodies, headers and secrets are never logged.

## 4. CRE callback relay

A deployed `identity-confidential` workflow calls back over HTTPS. The result, though, is awaited by the process that
triggered it, which is the local stage runner:

- investor operations wait on an in-memory map (`InvestorCredentialsService.pending`);
- Trust Anchor admission waits in its stage.

So Railway **stores and forwards**; it never records protocol state itself.

```text
TEE ──POST callback (x-catenor-timestamp, x-catenor-signature)──▶ Railway API
        authenticateCallback: HMAC(cb key), ±300 s, commitment recomputed for OK results
        → in-memory mailbox[runId]: raw timestamp, signature and body; TTL 300 s, capacity 64, single use
        ← 202 RELAYED  (the workflow reports DELIVERED on any 2xx)
local stage runner ──GET …/results/<runId> (relay HMAC)──▶ Railway API ── 200 {timestamp, signature, body} (then deleted)
        runner re-runs authenticateCallback on the same bytes → deliver → U8 / recordResult  (unchanged code path)
```

**Callback authentication (unchanged).** The relay checks:

- `x-catenor-signature = hex(HMAC-SHA256(cb, timestamp + "." + body))`, where `cb` is HKDF-SHA256 of `K` with info
  `catenor-one/identity-confidential/cb/v1`;
- the timestamp is within ±5 min;
- for OK results, the evidence commitment is recomputed.

**Pull authentication [REF-IMPL, new in this prompt].** The pull uses `x-catenor-timestamp` plus
`x-catenor-signature = hex(HMAC-SHA256(relay, timestamp + ".GET " + path))`:

- `relay` is HKDF-SHA256 of `K` with info `catenor-one/identity-confidential/relay/v1`, a separate key from `cb`;
- the timestamp must be within ±5 min.

`K` is `CATENOR_INTERNAL_API_TOKEN`: 32 random bytes, hex-encoded. The same value must appear in three places:

- the Railway variable;
- the instance's `workflows/.env` (`CATENOR_INTERNAL_API_TOKEN_VAR`);
- the Vault DON secret `CATENOR_INTERNAL_API_TOKEN`.

**Enabling it on the runner.** Run `scripts/demo/cre/configure.sh --relay-url=https://<railway-host>`. It records:

- `DEMO_CRE_RELAY_URL`;
- `DEMO_CRE_CALLBACK_PUBLIC_URL = https://<railway-host>/v1/internal/cre/identity-confidential/results`.

In DEPLOYED mode the stages then poll the relay every 1.5 s for the runs they requested. Stage 11 waits for its
admission result. `--callback-url=` (a tunnel to the local receiver) clears the relay again.

**Limits.**

- A Railway restart or redeploy drops undelivered results: the runner times out, and the stage is re-run.
- Do not redeploy during a live CRE run.
- The simulation path is untouched.

## 5. Database

| Question | Answer |
|---|---|
| Prisma | 7.10.0 (`prisma`, `@prisma/client`, `@prisma/adapter-pg`); config `apps/api/prisma.config.ts`; the datasource URL comes only from `DATABASE_URL` |
| `DATABASE_URL` | a standard PostgreSQL connection string. On Railway use the reference variable `${{Postgres.DATABASE_URL}}` (the private-network URL). No `?schema=`: the model uses two schemas, `catenor_public` and `catenor_private` |
| Generate | `pnpm --filter @catenor-one/api db:generate` (`prisma generate`; no database needed; runs in the image build) |
| Migrate | `pnpm --filter @catenor-one/api db:migrate:deploy` (`prisma migrate deploy`: applies pending committed migrations only; never resets, drops or seeds) |
| Automatic? | **No.** Neither startup nor `railway.toml` runs migrations |
| Migrations | 5, all additive: schemas and tables, CHECK constraints, and plpgsql immutability / append-only triggers. No `DROP` or `TRUNCATE`, no extensions. Railway's default `postgres` role can apply them |
| Clean database | the API boots and stays healthy with no database at all; `/v1/health/db` reports `applied: 0` until step 6 and `applied: 5, packaged: 5` after it |
| Demo data | none is written by Railway. The local runner keeps using its own `DEMO_DATABASE_URL`, and the CRE relay needs no database |

Pointing the local runner at Railway Postgres, so that later read APIs (FD-8) can serve the demo state, is **not**
configured. It would need the Postgres TCP proxy, which the S001 plan (T15.2) keeps off; decide that separately.

## 6. Environment

Nothing is required at boot: the API starts with zero variables. Never paste a value into a file in the repository.

**REQUIRED AT BOOT**

- (none)

**REQUIRED ONLY WHEN THE FEATURE IS USED**

| Variable | Feature | Railway type |
|---|---|---|
| `CATENOR_INTERNAL_API_TOKEN` | the CRE callback relay, whose routes answer 503 `CRE_RELAY_NOT_CONFIGURED` without it | **sealed** variable. Must equal the fresh instance's `CATENOR_INTERNAL_API_TOKEN_VAR` and the Vault DON secret |
| `DATABASE_URL` | `GET /v1/health/db` and the manual `prisma migrate deploy` | reference variable `${{Postgres.DATABASE_URL}}` |

**OPTIONAL**

| Variable | Default and meaning |
|---|---|
| `PORT` | injected by Railway; 8080 otherwise |
| `HOST` | `::` |
| `RAILWAY_GIT_COMMIT_SHA` | injected by Railway; its first 12 characters appear in `/v1/health` |

**LOCAL ONLY — NEVER RAILWAY** (the Railway API never reads these)

- **Management-owner private keys:**
  - `~/.catenor-one/clean-room/<instance>/*`;
  - `CATENOR_PRIVY_KEYS_FILE`, `CATENOR_SPV_KEYS_FILE`, `CATENOR_AGENT_KEYS_FILE` and `CATENOR_INVESTOR_KEYS_FILE`
    (these hold key-file paths).
- **Runtime authorization keys:**
  - `DEMO_{ASSERTION,BOOTSTRAP,SPV,AGENT,TREASURY}_RUNTIME_AUTHORIZATION_KEY`;
  - `CATENOR_{ASSERTION,BOOTSTRAP,SPV,AGENT}_RUNTIME_AUTHORIZATION_KEY`.
- **CRE trigger keys:** `DEMO_CRE_TRIGGER_PRIVATE_KEY` and `CRE_ETH_PRIVATE_KEY`.
- **Privy app credentials:** `PRIVY_APP_ID` and `PRIVY_APP_SECRET`. These come from the **new** final-demo Privy app,
  are loaded by the local runner, and are not used by the Railway API today.
- **Sumsub credentials:** `SUMSUB_APP_TOKEN_VAR` and `SUMSUB_SECRET_KEY_VAR`. These come from the **new** Sumsub sandbox
  and go into `workflows/.env`, which the Vault DON and the local runner use.
- **Runner configuration:** `DEMO_DATABASE_URL`, the public refs in `.catenor-demo/state.env`, `CRE_BIN`,
  `CATENOR_DEMO_CONFIRM` and `CATENOR_HEDERA_LIVE`.

## 7. Privy, Sumsub and CRE for the final demo

- **Privy (new final-demo app).** Railway needs **nothing** from it today. `PRIVY_APP_ID` and `PRIVY_APP_SECRET` go into
  the local `apps/api/.env`. The clean-room stages create the new app's authorization keys, wallets and policies
  themselves, with owner keys under `~/.catenor-one/`. A later operator-login route (T4.2) or the web app would need
  the app id, and allowed origins in the Privy dashboard. That is not implemented.
- **Sumsub (new sandbox level).** Railway needs **nothing**. No webhook or callback URL is used anywhere: the TEE reads
  the applicant review from inside CRE, and the local runner performs the sandbox operator actions. **The new level
  must be named `id-only`**, the name hard-coded in `sumsub-sandbox.ts` and in the workflow config
  (`investorEvidence.levelNames`), or the code and config must change first.
- **CRE.** The public callback URL becomes `https://<railway-host>/v1/internal/cre/identity-confidential/results` (§4).
  Deploying and activating CRE stays a separate, manual step (`scripts/demo/cre/*.sh --live`).

## 8. Manual deployment plan (maintainer; nothing here has been run)

Run and inspect each step before starting the next. The Railway CLI is optional; every step also exists in the
dashboard.

1. **Local gate.** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm boundaries && pnpm secret-scan`.
   Optionally build the image: `docker build -f apps/api/Dockerfile -t catenor-one-api:local .`
2. **Push the branch** that contains this change to GitHub (Railway deploys from the repository).
3. **Create the project and service.** Railway dashboard → New Project → Deploy from GitHub repo → this repository.
   Then open service Settings:
   - Root Directory `/`;
   - Config-as-code path `/apps/api/railway.toml`;
   - confirm the builder shows **Dockerfile** and the Dockerfile path `apps/api/Dockerfile`.
4. **Add PostgreSQL.** In the project, add → Database → PostgreSQL. Do **not** enable its public TCP proxy.
5. **Set the variables** on the API service (Variables tab):
   - `DATABASE_URL = ${{Postgres.DATABASE_URL}}`.
   - `CATENOR_INTERNAL_API_TOKEN`, only once the fresh clean-room instance exists. Use the value of that instance's
     `CATENOR_INTERNAL_API_TOKEN_VAR` (the local `01-setup-env.sh` generates it). Mark it **sealed**, and do not print
     it; paste it from the file.
   - Nothing else.
6. **Deploy, then migrate by hand.** Trigger the deploy and wait for the `/v1/health` check to pass. Then run the
   migration inside Railway's network:
   - `railway ssh --service <api-service>`
   - in the shell: `cd /app && pnpm --filter @catenor-one/api db:migrate:deploy`
   - Alternatively, set the service's Pre-deploy Command to `pnpm --filter @catenor-one/api db:migrate:deploy` for one
     deploy, then remove it.
7. **Generate a domain.** Settings → Networking → Generate Domain, which gives `https://<service>.up.railway.app`.
8. **Verify** from your machine:
   - `curl -s https://<host>/v1/health` should show `startup: INERT`, and `creRelay: ENABLED` once the token is set;
   - `curl -s https://<host>/v1/health/db` should show `database: REACHABLE` and `migrations {applied: 5, packaged: 5}`;
   - `curl -s -X POST https://<host>/v1/internal/cre/identity-confidential/results -d '{}'` should answer 401
     `CALLBACK_UNAUTHENTICATED`, which proves the route is live and closed.
9. **Later, when you choose to** (separate authorizations, not part of this deployment):
   - run `scripts/demo/cre/configure.sh --relay-url=https://<host>`;
   - put the same token into `workflows/.env` and run `scripts/demo/cre/secrets.sh --live`;
   - run `deploy.sh --live`, then `activate.sh --live`;
   - run `configure.sh --workflow-id=<id> --use-deployed`.

## 9. Local verification (no Railway)

```bash
pnpm --filter @catenor-one/api start                                  # PORT=8080; inert; no variables needed
docker build -f apps/api/Dockerfile -t catenor-one-api:local .
docker run --rm -p 8080:8080 catenor-one-api:local
curl -s localhost:8080/v1/health
```
