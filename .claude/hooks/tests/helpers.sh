# Sourced first by each suite here: what its checks share, and a throwaway folder ($tmp, removed
# when the suite ends) that its hooks take for the project, never this repo. A suite exits 1 if any
# check failed.
set -uo pipefail

hooks="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"  # the hooks under test
fails=0
tmp=$(mktemp -d)
export CLAUDE_PROJECT_DIR="$tmp"
as_tester=(-c user.name=t -c user.email=t@t)  # who a test repo's commits are by

finish() {
  local status=$?
  rm -rf "$tmp"
  [ "$fails" -eq 0 ] || exit 1
  exit "$status"
}
trap finish EXIT

fail() { echo "FAIL $*"; fails=$((fails + 1)); }
check() { # expect hook payload: "deny" if the hook denies it, else "allow"
  local expect=$1 hook=$2 payload=$3 out got
  out=$(printf '%s' "$payload" | "$hooks/$hook")
  if printf '%s' "$out" | grep -q '"permissionDecision": "deny"'; then got=deny; else got=allow; fi
  if [ "$got" != "$expect" ]; then fail "$hook: expected $expect, got $got: $payload"; fi
}
said() { # expect hook payload [env...]: "speaks" if the hook prints anything, else "quiet"
  local expect=$1 hook=$2 payload=$3 out got; shift 3
  out=$(printf '%s' "$payload" | env "$@" "$hooks/$hook")
  if [ -n "$out" ]; then got=speaks; else got=quiet; fi
  if [ "$got" != "$expect" ]; then fail "$hook: expected $expect, got $got: $payload $*"; fi
}
bash_cmd() { /usr/bin/jq -nc --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
bash_in() { /usr/bin/jq -nc --arg c "$2" --arg d "$1" '{tool_name:"Bash",tool_input:{command:$c},cwd:$d}'; }  # dir command
