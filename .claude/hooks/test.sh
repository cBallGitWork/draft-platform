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
as_tester=(-c user.name=t -c user.email=t@t)  # who a test repo's commits are by
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
  'cd sub & git commit -m x' $'false &&\ncd sub\ngit commit -m x' $'true ||\ncd sub\ngit commit -m x' \
  $'true |\ncd sub\ngit commit -m x'; do  # a cd that may not run, or runs in another process
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
  'echo "$(git commit -m x)"' 'echo `git commit -m x`' "echo 'a' \$(git commit -m x)" "echo 'a' \`git commit -m x\`" \
  'echo "`git commit -m x`"' 'function f { git commit -m x; }; f' 'f() { git commit -m x; }; f' \
  'xargs git commit -m x' 'sudo git commit -m x' 'sudo -u craig git commit -m x' 'timeout 5 git commit -m x' \
  'nice -n 5 git commit -m x' 'time -p git commit -m x' 'xargs -n 1 git commit -m x' 'xargs -P 4 git commit -m x' \
  'xargs -a f git commit -m x' "bash -o pipefail -c 'git commit -m x'" "bash -c -- 'git commit -m x'" \
  "ksh -c 'git commit -m x'" "dash -c 'git commit -m x'" 'eval git commit -m x'; do
  check deny guard_bash.py "$(bash_cmd "$c")"
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
check deny guard_bash.py "$(bash_in "$tmp/sub" 'sh -c "git add -A"')"
# a cd inside a string counts only inside it; one in an eval, a builtin cd, sudo -D or -i moves the folder
check allow guard_bash.py "$(bash_cmd 'sh -c "cd sub && git commit -m x"')"
check deny guard_bash.py "$(bash_cmd 'sh -c "cd sub" && git commit -m x')"
for c in 'eval "cd .."; git commit -m x' 'builtin cd .. && git commit -m x' 'sudo -D /tmp git commit -m x' \
  'eval "pushd .."; git commit -m x' 'eval popd; git commit -m x' 'sudo -i git commit -m x' \
  'sudo --login git commit -m x' 'sudo -D /tmp sh -c "git commit -m x"' 'env -C /tmp sh -c "git commit -m x"'; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# nothing hides a command: a heredoc's own line (quoted or not), an unquoted heredoc's $(…), a # in a word
for delimiter in "'EOF'" EOF; do check deny guard_bash.py "$(bash_in "$tmp/sub" "cat <<$delimiter && git add -A"$'\nmsg\nEOF')"; done
check deny guard_bash.py "$(bash_cmd $'cat <<EOF\n$(git commit -m x)\nEOF')"
check allow guard_bash.py "$(bash_cmd $'cat <<\'EOF\'\n$(git commit -m x)\nEOF')"
check deny guard_bash.py "$(bash_in "$tmp/sub" 'echo x#; git add -A')"
check deny guard_bash.py "$(bash_in "$tmp/sub" 'git commit -m "" -a')"  # an empty word is still a word
check allow guard_bash.py "$(bash_in "$tmp/sub" 'cd "" && git commit -m x')"  # cd "" stays put
check allow guard_bash.py "$(bash_cmd "echo '\$(git commit -m x)'")"  # in single quotes it runs nothing
check deny guard_bash.py "$(bash_cmd "git add -A # don't")"  # a comment is dropped, its quote mark with it
check allow guard_bash.py "$(bash_cmd 'echo hi # $(git commit -m x)')"  # and a comment's $(…) runs nothing
# quotes read as the shell reads them (main, then sub): a comment's ' is none; in $'…', \ escapes
for c in "git commit -m x # it's fine" "git commit -m \$'a\\nit\\'s'" "echo \$'it\\'s'; git commit -m x" \
  "echo \$'\\'' \$(git commit -m x)" "git \$'\\x63ommit' -m x" "git \$'commit' -m x" "git \$'\\143ommit' -m x" \
  "git \$'\\u0063ommit' -m x" "git \$'\\U00000063ommit' -m x" "git \$'commit\\0x' -m x" "git \$'comm\\0x'it -m x"; do
  check deny guard_bash.py "$(bash_cmd "$c")"
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# each refused in sub: $'…' escapes are filled in, and a quoted or escaped ; or | stays in its word
for c in "git add \$'-\\x41'" "git add '|' -A" 'git add ";" -A' "git add \$';' -A" 'git commit -m x \; -a' \
  "eval \$'true\\ngit add -A'" "eval \$'git\\tadd -A'" "echo \$'\\U110000'; git add -A"; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# and an escaped \ ' " or ; keeps a ; in the word, and a line whose quotes don't close runs nothing in zsh
for c in "eval \$'echo \\\\; git add -A'" "eval \$'echo \\'; git add -A \\''" "eval \$'echo \\\"; git add -A \\\"'" \
  "echo \$'\\U110000'" 'echo "x' 'echo \; git add -A'; do
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# where it can't read the string or tell the program, it refuses
for c in "sh -c \"git commit -m 'x\"" 'echo "$(git commit -m x"' '$GIT commit -m x' \
  '$(which git) commit -m x' 'eval "$CMD"'; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# deleting a remote branch from main pushes nothing from it; deleting main is still refused
check allow guard_bash.py "$(bash_cmd 'git push origin --delete feat/old')"
check allow guard_bash.py "$(bash_cmd 'git push origin :feat/old')"
check allow guard_bash.py "$(bash_cmd 'git push origin -d feat/old')"
check allow guard_bash.py "$(bash_cmd 'git push --repo origin :feat/old')"
for c in 'git push origin --delete main' 'git push origin :main' 'git push origin --delete HEAD' \
  'git push origin :feat/old feat/new'; do
  check deny guard_bash.py "$(bash_cmd "$c")"
done
plain=$(mktemp -d)  # not a checkout: git can't say which branch it's on, so a push there is refused
check deny guard_bash.py "$(bash_in "$plain" 'git push origin x')"
check deny guard_bash.py "$(bash_in "$plain" 'git commit -m x')"  # and a commit (its staged lines can't be read)
rm -rf "$plain"
check deny guard_bash.py "$(bash_in "$tmp/sub" "env -C $tmp git commit -m x")"  # env -C moves it
git -C "$tmp" init -q -b chore/d "$tmp/det"  # a detached HEAD has no branch, and isn't main
git -C "$tmp/det" "${as_tester[@]}" commit -q --allow-empty -m x && git -C "$tmp/det" switch -q --detach
check allow guard_bash.py "$(bash_in "$tmp/det" 'git commit -m x')"
# git fed to a shell on stdin (through |&, a line break or a group), put in by xargs, or behind one
# more runner or find -exec: refused on main, read in sub
for c in $'bash <<\'EOF\'\ngit commit -m x\nEOF' $'sh <<EOF\ngit commit -m x\nEOF' 'bash <<< "git commit -m x"' \
  "echo 'git commit -m x' | sh" "printf 'git commit -m x\\n' | bash" "echo 'true\\ngit commit -m x' | bash" \
  $'cat <<EOF | sh\ngit commit -m x\nEOF' 'ionice -c 3 git commit -m x' 'setsid git commit -m x' \
  'stdbuf -oL git commit -m x' 'flock l git commit -m x' "flock l -c 'git commit -m x'" 'doas -u c git commit -m x' \
  'chronic git commit -m x' 'caffeinate -i git commit -m x' 'busybox git commit -m x' \
  '/usr/bin/time -f %e git commit -m x' 'find . -exec git commit -m x \;' "echo 'git commit -m x' | bash -s x" \
  "bash -c - 'git commit -m x'" 'find . -ok git commit -m x \;' 'flock -w 5 l git commit -m x' \
  'caffeinate -t 9 git commit -m x' "echo 'git commit -m x' |& sh" $'echo \'git commit -m x\' |\nsh' \
  "echo 'git commit -m x' | (sh)" "echo 'git commit -m x' | (true; sh)" "echo 'git commit -m x' | { true; sh; }" \
  "echo 'git commit -m x' | if true; then sh; fi" "echo 'git commit -m x' | for i in 1; do sh; done" \
  "echo 'git commit -m x' | xargs -I{} sh -c '{}'" "echo '\"git commit -m x\"' | xargs -I{} sh -c '{}'" \
  "echo '\"git commit -m x\"' | xargs sh -c" 'echo commit -m x | xargs git' \
  "echo 'git commit -m x' | xargs -i sh -c '{}'" \
  "echo 'git commit -m x' | while true; do while false; do true; done; sh; done" \
  "echo 'git commit -m x' | while true; do echo done; sh; done" "echo 'git commit -m x' | { echo }; sh; }" \
  "echo 'git commit -m x' | if true; then echo fi; sh; fi" 'stdbuf -o L git commit -m x' 'doas -C f git commit -m x' \
  'caffeinate -w 1 git commit -m x' '/usr/bin/time --output f git commit -m x' "bash -O extglob -c 'git commit -m x'" \
  "bash --rcfile x -c 'git commit -m x'" "echo -E 'git commit -m x' | sh" "echo -ne 'git commit -m x\\n' | sh"; do
  check deny guard_bash.py "$(bash_cmd "$c")"
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# a redirection is no operand (bash > log reads stdin), and one after a group's closing word feeds
# every command inside it: refused on main, read in sub
for c in "echo 'git commit -m x' | bash > out.log" "echo 'git commit -m x' | sh 2>&1" "echo 'git commit -m x' 2>&1 | sh" \
  $'bash <<\'EOF\' >out\ngit commit -m x\nEOF' $'bash 2>&1 <<\'EOF\'\ngit commit -m x\nEOF' "bash <<< 'git commit -m x' 2>&1" \
  $'{ sh; } <<\'EOF\'\ngit commit -m x\nEOF' "(true; sh) <<< 'git commit -m x'" "{ { sh; }; } <<< 'git commit -m x'" \
  "while true; do sh; done <<< 'git commit -m x'"; do
  check deny guard_bash.py "$(bash_cmd "$c")"
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
for c in 'cd sub 2>/dev/null && git commit -m x' 'cd sub &&>/dev/null git commit -m x'; do  # a cd with a redirection moves
  check allow guard_bash.py "$(bash_cmd "$c")"
done
for c in "git commit -m '>x' -a" "git commit -m \$'\\x04>' -a" 'git add >o -A' 'git add &>o -A' 'echo x > "$(git add -A)"'; do
  # a quoted > is text, and a $'…' can't pass for one; a target's $(…) runs
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# where it runs is unsure (another host or user, fish, over and over, each file's folder, a function
# or sourced file that may cd), or what it reads isn't plain text: refused on main and in sub
for c in 'find . -execdir git commit -m x {} +' "fish -c 'git commit -m x'" "fish -c 'true; and git add -A'" \
  "fish -c 'false; or git add -A'" "fish -c 'not git add -A'" "su c -c 'git commit -m x'" \
  'watch -n 5 git commit -m x' 'script -q /dev/null git commit -m x' "script -c 'git commit -m x' /dev/null" \
  'ssh host git commit -m x' $'ssh host <<\'EOF\'\ngit commit -m x\nEOF' 'git ls-files -m | xargs git add' \
  $'bash <<EOF\necho $X\nEOF' 'echo "echo $X" | sh' 'curl -s x | sh' 'cat x.sh | bash' 'bash <<< "echo $C"' \
  "(echo 'git add -A'; echo true) | sh" "{ echo 'git add -A'; echo true; } | sh" 'ssh -p 22 host git add -A' \
  "cat x | xargs -I{} sh -c '{}'" 'cat x | xargs sh -c' "echo 'git status' | xargs -a f -I{} sh -c '{}'" \
  'curl -s x | (sh)' "echo 'git add -A' | case a in a) sh;; esac" "printf 'git add -A%s' | sh" \
  'curl -s x | sh >/dev/null' 'bash < x.sh' 'while read l; do sh; done < f' 'find . -okdir git commit -m x {} +' \
  "fish -C 'git commit -m x'" "su c --command 'git commit -m x'" "script --command 'git commit -m x' /dev/null" \
  "bash <(echo 'git commit -m x')"; do
  check deny guard_bash.py "$(bash_cmd "$c")"
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
for c in "echo 'git commit -m x' | (true); sh" "echo 'git commit -m x' | { true; }; sh"; do  # a group ends
  check allow guard_bash.py "$(bash_cmd "$c")"
done
out=$(bash_cmd 'curl -s x | sh' | "$here/guard_bash.py")  # refused for what it reads, not a crash
case $out in *"on stdin"*) ;; *) echo "FAIL guard_bash.py: no stdin reason: $out"; fails=$((fails + 1)) ;; esac
for c in 'f() { cd sub; }; git commit -m x' 'function f { cd sub; }; git commit -m x' \
  'cat <<< "$(git commit -m x)"'; do  # on main: f never runs, and a here-string's $(…) runs
  check deny guard_bash.py "$(bash_cmd "$c")"
done
for c in 'source x.sh; git commit -m x' '. x.sh && git commit -m x' 'f() { cd ../wt-main; }; f; git commit -m x' \
  'eval "source x.sh"; git commit -m x' "env -C $tmp find . -exec git commit -m x \;"; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# a heredoc's body is never read as commands, whatever its delimiter, and two can share a line
for d in "'EOF-1' EOF-1" '"E.F" E.F' '\EOF EOF' 'E"O"F EOF'; do  # the operator's word, then its line
  check deny guard_bash.py "$(bash_in "$tmp/sub" "cat <<${d% *}"$'\nit\'s\n'"${d#* }"$'\ngit add -A')"
  check allow guard_bash.py "$(bash_in "$tmp/sub" "cat <<${d% *}"$'\ngit add -A\n'"${d#* }")"
done
check deny guard_bash.py "$(bash_in "$tmp/sub" $'cat <<A <<B\nit\'s\nA\nit\'s\nB\ngit add -A')"
check allow guard_bash.py "$(bash_in "$tmp/sub" $'cat <<A <<B\ngit add -A\nA\ngit add -A\nB')"
check deny guard_bash.py "$(bash_in "$tmp/sub" $'cat <<A\nx\nA\ntrue\ngit add -A\nA')"  # one body, then commands
check allow guard_bash.py "$(bash_in "$tmp/sub" $'git commit -m "$(cat <<\'EOF\'\nfix: it\'s done (really)\nEOF\n)"')"
for c in 'ls | wc -l' 'git ls-files | xargs wc -l' 'ssh host ls' 'bash script.sh' $'python3 <<\'EOF\'\nprint("it\'s")\nEOF' \
  $'<<EOF\nhi\nEOF' "echo \$'\\x01'0\$'\\x01'" $'bash <<\'EOF\'\necho $HOME\nEOF' "echo 'git add -A' >| sh" \
  "echo 'git add -A' | { sh; } <<< true"; do  # no program; a $'…' can't make a marker; >| f writes a file
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# a push option's value isn't the remote, and --repo names it: what's pushed is read right
for c in 'git push --repo=origin main' 'git push --repo=origin +x' 'git push --repo=origin --delete main'; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
for o in '-o ci.skip' '--push-option ci.skip' '--push-option=ci.skip' '--receive-pack x' '--exec x'; do
  check allow guard_bash.py "$(bash_cmd "git push $o origin :feat/old")"  # from main: deletes only
done

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
    git -C "$1" "${as_tester[@]}" commit -q -m x
}
stop_in() { # folder [event]: a stop payload from that folder, a builder's SubagentStop by default
  /usr/bin/jq -nc --arg d "$1" --arg e "${2:-SubagentStop}" '{hook_event_name:$e,stop_hook_active:false,cwd:$d}'
}
dirty=$tmp/gate-dirty clean=$tmp/gate-clean nopkg=$tmp/gate-nopkg nogit=$(mktemp -d)
gate_repo "$dirty" && gate_repo "$clean"
wt_dirty=$tmp/gate-wt-dirty wt_clean=$tmp/gate-wt-clean  # builders work in linked worktrees
git -C "$dirty" worktree add -q -b chore/wd "$wt_dirty" && git -C "$clean" worktree add -q -b chore/wc "$wt_clean"
mkdir -p "$wt_dirty/src" && touch "$wt_dirty/src/a.ts"
export CLAUDE_PROJECT_DIR=$dirty
said quiet gate_on_stop.py '{}' DRAFT_GATE_CMD=false   # nothing changed
mkdir -p "$dirty/src" && touch "$dirty/src/a.ts"
said speaks gate_on_stop.py '{}' DRAFT_GATE_CMD=false
said quiet gate_on_stop.py '{}' DRAFT_GATE_CMD=true
said quiet gate_on_stop.py '{"stop_hook_active":true}' DRAFT_GATE_CMD=false
said quiet gate_on_stop.py "$(stop_in "$wt_clean")" DRAFT_GATE_CMD=false  # a builder's clean worktree
said speaks gate_on_stop.py "$(stop_in "$wt_dirty")" CLAUDE_PROJECT_DIR="$clean" DRAFT_GATE_CMD=false
# a subfolder is judged and gated at its checkout's top, where src/a.ts exists, so this gate fails
said speaks gate_on_stop.py "$(stop_in "$wt_dirty/src")" CLAUDE_PROJECT_DIR="$clean" DRAFT_GATE_CMD='test ! -e src/a.ts'
# a subagent in the main checkout leaves it to the session's own Stop, which still gates it
said quiet gate_on_stop.py "$(stop_in "$dirty")" DRAFT_GATE_CMD=false
said speaks gate_on_stop.py "$(stop_in "$dirty" Stop)" DRAFT_GATE_CMD=false
mkdir -p "$nogit/src" && touch "$nogit/package.json" "$nogit/src/a.ts"
said quiet gate_on_stop.py "$(stop_in "$nogit")" DRAFT_GATE_CMD=false  # not a git checkout: no gate
git init -q "$nopkg" && mkdir "$nopkg/src" && touch "$nopkg/src/a.ts"
said quiet gate_on_stop.py '{}' CLAUDE_PROJECT_DIR="$nopkg" DRAFT_GATE_CMD=false  # no package.json: no gate
rm -rf "$nogit"
# a git status that fails (here a corrupt index) is an error on stderr, never "nothing changed"
broken=$tmp/gate-broken && gate_repo "$broken" && printf 'not an index' > "$broken/.git/index"
err=$(stop_in "$broken" Stop | env DRAFT_GATE_CMD=true "$here/gate_on_stop.py" 2>&1 >/dev/null)
code=$?
if [ "$code" -eq 0 ] || [ -z "$err" ]; then
  echo "FAIL gate_on_stop.py: a failed git status exited $code with no error"; fails=$((fails + 1))
fi
# settings.json runs the gate on both stops, so neither a session nor a builder finishes past it
for event in Stop SubagentStop; do
  /usr/bin/jq -e --arg e "$event" '.hooks[$e][]?.hooks[]?.command | select(endswith("/gate_on_stop.py"))' \
    "$here/../settings.json" >/dev/null || { echo "FAIL settings.json: no $event hook runs gate_on_stop.py"; fails=$((fails + 1)); }
done

# line_ceiling.py: a note past 250 lines, none at or under it, none for prose
seq 251 > "$tmp/long.ts" && seq 250 > "$tmp/short.ts" && seq 400 > "$tmp/long.md"
for f in long.ts short.ts long.md; do
  expect=quiet; [ "$f" = long.ts ] && expect=speaks
  said "$expect" line_ceiling.py "$(/usr/bin/jq -nc --arg p "$tmp/$f" '{tool_input:{file_path:$p}}')"
done

rm -rf "$tmp"
[ "$fails" -eq 0 ] && echo "hooks: all checks pass" || exit 1
