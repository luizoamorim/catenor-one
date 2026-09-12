#!/usr/bin/env bash
# 00 — READ-ONLY: tools, network reachability and installed dependencies. Prints no secret and no account data.
source "$(dirname "$0")/lib/common.sh"
header "Prerequisites" "00-check-prerequisites" "Maintainer / judge" "none" "READ-ONLY" \
  "none (reachability of Hedera Testnet relay + Mirror Node only)" "every REQUIRED item OK"

status=0
row() { printf '  %-44s %s\n' "$1" "$2"; }
need_cmd() {
  local name="$1" required="$2" version_cmd="$3"
  if command -v "${name%% *}" >/dev/null 2>&1; then
    row "$name" "OK ($(eval "$version_cmd" 2>/dev/null | head -1))"
  else
    row "$name" "MISSING${required:+ (REQUIRED)}"
    [[ -n "$required" ]] && status=1
  fi
}
echo "Tools:"
need_cmd node required "node --version"
node_major="$(node --version 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/')"
[[ "${node_major:-0}" -ge 24 ]] || { row "node >= 24" "NO (REQUIRED)"; status=1; }
need_cmd pnpm required "pnpm --version"
need_cmd docker required "docker --version"
if docker info >/dev/null 2>&1; then row "docker daemon" "RUNNING"; else row "docker daemon" "NOT RUNNING (REQUIRED for the local PostgreSQL)"; status=1; fi
need_cmd bun required "bun --version"
need_cmd curl required "curl --version"
CRE_BIN="${CRE_BIN:-$HOME/.cre/bin/cre}"
if [[ -x "$CRE_BIN" ]]; then row "cre (Chainlink CRE CLI)" "OK ($("$CRE_BIN" version 2>/dev/null | head -1))"; else row "cre (Chainlink CRE CLI)" "MISSING (REQUIRED for the confidential stages)"; status=1; fi

echo "Dependencies:"
[[ -d "$DEMO_ROOT/node_modules" ]] && row "pnpm install" "OK" || { row "pnpm install" "MISSING — run: pnpm install"; status=1; }
[[ -d "$DEMO_ROOT/workflows/identity-confidential/node_modules" ]] && row "workflow bun install" "OK" \
  || { row "workflow bun install" "MISSING — run: (cd workflows/identity-confidential && bun install)"; status=1; }

echo "Network (Hedera Testnet, public endpoints):"
chain="$(curl -s -m 10 -X POST https://testnet.hashio.io/api -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | sed -n 's/.*"result":"\([^"]*\)".*/\1/p')"
[[ "$chain" == "0x128" ]] && row "JSON-RPC relay (chain 296)" "OK" || { row "JSON-RPC relay (chain 296)" "UNREACHABLE"; status=1; }
code="$(curl -s -m 10 -o /dev/null -w '%{http_code}' https://testnet.mirrornode.hedera.com/api/v1/network/nodes?limit=1)"
[[ "$code" == "200" ]] && row "Mirror Node" "OK" || { row "Mirror Node" "UNREACHABLE"; status=1; }

echo "Credentials (presence only — values are never read here; 01-setup-env.sh validates them):"
[[ -f "$DEMO_ROOT/apps/api/.env" ]] && row "apps/api/.env (Privy app)" "PRESENT" || row "apps/api/.env (Privy app)" "MISSING (maintainer: PRIVY_APP_ID, PRIVY_APP_SECRET)"
[[ -f "$DEMO_ROOT/workflows/.env" ]] && row "workflows/.env (Sumsub sandbox)" "PRESENT" || row "workflows/.env (Sumsub sandbox)" "MISSING (maintainer: SUMSUB_APP_TOKEN_VAR, SUMSUB_SECRET_KEY_VAR)"

echo
[[ $status -eq 0 ]] && echo "RESULT: OK" || echo "RESULT: something REQUIRED is missing (see above)"
exit $status
