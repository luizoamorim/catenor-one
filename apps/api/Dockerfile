# syntax=docker/dockerfile:1
# Catenor One API — Railway image (prompt 024; docs/deployment/RAILWAY.md).
# Build context: the REPOSITORY ROOT (pnpm workspace: apps/api depends on packages/*). The root .dockerignore keeps
# every .env file, .catenor-demo/, workflows/ (CRE secrets) and local state out of the context; management-owner keys
# live under ~/.catenor-one/, outside any build context, and are never needed here.
#
# The image runs the TypeScript sources through tsx with the @catenor-one/source export condition — the same way every
# script in this repository runs (no separate compile step exists for apps/api). Nothing here needs a database or a
# secret at build time: `prisma generate` reads only prisma/schema.prisma.
FROM node:24.10.0-bookworm-slim

# openssl + CA roots for Prisma (migrate deploy, run manually) and outbound TLS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.11.0

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "@catenor-one/api..." \
  && pnpm --filter @catenor-one/api db:generate \
  && chown -R node:node /app

USER node
WORKDIR /app/apps/api
ENV PORT=8080
EXPOSE 8080
# PID 1 is node itself, so Railway's SIGTERM reaches the API's graceful shutdown.
CMD ["node", "--conditions=@catenor-one/source", "--import", "tsx", "src/main.ts"]
