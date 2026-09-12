#!/usr/bin/env bash
# LIVE: activate the deployed workflow (deploy leaves it PAUSED). `cre workflow activate <workflow-folder-path>`.
source "$(dirname "$0")/cre-common.sh"
refuse_onchain
CMD=(workflow activate "$WORKFLOW" -T "$CRE_TARGET" -R "$PROJECT_ROOT")
cre_header "activate" "LIVE" "$WORKFLOW_NAME → ACTIVE (accepts HTTP triggers from authorizedKeys)" "ACTIVE"
echo "Command: cre ${CMD[*]}"
is_live "$@" || { echo "DRY RUN — re-run with --live."; exit 0; }
cre "${CMD[@]}"
