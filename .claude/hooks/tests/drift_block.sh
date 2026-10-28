#!/bin/bash
# drift_block.py's checks, through guard_bash.py and guard_github.py: opening a pull request is
# refused at 20 or more merges since the last drift pass, except for the drift pass itself or a
# fix/ branch; under 20 it opens, and a count it can't make is refused.
. "$(dirname "$0")/helpers.sh"

commits() { # dir n [message]: n empty commits on the checked-out branch
  local i
  for ((i = 0; i < $2; i++)); do git -C "$1" "${as_tester[@]}" commit -q --allow-empty -m "${3:-fix: x}"; done
}

repo=$tmp/block && git init -q -b main "$repo"
sed 's/^Closes #.*/Closes #12/' "$hooks/../../.github/pull_request_template.md" |
  awk '{ print } /^## Fresh-eyes review/ { print "*Reviewer: pr-reviewer (opus), 2026-10-28, abc..def*" }' > "$repo/pr.md"
commits "$repo" 1 "refactor: drift pass 1: x (#1)"
commits "$repo" 19
git -C "$repo" switch -q -c chore/x
check allow guard_bash.py "$(bash_in "$repo" 'gh pr create --title x --body-file pr.md')"  # 19 since
git -C "$repo" switch -q main && commits "$repo" 1 && git -C "$repo" switch -q chore/x
check deny guard_bash.py "$(bash_in "$repo" 'gh pr create --title x --body-file pr.md')"  # 20 since
says "The drift pass is overdue: 20 pull requests merged since" guard_bash.py \
  "$(bash_in "$repo" 'gh pr create --title x --body-file pr.md')"
check allow guard_bash.py "$(bash_in "$repo" 'gh pr create --title "refactor: drift pass 2: y" --body-file pr.md')"
check deny guard_bash.py "$(bash_in "$repo" 'gh pr create --title "chore: before the refactor: drift pass" --body-file pr.md')"
check deny guard_bash.py "$(bash_in "$repo" 'gh pr create --title "$(echo refactor: drift pass)" --body-file pr.md')"  # a title the shell fills in can't be read, so isn't the pass
check allow guard_bash.py "$(bash_in "$repo" 'gh pr create --title x --head fix/live --body-file pr.md')"
check allow guard_bash.py "$(bash_in "$repo" 'gh pr create -H fix/live --title x --body-file pr.md')"
check allow guard_bash.py "$(bash_in "$repo" 'gh pr create -H someone:fix/live --title x --body-file pr.md')"
says "git fetch" guard_bash.py "$(bash_in "$repo" 'gh pr create --title x --body-file pr.md')"  # a pass merged but not fetched
check deny guard_bash.py "$(bash_in "$repo" 'gh pr create --title x --head chore/y --body-file pr.md')"
git -C "$repo" switch -q -c fix/live
check allow guard_bash.py "$(bash_in "$repo" 'gh pr create --title x --body-file pr.md')"
check allow guard_bash.py "$(bash_in "$repo" 'gh pr edit 3 --title x')"  # only create is blocked

# a cloud session opens pull requests with the GitHub tool, which guard_github.py checks the same way
gh_pr() { "$jq" -nc --arg d "$repo" --argjson i "$1" '{tool_name:"mcp__github__create_pull_request",tool_input:$i,cwd:$d}'; }
export DRAFT_PRIVATE_WORDS_LIST=acmecorp
check deny guard_github.py "$(gh_pr '{"title":"x","head":"chore/x","base":"main","body":"x"}')"
check allow guard_github.py "$(gh_pr '{"title":"refactor: drift pass 2: y","head":"refactor/y","base":"main","body":"x"}')"
check allow guard_github.py "$(gh_pr '{"title":"x","head":"fix/live","base":"main","body":"x"}')"
unset DRAFT_PRIVATE_WORDS_LIST

# a repo with no main can't be counted, so the pull request waits and says why
nomain=$tmp/block-nomain && git init -q -b chore/x "$nomain" && commits "$nomain" 1 && cp "$repo/pr.md" "$nomain"
says "Can't count the merges since the last drift pass" guard_bash.py \
  "$(bash_in "$nomain" 'gh pr create --title x --body-file pr.md')"
