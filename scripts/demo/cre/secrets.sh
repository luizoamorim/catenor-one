#!/usr/bin/env bash
# LIVE (Vault DON): upload the three workflow secrets for the PRIVATE registry. `cre secrets create --help`:
#   cre secrets create [SECRETS_FILE_PATH]  ·  --secrets-auth: "browser uses account credentials for secrets on the
#   private registry" (default "onchain" is for the on-chain registry)  ·  -e/--env: .env file with the values
# Values come from workflows/.env via the CLI; this script never reads or prints them.
source "$(dirname "$0")/cre-common.sh"
refuse_onchain
CMD=(secrets create secrets.yaml --secrets-auth browser -T "$CRE_TARGET" -R "$PROJECT_ROOT" -e "$PROJECT_ROOT/.env")
cre_header "secrets" "LIVE (Vault DON)" "SUMSUB_APP_TOKEN, SUMSUB_SECRET_KEY, CATENOR_INTERNAL_API_TOKEN → Vault DON" "secrets stored for $CRE_TARGET"
echo "Command: cre ${CMD[*]}"
is_live "$@" || { echo "DRY RUN — re-run with --live (maintainer; requires cre login)."; exit 0; }
cre "${CMD[@]}"
