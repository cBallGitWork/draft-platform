# Sourced first by each suite here: what its checks share, and a throwaway folder ($tmp, removed
# when the suite ends) that its hooks take for the project, for HOME and for TMPDIR, never this repo,
# the real home folder or the real temp folder, so no suite reads ~/.claude/private-words.txt or
# leaves state behind. A suite exits 1 if any check failed.
set -uo pipefail

hooks="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"  # the hooks under test
fails=0
tmp=$(mktemp -d) || exit 1  # never empty: git -C "" would act on the checkout it runs from
export CLAUDE_PROJECT_DIR="$tmp" HOME="$tmp" TMPDIR="$tmp"  # TMPDIR too: hooks keep state there
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
denies_unreadable() { # hook: a guard denies each payload it can't read, saying what came, never lets it through
  local i
  for ((i = 0; i < ${#bad_payloads[@]}; i += 2)); do
    check deny "$1" "${bad_payloads[i]}"
    says "${bad_payloads[i + 1]}" "$1" "${bad_payloads[i]}"
  done
}
silent() { # hook payload [env...]: the hook exits 0 and prints nothing
  local hook=$1 payload=$2 out code; shift 2
  out=$(printf '%s' "$payload" | env "$@" "$hooks/$hook"); code=$?
  if [ "$code" -ne 0 ] || [ -n "$out" ]; then fail "$hook: expected silence, got $code: $out: $payload $*"; fi
}
stand_in_gh() { # the stand-in's bash script on stdin: it runs as gh, first on PATH, for the gh calls a hook makes
  mkdir -p "$tmp/bin" && { echo '#!/bin/bash'; stand_in_api; cat; } > "$tmp/bin/gh" && chmod +x "$tmp/bin/gh" && export PATH="$tmp/bin:$PATH"
}
stand_in_api() { # every stand-in's answer to gh api's reads of a pull request (pull_request.py): the open
  # pull requests ($FAKE_OPEN_PRS, one on feat/x by default), and one titled $FAKE_TITLE with $FAKE_BODY's file
  # for its body and $FAKE_LABELS
  cat <<'EOF'
if [ "$1" = api ]; then
  case "$2" in
    *"pulls?"*) open_prs=${FAKE_OPEN_PRS:-'[{"number":5,"head":{"ref":"feat/x"}}]'}; echo "$open_prs";;
    */pulls/*) /usr/bin/jq -nc --arg t "${FAKE_TITLE:-feat: x}" --rawfile b "${FAKE_BODY:-/dev/null}" \
      --argjson l "${FAKE_LABELS:-[]}" '{title:$t,body:$b,labels:$l,head:{sha:"abc"},base:{ref:"main"}}';;
    *) echo "stand-in gh: no answer for $2" >&2; exit 1;;
  esac
  exit 0
fi
EOF
}
bash_cmd() { "$jq" -nc --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
bash_in() { "$jq" -nc --arg c "$2" --arg d "$1" '{tool_name:"Bash",tool_input:{command:$c},cwd:$d}'; }  # dir command
gh_call() { "$jq" -nc --arg t "mcp__github__$1" --argjson i "$2" '{tool_name:$t,tool_input:$i}'; }  # tool input-json
template_body() { sed 's/^Part of #.*/Part of #12/' "$hooks/../../.github/pull_request_template.md"; }  # the whole template, filled in
