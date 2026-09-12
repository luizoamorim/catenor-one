# Plan — Railway-ready API backend (prompt 2026-09-12-024)

**Status:** implemented locally; deployment is the maintainer's manual step (`docs/deployment/RAILWAY.md` §8)  
**Prompt:** `docs/hackathon/prompts/2026-09-12-024-railway-backend-preparation.md`  
**Scope guard:** no protocol or semantic change; no external action; the S001 channel key schedule (ctx / cb / salt) and
the callback authentication are reused unchanged.

## 1. Gap analysis

| Needed for Railway | Existing | Change |
|---|---|---|
| A process to deploy | none (`apps/api` had services and scripts only; T4.1 open) | `src/main.ts` + `infrastructure/http/api-server.ts` (node:http; not NestJS) |
| A health check | none | `GET /v1/health` (static) + `GET /v1/health/db` (read-only migration count) |
| A public CRE callback | `POST /v1/internal/cre/identity-confidential/results`, served only by the local receiver | the same path on Railway, as an authenticated store-and-forward relay |
| Delivery to the waiting process | an in-memory `pending` map in the local runner (investor operations) | runner poller: an authenticated one-time pull, then the unchanged `authenticateCallback → deliver` |
| An image | none | `apps/api/Dockerfile` (repository-root context) + `.dockerignore` |
| Service config | none | `apps/api/railway.toml` (DOCKERFILE builder, health check, one replica, no pre-deploy migration) |

## 2. Decisions

- **Relay over a shared database.** It needs no Postgres TCP proxy (T15.2 keeps it off), no migration, and no
  persistence of result envelopes. A restart drops at most in-flight results.
- **A separate relay key**, `HKDF(K, "…/relay/v1")`, so that a pull signature and a callback signature are never
  interchangeable.
- **Migrations are manual** (`railway ssh … db:migrate:deploy`), as the maintainer asked to inspect every external
  step.
- **Inertness is enforced by a test** (`main.inert.test.ts`) that walks the import graph, not just stated in comments.
