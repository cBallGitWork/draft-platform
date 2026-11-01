# Sourced first by each suite here: what its checks share, and a throwaway folder ($tmp, removed
# when the suite ends) that its hooks take for the project and for HOME, never this repo or the real
# home folder, so no suite reads ~/.claude/private-words.txt. A suite exits 1 if any check failed.
set -uo pipefail

hooks="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"  # the hooks under test
fails=0
tmp=$(mktemp -d) || exit 1  # never empty: git -C "" would act on the checkout it runs from
export CLAUDE_PROJECT_DIR="$tmp" HOME="$tmp"
as_tester=(-c user.name=t -c user.email=t@t)  # who a test repo's commits are by
jq=/usr/bin/jq  # the system's own, as on CI's runner

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
says() { # text hook payload [env...]: the hook exits 0 and prints something holding text
  local text=$1 hook=$2 payload=$3 out code; shift 3
  out=$(printf '%s' "$payload" | env "$@" "$hooks/$hook"); code=$?
  if [ "$code" -ne 0 ] || ! printf '%s' "$out" | grep -qF -- "$text"; then
    fail "$hook: expected exit 0 and \"$text\", got $code: $out: $payload $*"
  fi
}
fails_loudly() { # text hook payload [env...]: the hook exits 1, prints nothing on stdout, says text on stderr
  local text=$1 hook=$2 payload=$3 out err code; shift 3
  out=$(printf '%s' "$payload" | env "$@" "$hooks/$hook" 2>"$tmp/stderr"); code=$?; err=$(cat "$tmp/stderr")
  if [ "$code" -ne 1 ] || [ -n "$out" ] || ! printf '%s' "$err" | grep -qF -- "$text"; then
    fail "$hook: expected exit 1 and \"$text\" on stderr, got $code: $out / $err: $payload"
  fi
}
bad_payloads=( # each with what the hook says of it
  '' 'is empty'  'not json' "isn't JSON"  '[]' 'is JSON but not an object'  '"x"' 'is JSON but not an object'
)
blocks() { says '"decision": "block"' "$@"; }  # hook payload [env...]: it blocks the stop
silent() { # hook payload [env...]: the hook exits 0 and prints nothing
  local hook=$1 payload=$2 out code; shift 2
  out=$(printf '%s' "$payload" | env "$@" "$hooks/$hook"); code=$?
  if [ "$code" -ne 0 ] || [ -n "$out" ]; then fail "$hook: expected silence, got $code: $out: $payload $*"; fi
}
stand_in_gh() { # the stand-in's bash script on stdin: it runs as gh, first on PATH, for the gh calls a hook makes
  mkdir -p "$tmp/bin" && { echo '#!/bin/bash'; cat; } > "$tmp/bin/gh" && chmod +x "$tmp/bin/gh" && export PATH="$tmp/bin:$PATH"
}
bash_cmd() { "$jq" -nc --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
bash_in() { "$jq" -nc --arg c "$2" --arg d "$1" '{tool_name:"Bash",tool_input:{command:$c},cwd:$d}'; }  # dir command
gh_call() { "$jq" -nc --arg t "mcp__github__$1" --argjson i "$2" '{tool_name:$t,tool_input:$i}'; }  # tool input-json
template_body() { sed 's/^Closes #.*/Closes #12/' "$hooks/../../.github/pull_request_template.md"; }  # the whole template, unsigned
signed() { awk '{ print } /^## Fresh-eyes review/ { print "*Reviewer: pr-reviewer (opus), 2026-10-22, abc..def*" }'; }  # stdin, signed by pr-reviewer
