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
bash_in() { /usr/bin/jq -nc --arg c "$2" --arg d "$1" '{tool_name:"Bash",tool_input:{command:$c},cwd:$d}'; }  # dir command

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

# the private-words list: a made-up word, so this file names nothing real
export DRAFT_PRIVATE_WORDS="$tmp/private-words.txt"
printf '# private\nacmecorp\n' > "$DRAFT_PRIVATE_WORDS"
printf 'adapted from AcmeCorp\n' > "$tmp/body.md"
private_deny=(
  'git commit -m "from acmecorp"' 'git commit -m "From ACMECORP"'
  $'git commit -F - <<\'EOF\'\nideas from acmecorp\nEOF'
  'gh pr create --title x --body "acmecorp idea"' 'gh issue create --title x --body-file body.md'
  'gh pr edit 3 --body-file body.md' 'git add a.md && git commit -m "x" -m "acmecorp"'
  'gh pr create --title x --body-file=body.md' 'git commit --file=body.md' 'gh pr review 3 --body "acmecorp"'
  'git tag -a v1 -m "acmecorp"' 'gh release create v1 --notes acmecorp' 'gh api repos/x/y/issues -f body=acmecorp'
  'env gh pr create --title x --body "acmecorp"' 'command gh issue comment 3 --body acmecorp'
  '(true);gh pr create --title x --body acmecorp'
)
private_allow=(
  'git commit -m "clean"' 'echo acmecorp' 'cat body.md' 'gh pr view 3' 'gh issue create --title x --body "clean"'
)
for c in "${private_deny[@]}"; do check deny guard_bash.py "$(/usr/bin/jq -nc --arg c "$c" --arg d "$tmp" '{tool_name:"Bash",tool_input:{command:$c},cwd:$d}')"; done
for c in "${private_allow[@]}"; do check allow guard_bash.py "$(/usr/bin/jq -nc --arg c "$c" --arg d "$tmp" '{tool_name:"Bash",tool_input:{command:$c},cwd:$d}')"; done
printf 'see acmecorp\n' > "$tmp/staged.md" && git -C "$tmp" add staged.md
check deny guard_bash.py "$(bash_cmd 'git commit -m "clean message"')"
git -C "$tmp" rm -q --cached staged.md
mkdir "$tmp/sub" && git -C "$tmp/sub" init -q -b chore/x && printf 'acmecorp\n' > "$tmp/sub/s.md" && git -C "$tmp/sub" add s.md
check deny guard_bash.py "$(bash_cmd 'git -C sub commit -m "clean"')"
check deny guard_bash.py "$(bash_cmd 'cd sub && git commit -m "clean"')"  # a worktree's staged lines, not the project's
check deny guard_bash.py "$(bash_in "$tmp/sub" 'git commit -m "clean"')"
check allow guard_bash.py "$(bash_cmd 'git commit -m "clean"')"
rm "$DRAFT_PRIVATE_WORDS"
check deny guard_bash.py "$(bash_cmd 'git commit -m "clean"')"  # an override that can't be read
check allow guard_bash.py "$(bash_cmd 'git status')"
old_home=$HOME; export DRAFT_PRIVATE_WORDS= HOME="$tmp"
check allow guard_bash.py "$(bash_cmd 'git commit -m "from acmecorp"')"  # no list at the default path, no check
unset DRAFT_PRIVATE_WORDS; export HOME=$old_home

git -C "$tmp" switch -q -c main
check deny guard_bash.py "$(bash_cmd 'git commit -m "x"')"
check deny guard_bash.py "$(bash_cmd 'git -C . commit -m x')"
check deny guard_bash.py "$(bash_cmd 'git push')"
check allow guard_bash.py "$(bash_cmd 'git status')"
check allow guard_bash.py "$(bash_cmd 'git switch -c chore/y origin/main && git status')"

# a worktree is read where the command runs: sub is on chore/x while the project is on main
git -C "$tmp/sub" rm -q --cached s.md
check allow guard_bash.py "$(bash_cmd 'git -C sub commit -m x')"
check allow guard_bash.py "$(bash_cmd 'cd sub && git commit -m x')"
check allow guard_bash.py "$(bash_cmd "cd \"$tmp/sub\" && git push -u origin chore/x")"
check allow guard_bash.py "$(bash_in "$tmp/sub" 'git commit -m x')"
check deny guard_bash.py "$(bash_cmd 'cd sub && cd .. && git commit -m x')"
check deny guard_bash.py "$(bash_in "$tmp/sub" 'git -C .. commit -m x')"
check deny guard_bash.py "$(bash_cmd 'cd sub && git switch main && git commit -m x')"
git -C "$tmp" init -q -b main "$tmp/wt-main"  # and a worktree on main is refused from a project that isn't
CLAUDE_PROJECT_DIR="$tmp/sub" check deny guard_bash.py "$(bash_in "$tmp/sub" 'cd ../wt-main && git commit -m x')"
# where the guard can't be sure of the folder, it refuses (each of these commits on main in a real shell)
for c in '(cd sub) && git commit -m x' 'cd sub && cd - && git commit -m x' 'cd nope; git commit -m x' \
  'cd "$X" && git commit -m x' 'cd -P sub; git commit -m x' 'git commit --amend -C HEAD'; do
  check deny guard_bash.py "$(bash_cmd "$c")"
done
check deny guard_bash.py "$(bash_in "$tmp/sub" "git --git-dir=$tmp/.git commit -m x")"
check deny guard_bash.py "$(bash_in "$tmp/sub" "pushd $tmp && git commit -m x")"
check allow guard_bash.py "$(bash_cmd '(cd sub && git commit -m x)')"
check allow guard_bash.py "$(bash_cmd 'cd sub && git commit --amend -C HEAD')"
for c in 'false && cd sub; git commit -m x' 'true || cd sub && git commit -m x' 'cd sub | git commit -m x' \
  'cd sub & git commit -m x'; do  # a cd that may not run, or runs in another process
  check deny guard_bash.py "$(bash_cmd "$c")"
done
check allow guard_bash.py "$(bash_cmd 'git status && cd sub && git commit -m x')"
check deny guard_bash.py "$(bash_in "$tmp/sub" "GIT_DIR=$tmp/.git git commit -m x")"
for set in 'export' 'declare -x' 'typeset -x' 'readonly' 'env'; do  # however GIT_DIR is set, it moves git
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$set GIT_DIR=$tmp/.git; git commit -m x")"
done
check deny guard_bash.py "$(bash_in "$tmp/sub" "declare -x GIT_WORK_TREE=$tmp; git commit -m x")"
check deny guard_bash.py "$(bash_in "$tmp/sub" "env GIT_DIR=$tmp/.git git commit -m x")"
for c in 'env git commit -m x' 'command git commit -m x' 'exec git commit -m x' 'env -i git commit -m x' \
  'FOO=1 env BAR=2 git commit -m x'; do  # a wrapper still runs git, here on main
  check deny guard_bash.py "$(bash_cmd "$c")"
done
check allow guard_bash.py "$(bash_in "$tmp/sub" 'env git commit -m x')"
# separators with no space between them, and shell syntax in front, still split commands (on main)
for c in '(cd sub); git commit -m x' 'true;(git commit -m x)' '(true);git push origin HEAD' '(true);git add -A' \
  '{ git commit -m x; }' 'if true; then git commit -m x; fi' 'while true; do git commit -m x; done' \
  '! git commit -m x' 'time git commit -m x' 'nohup git commit -m x'; do
  check deny guard_bash.py "$(bash_cmd "$c")"
done
check allow guard_bash.py "$(bash_in "$tmp/sub" '{ git commit -m x; }')"
for c in '{ cd ..; git commit -m x; }' 'if cd ..; then git commit -m x; fi' 'git switch main -q && git commit -m x' \
  'git checkout main --force && git commit -m x'; do  # each lands on main
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
for c in 'git switch -C y origin/main && git commit -m x' 'git checkout -b feat/z main && git commit -m x' \
  'git checkout origin/main -- a && git commit -m x'; do  # a new branch from main, a file restored from it
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
for c in 'git switch -C main && git commit -m x' 'git checkout -B main origin/main && git commit -m x'; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
check deny guard_bash.py "$(bash_in "$tmp/sub" "env -C $tmp git commit -m x")"  # env -C moves it
git -C "$tmp" init -q -b chore/d "$tmp/det"  # a detached HEAD has no branch, and isn't main
git -C "$tmp/det" -c user.name=t -c user.email=t@t commit -q --allow-empty -m x && git -C "$tmp/det" switch -q --detach
check allow guard_bash.py "$(bash_in "$tmp/det" 'git commit -m x')"

# gate_on_stop.py: blocks a stop only while watched files are changed and the gate fails, in the
# checkout the stop came from (the payload's cwd, else the project dir)
said() { # expect hook payload [env...]: "speaks" if the hook prints anything, else "quiet"
  local expect=$1 hook=$2 payload=$3 out got; shift 3
  out=$(printf '%s' "$payload" | env "$@" "$here/$hook")
  if [ -n "$out" ]; then got=speaks; else got=quiet; fi
  if [ "$got" != "$expect" ]; then echo "FAIL $hook: expected $expect, got $got: $payload $*"; fails=$((fails + 1)); fi
}
gate_repo() { # dir: a checkout with its package.json committed, so nothing is changed yet
  git init -q -b chore/g "$1" && printf '{}\n' > "$1/package.json" && git -C "$1" add package.json &&
    git -C "$1" -c user.name=t -c user.email=t@t commit -q -m x
}
stop_in() { /usr/bin/jq -nc --arg d "$1" '{hook_event_name:"SubagentStop",stop_hook_active:false,cwd:$d}'; }
dirty=$tmp/gate-dirty clean=$tmp/gate-clean nopkg=$tmp/gate-nopkg plain=$(mktemp -d)
gate_repo "$dirty" && gate_repo "$clean"
export CLAUDE_PROJECT_DIR=$dirty
said quiet gate_on_stop.py '{}' DRAFT_GATE_CMD=false   # nothing changed
mkdir -p "$dirty/src" && touch "$dirty/src/a.ts"
said speaks gate_on_stop.py '{}' DRAFT_GATE_CMD=false
said quiet gate_on_stop.py '{}' DRAFT_GATE_CMD=true
said quiet gate_on_stop.py '{"stop_hook_active":true}' DRAFT_GATE_CMD=false
said quiet gate_on_stop.py "$(stop_in "$clean")" DRAFT_GATE_CMD=false  # a builder's clean worktree
said speaks gate_on_stop.py "$(stop_in "$dirty")" CLAUDE_PROJECT_DIR="$clean" DRAFT_GATE_CMD=false
# from a subfolder it's judged, and gated, at its checkout's top: there src/a.ts exists, so this gate fails
said speaks gate_on_stop.py "$(stop_in "$dirty/src")" CLAUDE_PROJECT_DIR="$clean" DRAFT_GATE_CMD='test ! -e src/a.ts'
mkdir -p "$plain/src" && touch "$plain/package.json" "$plain/src/a.ts"
said quiet gate_on_stop.py "$(stop_in "$plain")" DRAFT_GATE_CMD=false  # not a git checkout: no gate
git init -q "$nopkg" && mkdir "$nopkg/src" && touch "$nopkg/src/a.ts"
said quiet gate_on_stop.py '{}' CLAUDE_PROJECT_DIR="$nopkg" DRAFT_GATE_CMD=false  # no package.json: no gate
rm -rf "$plain"

# line_ceiling.py: a note past 250 lines, none at or under it, none for prose
seq 251 > "$tmp/long.ts" && seq 250 > "$tmp/short.ts" && seq 400 > "$tmp/long.md"
for f in long.ts short.ts long.md; do
  expect=quiet; [ "$f" = long.ts ] && expect=speaks
  said "$expect" line_ceiling.py "$(/usr/bin/jq -nc --arg p "$tmp/$f" '{tool_input:{file_path:$p}}')"
done

rm -rf "$tmp"
[ "$fails" -eq 0 ] && echo "hooks: all checks pass" || exit 1
