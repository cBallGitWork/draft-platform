#!/bin/bash
# Runs each guard against commands it must block and commands it must let through.
# Usage: .claude/hooks/test.sh   (exits 1 on any wrong answer)
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
fails=0

check() { # expect hook payload
  local expect=$1 hook=$2 payload=$3 out got
  out=$(printf '%s' "$payload" | "$here/$hook")
  if printf '%s' "$out" | grep -q '"permissionDecision": "deny"'; then got=deny; else got=allow; fi
  if [ "$got" != "$expect" ]; then
    echo "FAIL $hook: expected $expect, got $got: $payload"
    fails=$((fails + 1))
  fi
}
bash_cmd() { /usr/bin/jq -nc --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
edit() { /usr/bin/jq -nc --arg p "$1" '{tool_name:"Write",tool_input:{file_path:$p}}'; }

# guard_bash.sh, run from a throwaway repo on a feature branch
tmp=$(mktemp -d)
git -C "$tmp" init -q -b chore/x
export CLAUDE_PROJECT_DIR="$tmp"
for c in 'git add -A' 'git add --all' 'git add .' 'git add -u' 'git add -- .' 'cd x && git add -A' \
         'git commit -am "x"' 'git commit -a -m "x"' 'git commit --all -m x' \
         'git push --force' 'git push -f origin x' 'git push --force-with-lease' 'git push origin +x' \
         'git push origin main' 'git push origin HEAD:main'; do
  check deny guard_bash.sh "$(bash_cmd "$c")"
done
for c in 'git add src/a.ts README.md' 'git add ./src/a.ts' 'git commit -m "fix: a thing"' \
         'git commit --amend --no-edit' 'git push -u origin chore/x' 'git push origin chore/main-menu' \
         'git status' 'ls -a'; do
  check allow guard_bash.sh "$(bash_cmd "$c")"
done
git -C "$tmp" switch -q -c main
check deny guard_bash.sh "$(bash_cmd 'git commit -m "x"')"
check deny guard_bash.sh "$(bash_cmd 'git push')"
check allow guard_bash.sh "$(bash_cmd 'git status')"

# guard_spec.sh, with and without a SPEC.md
for p in "$tmp/src/app.ts" "src/app.ts" "$tmp/package.json"; do
  check deny guard_spec.sh "$(edit "$p")"
done
for p in "$tmp/SPEC.md" "$tmp/docs/notes.md" "$tmp/.claude/skills/x/SKILL.md" "$tmp/.gitignore" "/tmp/elsewhere.ts"; do
  check allow guard_spec.sh "$(edit "$p")"
done
touch "$tmp/SPEC.md"
check allow guard_spec.sh "$(edit "$tmp/src/app.ts")"

rm -rf "$tmp"
[ "$fails" -eq 0 ] && echo "hooks: all checks pass" || exit 1
