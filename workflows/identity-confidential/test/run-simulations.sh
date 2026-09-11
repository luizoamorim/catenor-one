#!/usr/bin/env bash
# run-simulations.sh — Non-interactive D6 simulation suite for identity-confidential.
#
# Runs from the CRE project root (workflows/).
# Uses synthetic secret values only.
#
# Usage:
#   cd workflows && bash identity-confidential/test/run-simulations.sh
#
# Prerequisites:
#   - CRE CLI installed
#   - workflows/.env.simulation-synthetic exists
#   - bun install done in identity-confidential/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$WF_DIR")"

LIMITS="$WF_DIR/test/limits.production-like.json"
ENV="$PROJECT_ROOT/.env.simulation-synthetic"
PAYLOADS="$WF_DIR/test/payloads"

# Generate payloads (idempotent — uses the synthetic token from .env.simulation-synthetic)
TOKEN="$(grep -E '^CATENOR_INTERNAL_API_TOKEN_VAR=' "$ENV" | cut -d= -f2-)"  # read by the script, never printed
OP="TRUST_ANCHOR_ADMISSION"
RUN="sim-run-001"

echo "=== Generating sealed payloads (base64 transport) ==="
mkdir -p "$PAYLOADS"
node "$WF_DIR/fixtures/seal-context.mjs" "$TOKEN" "$OP" "$RUN" "$PAYLOADS/valid.json"
node "$WF_DIR/fixtures/seal-context.mjs" "$TOKEN" "$OP" "$RUN" "$PAYLOADS/wrong-key.json" --wrong-key
node "$WF_DIR/fixtures/seal-context.mjs" "$TOKEN" "$OP" "$RUN" "$PAYLOADS/wrong-aad-op.json" --wrong-aad-op
node "$WF_DIR/fixtures/seal-context.mjs" "$TOKEN" "$OP" "$RUN" "$PAYLOADS/wrong-runid.json" --wrong-runid
node "$WF_DIR/fixtures/seal-context.mjs" "$TOKEN" "$OP" "$RUN" "$PAYLOADS/flip-ct.json" --flip-ct
node "$WF_DIR/fixtures/seal-context.mjs" "$TOKEN" "$OP" "$RUN" "$PAYLOADS/flip-tag.json" --flip-tag
node "$WF_DIR/fixtures/seal-context.mjs" "$TOKEN" "$OP" "$RUN" "$PAYLOADS/expired.json" --expired
node "$WF_DIR/fixtures/seal-context.mjs" "$TOKEN" "UNKNOWN_OPERATION" "$RUN" "$PAYLOADS/unknown-op.json"
echo ""

run_sim() {
  local label="$1"
  local payload_file="$2"
  local expected_code="$3"

  echo "=== ($label) ==="
  local output
  output=$(cd "$PROJECT_ROOT" && TERM=dumb cre workflow simulate identity-confidential \
    -e "$ENV" --limits "$LIMITS" --trigger-index 0 --non-interactive \
    --http-payload "$payload_file" 2>&1) || true

  # Extract user logs and result
  echo "$output" | grep -E "\[USER LOG\]|Workflow Simulation Result:|✗" || true
  echo ""

  # Check expected code (may be escaped in JSON output)
  if echo "$output" | grep -qF "\"code\":\"$expected_code\"" || echo "$output" | grep -qF "\\\"code\\\":\\\"$expected_code\\\""; then
    echo "  ✓ PASS — expected $expected_code"
  else
    echo "  ✗ FAIL — expected $expected_code"
    echo "  Full output:"
    echo "$output" | tail -5
  fi
  echo ""
}

echo "=== D6 Simulation Suite (production-like limits) ==="
echo "Evidence: cre workflow simulate, production-like limits file"
echo ""

# (a) the real handler runs; config.simulation.json points Sumsub and the callback at localhost ports that are not
#     listening in this standalone suite → FAILED/CALLBACK_UNREACHABLE. The full path (MOCK Sumsub server + callback
#     into the API) is `pnpm test:cre-sim`.
run_sim "a — valid context → handler runs, no receiver" "$PAYLOADS/valid.json" "CALLBACK_UNREACHABLE"
run_sim "b — wrong key"                             "$PAYLOADS/wrong-key.json" "SEALED_CONTEXT_OPEN_FAILED"
run_sim "c — wrong AAD (operation in AAD differs)"  "$PAYLOADS/wrong-aad-op.json" "SEALED_CONTEXT_OPEN_FAILED"
run_sim "d — wrong runId (context runId != trigger)" "$PAYLOADS/wrong-runid.json" "SEALED_CONTEXT_OPEN_FAILED"
run_sim "e — flipped ciphertext bit"                "$PAYLOADS/flip-ct.json" "SEALED_CONTEXT_OPEN_FAILED"
run_sim "f — flipped tag bit"                       "$PAYLOADS/flip-tag.json" "SEALED_CONTEXT_OPEN_FAILED"
run_sim "g — expired notAfter"                      "$PAYLOADS/expired.json" "SEALED_CONTEXT_OPEN_FAILED"
run_sim "h — unknown operation → UNKNOWN_OPERATION" "$PAYLOADS/unknown-op.json" "UNKNOWN_OPERATION"

echo "=== Suite complete ==="
