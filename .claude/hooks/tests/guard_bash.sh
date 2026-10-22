#!/bin/bash
# guard_bash.py's checks: commands it must refuse and commands it must let through, run from a
# throwaway repo on a feature branch, then on main with a worktree (sub) on a feature branch.
. "$(dirname "$0")/helpers.sh"

git -C "$tmp" init -q -b chore/x
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
for c in "${private_deny[@]}"; do check deny guard_bash.py "$(bash_in "$tmp" "$c")"; done
for c in "${private_allow[@]}"; do check allow guard_bash.py "$(bash_in "$tmp" "$c")"; done
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
export DRAFT_PRIVATE_WORDS=  # HOME is $tmp (helpers.sh), which holds no list
check allow guard_bash.py "$(bash_cmd 'git commit -m "from acmecorp"')"  # no list at the default path, no check
unset DRAFT_PRIVATE_WORDS

# a pull request's body: the whole template with a bare Closes line and a verdict passes; a closing
# word by an issue number elsewhere, a local path, a missing section, no pr-reviewer verdict or a
# ticked "not run" box is refused, as is a body it can't read.
# pr.md carries pr-reviewer's signature; pr-unsigned.md is the bare template, with no verdict at all.
sed 's/^Closes #.*/Closes #12/' "$hooks/../../.github/pull_request_template.md" > "$tmp/pr-unsigned.md"
awk '{ print } /^## Fresh-eyes review/ { print "*Reviewer: pr-reviewer (opus), 2026-10-22, abc..def*" }' \
  "$tmp/pr-unsigned.md" > "$tmp/pr.md"
for b in 'Partly closes #31; the screen remains.' 'It does **not** close #87.' "doesn't fully close #87" \
  'see /Users/craigball/x' 'in /private/tmp/claude-501/x' 'Fixes #4' 'Closes #12  <!-- the template comment, left in -->'; do
  cp "$tmp/pr.md" "$tmp/pr-bad.md" && printf '%s\n' "$b" >> "$tmp/pr-bad.md"
  check deny guard_bash.py "$(bash_in "$tmp" 'gh pr create --title x --body-file pr-bad.md')"
  check deny guard_bash.py "$(bash_in "$tmp" 'gh pr edit 3 --body-file pr-bad.md')"
done
check allow guard_bash.py "$(bash_in "$tmp" 'gh pr create --title x --body-file pr.md')"
check allow guard_bash.py "$(bash_in "$tmp" 'gh pr create --title x -F pr.md')"
check allow guard_bash.py "$(bash_in "$tmp" "gh pr create --title x --body $(printf %q "$(cat "$tmp/pr.md")")")"
check allow guard_bash.py "$(bash_in "$tmp" 'gh pr edit 3 --body "Part of #31; refs #87. It mends a fixed bug."')"
check allow guard_bash.py "$(bash_in "$tmp" 'gh pr edit 3 --title "new title"')"  # no body, nothing to check
grep -v '^## Merge danger' "$tmp/pr.md" > "$tmp/pr-no-danger.md"
grep -v '^## Fresh-eyes review' "$tmp/pr.md" > "$tmp/pr-no-review.md"
grep -v '^## Checks' "$tmp/pr.md" > "$tmp/pr-no-checks.md"
grep -v '^## Left for later' "$tmp/pr.md" > "$tmp/pr-no-later.md"
cp "$tmp/pr.md" "$tmp/pr-ticked.md" && printf '%s\n' '- [x] pr-reviewer: not run — out of time' >> "$tmp/pr-ticked.md"
cp "$tmp/pr-unsigned.md" "$tmp/pr-not-run.md" && printf '%s\n' '- [ ] pr-reviewer: not run — out of time' >> "$tmp/pr-not-run.md"
for c in 'gh pr create --title x --body-file pr-no-danger.md' 'gh pr create --title x --body-file=pr-no-review.md' \
  'gh pr create --title x --body-file pr-no-checks.md' 'gh pr create --title x --body-file pr-no-later.md' \
  'gh pr create --title x --body-file pr-unsigned.md' 'gh pr create --title x --body-file pr-ticked.md' \
  'gh pr create --title x --body "## What"' 'gh pr create --title x --fill' 'gh pr create --title x --body-file nope.md' \
  'gh pr create --title x --body-file - < pr.md' 'gh pr create --title x --body "$(cat pr.md)"' \
  'gh pr edit 3 -b "Closes #3 and #4"' 'env gh pr edit 3 --body "partly fixes #3"'; do
  check deny guard_bash.py "$(bash_in "$tmp" "$c")"
done
check allow guard_bash.py "$(bash_in "$tmp" 'gh pr edit 3 --body-file pr-no-danger.md')"  # create only
check allow guard_bash.py "$(bash_in "$tmp" 'gh pr create --title x --body-file pr-not-run.md')"  # said, not ticked
check allow guard_bash.py "$(bash_in "$tmp" 'gh pr edit 3 --body-file pr-unsigned.md')"  # create only

# a pull request's title: a soft limit of 100 characters (a note, not a denial), denied past 120
t100=$(printf 'x%.0s' {1..100}) t101=$(printf 'x%.0s' {1..101}) t120=$(printf 'x%.0s' {1..120})
t121=$(printf 'x%.0s' {1..121})
silent guard_bash.py "$(bash_in "$tmp" "gh pr create --title $t100 --body-file pr.md")"
says 'past the soft limit of 100' guard_bash.py "$(bash_in "$tmp" "gh pr create --title $t101 --body-file pr.md")"
says '"additionalContext"' guard_bash.py "$(bash_in "$tmp" "gh pr edit 3 -t $t120")"
check allow guard_bash.py "$(bash_in "$tmp" "gh pr edit 3 --title=$t120")"
for c in "gh pr create --title $t121 --body-file pr.md" "gh pr edit 3 -t $t121" "gh pr edit 3 --title=$t121" \
  "git status && gh pr edit 3 --body 'Part of #3' --title $t121"; do
  check deny guard_bash.py "$(bash_in "$tmp" "$c")"
done
silent guard_bash.py "$(bash_in "$tmp" 'gh pr edit 3 --title "$(cat long-title.txt)"')"  # can't be measured
silent guard_bash.py "$(bash_in "$tmp" "echo --title $t121")"  # not a pull request

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
  git init -q -b main "$tmp/$r" && git -C "$tmp/$r" "${as_tester[@]}" commit -q --allow-empty -m x
done
git -C "$tmp/back-main" switch -q -c feat/a
git -C "$tmp/back-feat" switch -q -c feat/a && git -C "$tmp/back-feat" switch -q -c feat/b
check deny guard_bash.py "$(bash_in "$tmp/back-main" 'git switch - && git commit -m x')"
check deny guard_bash.py "$(bash_in "$tmp/back-main" 'git checkout @{-1} && git commit -m x')"
check allow guard_bash.py "$(bash_in "$tmp/back-feat" 'git switch - && git commit -m x')"
check deny guard_bash.py "$(bash_in "$tmp/back-feat" 'git switch feat/a && git switch - && git commit -m x')"  # unsure
. "$(dirname "$0")/guard_bash_reading.sh"  # what it reads inside a command, on this main and sub
# deleting a remote branch from main pushes nothing from it; deleting main is still refused
check allow guard_bash.py "$(bash_cmd 'git push origin --delete feat/old')"
check allow guard_bash.py "$(bash_cmd 'git push origin :feat/old')"
check allow guard_bash.py "$(bash_cmd 'git push origin -d feat/old')"
check allow guard_bash.py "$(bash_cmd 'git push --repo origin :feat/old')"
for c in 'git push origin --delete main' 'git push origin :main' 'git push origin --delete HEAD' \
  'git push origin :feat/old feat/new'; do
  check deny guard_bash.py "$(bash_cmd "$c")"
done
plain=$(mktemp -d) || exit 1  # not a checkout: git can't say which branch it's on, so a push there is refused
check deny guard_bash.py "$(bash_in "$plain" 'git push origin x')"
check deny guard_bash.py "$(bash_in "$plain" 'git commit -m x')"  # and a commit (its staged lines can't be read)
rm -rf "$plain"
check deny guard_bash.py "$(bash_in "$tmp/sub" "env -C $tmp git commit -m x")"  # env -C moves it
git -C "$tmp" init -q -b chore/d "$tmp/det"  # a detached HEAD has no branch, and isn't main
git -C "$tmp/det" "${as_tester[@]}" commit -q --allow-empty -m x && git -C "$tmp/det" switch -q --detach
check allow guard_bash.py "$(bash_in "$tmp/det" 'git commit -m x')"
# a push option's value isn't the remote, and --repo names it: what's pushed is read right
for c in 'git push --repo=origin main' 'git push --repo=origin +x' 'git push --repo=origin --delete main'; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
for o in '-o ci.skip' '--push-option ci.skip' '--push-option=ci.skip' '--receive-pack x' '--exec x'; do
  check allow guard_bash.py "$(bash_cmd "git push $o origin :feat/old")"  # from main: deletes only
done
for payload in 'not json' '' '[]'; do  # a payload it can't read is denied, never let through unchecked
  check deny guard_bash.py "$payload"
done
