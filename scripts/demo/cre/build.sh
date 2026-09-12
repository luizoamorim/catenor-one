#!/usr/bin/env bash
# LOCAL: compile identity-confidential to WASM (no upload, no auth). `cre workflow build --help`:
# "Compiles the workflow to WASM and writes the raw binary to a file. Does not upload, register, or simulate."
source "$(dirname "$0")/cre-common.sh"
cre_header "build" "LOCAL" "writes workflows/identity-confidential/binary.wasm (git-ignored)" "a WASM binary"
cre workflow build "$WORKFLOW" -T "$CRE_TARGET" -R "$PROJECT_ROOT"
ls -l "$PROJECT_ROOT/$WORKFLOW/binary.wasm"
