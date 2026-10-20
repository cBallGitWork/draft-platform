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
for c in 'git switch --create=main' 'git switch -cmain' 'git checkout -bmain' 'git checkout main --'; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c && git commit -m x")"  # attached, or a bare --: still main
done
for c in 'git switch --create=feat/y' 'git switch -cfeat/y' 'git checkout -bfeat/y'; do
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c && git commit -m x")"
done
# git switch - goes back a branch: to main in back-main, to a feature branch in back-feat
for r in back-main back-feat; do
  git init -q -b main "$tmp/$r" && git -C "$tmp/$r" -c user.name=t -c user.email=t@t commit -q --allow-empty -m x
done
git -C "$tmp/back-main" switch -q -c feat/a
git -C "$tmp/back-feat" switch -q -c feat/a && git -C "$tmp/back-feat" switch -q -c feat/b
check deny guard_bash.py "$(bash_in "$tmp/back-main" 'git switch - && git commit -m x')"
check deny guard_bash.py "$(bash_in "$tmp/back-main" 'git checkout @{-1} && git commit -m x')"
check allow guard_bash.py "$(bash_in "$tmp/back-feat" 'git switch - && git commit -m x')"
check deny guard_bash.py "$(bash_in "$tmp/back-feat" 'git switch feat/a && git switch - && git commit -m x')"  # unsure
# git passed as a string, run by a function or behind a runner is still read: refused on main, not in sub
for c in 'sh -c "git commit -m x"' "bash -c 'git commit -m x'" 'zsh -c "git commit -m x"' \
  'bash -lc "git commit -m x"' 'eval "git commit -m x"' "env -S 'git commit -m x'" \
  'echo "$(git commit -m x)"' 'echo `git commit -m x`' 'echo "`git commit -m x`"' \
  'function f { git commit -m x; }; f' 'f() { git commit -m x; }; f' \
  'xargs git commit -m x' 'sudo git commit -m x' 'sudo -u craig git commit -m x' 'timeout 5 git commit -m x' \
  'nice -n 5 git commit -m x' 'time -p git commit -m x'; do
  check deny guard_bash.py "$(bash_cmd "$c")"
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
check deny guard_bash.py "$(bash_in "$tmp/sub" 'sh -c "git add -A"')"
# a cd inside a string counts only inside it; one in an eval, a builtin cd or sudo -D moves the folder
check allow guard_bash.py "$(bash_cmd 'sh -c "cd sub && git commit -m x"')"
check deny guard_bash.py "$(bash_cmd 'sh -c "cd sub" && git commit -m x')"
for c in 'eval "cd .."; git commit -m x' 'builtin cd .. && git commit -m x' 'sudo -D /tmp git commit -m x'; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# nothing hides a command: a heredoc's own line, an unquoted heredoc's $(…), a # inside a word
check deny guard_bash.py "$(bash_in "$tmp/sub" $'cat <<\'EOF\' && git add -A\nmsg\nEOF')"
check deny guard_bash.py "$(bash_cmd $'cat <<EOF\n$(git commit -m x)\nEOF')"
check allow guard_bash.py "$(bash_cmd $'cat <<\'EOF\'\n$(git commit -m x)\nEOF')"
check deny guard_bash.py "$(bash_in "$tmp/sub" 'echo x#; git add -A')"
check allow guard_bash.py "$(bash_cmd "echo '\$(git commit -m x)'")"  # in single quotes it runs nothing
# where it can't read the string or tell the program, it refuses
for c in "sh -c \"git commit -m 'x\"" 'echo "$(git commit -m x"' '$GIT commit -m x' \
  '$(which git) commit -m x' 'eval "$CMD"'; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# deleting a remote branch from main pushes nothing from it; deleting main is still refused
check allow guard_bash.py "$(bash_cmd 'git push origin --delete feat/old')"
check allow guard_bash.py "$(bash_cmd 'git push origin :feat/old')"
for c in 'git push origin --delete main' 'git push origin :main' 'git push origin --delete HEAD' \
  'git push origin :feat/old feat/new'; do
  check deny guard_bash.py "$(bash_cmd "$c")"
done
plain=$(mktemp -d)  # not a checkout: git can't say which branch it's on, so a commit there is refused
check deny guard_bash.py "$(bash_in "$plain" 'git commit -m x')"
rm -rf "$plain"
check deny guard_bash.py "$(bash_in "$tmp/sub" "env -C $tmp git commit -m x")"  # env -C moves it
git -C "$tmp" init -q -b chore/d "$tmp/det"  # a detached HEAD has no branch, and isn't main
git -C "$tmp/det" -c user.name=t -c user.email=t@t commit -q --allow-empty -m x && git -C "$tmp/det" switch -q --detach
check allow guard_bash.py "$(bash_in "$tmp/det" 'git commit -m x')"

# gate_on_stop.py: blocks a stop only while watched files are changed and the gate fails
said() { # expect hook payload [env...]: "speaks" if the hook prints anything, else "quiet"
  local expect=$1 hook=$2 payload=$3 out got; shift 3
  out=$(printf '%s' "$payload" | env "$@" "$here/$hook")
  if [ -n "$out" ]; then got=speaks; else got=quiet; fi
  if [ "$got" != "$expect" ]; then echo "FAIL $hook: expected $expect, got $got: $payload $*"; fails=$((fails + 1)); fi
}
said quiet gate_on_stop.py '{}' DRAFT_GATE_CMD=false   # nothing changed
mkdir -p "$tmp/convex" && touch "$tmp/convex/a.ts"
said speaks gate_on_stop.py '{}' DRAFT_GATE_CMD=false
said quiet gate_on_stop.py '{}' DRAFT_GATE_CMD=true
said quiet gate_on_stop.py '{"stop_hook_active":true}' DRAFT_GATE_CMD=false

# line_ceiling.py: a note past 250 lines, none at or under it, none for prose
seq 251 > "$tmp/long.ts" && seq 250 > "$tmp/short.ts" && seq 400 > "$tmp/long.md"
for f in long.ts short.ts long.md; do
  expect=quiet; [ "$f" = long.ts ] && expect=speaks
  said "$expect" line_ceiling.py "$(/usr/bin/jq -nc --arg p "$tmp/$f" '{tool_input:{file_path:$p}}')"
done

rm -rf "$tmp"
[ "$fails" -eq 0 ] && echo "hooks: all checks pass" || exit 1
