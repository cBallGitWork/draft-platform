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

# guard_bash.py, run from a throwaway repo on a feature branch
tmp=$(mktemp -d)
git -C "$tmp" init -q -b chore/x
export CLAUDE_PROJECT_DIR="$tmp"
deny_cmds=(
  'git add -A' 'git add --all' 'git add .' 'git add -u' 'git add -- .' 'git add -N .'
  'git add *' 'git add "."' 'git add ./' 'git add -Av' 'git add -fA' 'git add -A;' '(git add -A)'
  'cd x && git add -A' 'git -C . add -A' 'GIT_X=1 git add -A' $'git status\ngit add -A'
  'git commit -am "x"' 'git commit -a -m "x"' 'git commit --all -m x'
  'git push --force' 'git push -f origin x' 'git push -fu origin x' 'git push --force-with-lease'
  'git push origin +x' 'git -c x=y push -f' 'git push --mirror'
  'git push origin main' 'git push origin HEAD:main' 'git push origin refs/heads/main'
  'git push origin HEAD:refs/heads/main' 'git push origin "main"'
  'git checkout main && git commit -m x'
)
allow_cmds=(
  'git add src/a.ts README.md' 'git add ./src/a.ts' 'git add a.b' 'git add src/a.ts && echo .'
  'git commit -m "fix: a thing"' 'git commit -sm x' 'git commit -m "-f"' 'git commit --amend --no-edit'
  'git commit -m "use git add -A never"' 'git commit -m "handle git add . case"'
  'git commit -m "fix: remove -a flag"' 'git commit -m "a -a b"'
  $'git commit -F - <<\'EOF\'\nwe never git add -A; it isn\'t safe\nEOF'
  'git push -u origin chore/x' 'git push origin chore/main-menu' 'git push origin feat/main'
  'git push origin main:x' 'git switch -c chore/y origin/main && git commit -m x'
  'git status' 'ls -a' 'echo "git add -A"'
)
for c in "${deny_cmds[@]}"; do check deny guard_bash.py "$(bash_cmd "$c")"; done
for c in "${allow_cmds[@]}"; do check allow guard_bash.py "$(bash_cmd "$c")"; done
git -C "$tmp" switch -q -c main
check deny guard_bash.py "$(bash_cmd 'git commit -m "x"')"
check deny guard_bash.py "$(bash_cmd 'git -C . commit -m x')"
check deny guard_bash.py "$(bash_cmd 'git push')"
check allow guard_bash.py "$(bash_cmd 'git status')"
check allow guard_bash.py "$(bash_cmd 'git switch -c chore/y origin/main && git status')"

# guard_spec.py, with and without a SPEC.md. Symlinked paths: on macOS /tmp is /private/tmp.
real=$(cd "$tmp" && pwd -P)
ln -s "$real" "$tmp.link"
for p in "$tmp/src/app.ts" "src/app.ts" "./src/app.ts" "$tmp/package.json" \
         "$tmp/.claude/../src/a.ts" "$real/src/a.ts" "$tmp.link/src/a.ts" "$tmp/sub/.gitignore"; do
  check deny guard_spec.py "$(edit "$p")"
done
for p in "$tmp/SPEC.md" "$tmp/docs/notes.md" "$tmp/.claude/skills/x/SKILL.md" "$tmp/.gitignore" \
         "/tmp/elsewhere.ts" "$tmp/../outside.ts"; do
  check allow guard_spec.py "$(edit "$p")"
done
check deny guard_spec.py "$(/usr/bin/jq -nc --arg p "$tmp/a.ipynb" '{tool_name:"NotebookEdit",tool_input:{notebook_path:$p}}')"
touch "$tmp/SPEC.md"
check allow guard_spec.py "$(edit "$tmp/src/app.ts")"

rm -rf "$tmp" "$tmp.link"
[ "$fails" -eq 0 ] && echo "hooks: all checks pass" || exit 1
