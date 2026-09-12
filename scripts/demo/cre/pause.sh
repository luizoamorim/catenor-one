#!/usr/bin/env bash
# LIVE: pause (default) or delete (--delete, permanent) the deployed workflow. `cre workflow pause|delete`.
source "$(dirname "$0")/cre-common.sh"
refuse_onchain
action=pause; for a in "$@"; do [[ "$a" == "--delete" ]] && action=delete; done
CMD=(workflow "$action" "$WORKFLOW" -T "$CRE_TARGET" -R "$PROJECT_ROOT")
cre_header "$action" "LIVE" "$WORKFLOW_NAME → $action" "$action done"
echo "Command: cre ${CMD[*]}"
is_live "$@" || { echo "DRY RUN — re-run with --live."; exit 0; }
cre "${CMD[@]}"
