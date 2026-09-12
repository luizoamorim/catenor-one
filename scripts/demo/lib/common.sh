#!/usr/bin/env bash
# Shared helpers for the Catenor One clean-room scripts (scripts/demo/NN-*.sh). Sourced, never executed.
set -euo pipefail

DEMO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
export DEMO_ROOT

# Prints the standard step header for shell-only steps (TypeScript stages print their own, with concrete DIDs).
header() {
  local title="$1" step="$2" actor="$3" operation="$4" mode="$5" sponsors="$6" expected="$7"
  local line
  line="$(printf '─%.0s' $(seq 1 78))"
  printf '\n%s\n[%s]\n%s\n' "$line" "$title" "$line"
  printf 'STEP:      %s\nActor:     %s\nOperation: %s\nMode:      %s\nSponsors:  %s\nExpected:  %s\n%s\n' \
    "$step" "$actor" "$operation" "$mode" "$sponsors" "$expected" "$line"
}

# Runs one TypeScript stage of the clean-room runner (apps/api/scripts/demo/clean-room/run-stage.ts).
run_stage() {
  local id="$1"
  shift
  (cd "$DEMO_ROOT" && pnpm --silent --filter @catenor-one/api demo:stage "$id" "$@")
}
