#!/bin/bash
# drift_gate.py's checks, through guard_bash.py: gh pr merge is refused at 10 or more merges since
# the last drift pass unless the pull request's title (the stand-in gh api's $FAKE_TITLE) starts
# "refactor: drift pass"; a count or title it can't read is refused too; the GitHub tool's merge
# waits the same way. gh pr merge --admin is refused always.
. "$(dirname "$0")/helpers.sh"

repo=$tmp/gate && git init -q -b main "$repo"
commits() { # n [message]: n empty commits on main
  local i
  for ((i = 0; i < $1; i++)); do git -C "$repo" "${as_tester[@]}" commit -q --allow-empty -m "${2:-fix: x}"; done
}
stand_in_gh <<'EOF'
echo "stand-in gh: no answer for $*" >&2; exit 1
EOF
tool=$("$jq" -nc --arg d "$repo" '{tool_name:"mcp__github__merge_pull_request",tool_input:{owner:"o",repo:"r",pullNumber:5},cwd:$d}')
merge=(gh pr merge 5 --squash --delete-branch)

commits 1 "refactor: drift pass 1: x (#1)" && commits 9
check allow guard_bash.py "$(bash_in "$repo" "${merge[*]}")"  # 9 since the pass
# --admin is refused wherever it sits, though the gates would pass the merge (pull_request.py)
for admin in 'gh pr merge 5 --squash --admin' 'gh pr merge --admin 5' 'gh pr merge 5 --admin=true' \
  'gh pr merge --admin=false 5' 'git status && gh pr merge 5 --admin' 'gh -R o/r pr merge 5 --admin' \
  'gh --repo o/r pr merge 5 --admin' 'gh --repo=o/r pr merge 5 --admin' 'gh -Ro/r pr merge 5 --admin'; do
  check deny guard_bash.py "$(bash_in "$repo" "$admin")"
done
says "the admin bypass is Craig's, used by him in GitHub" guard_bash.py "$(bash_in "$repo" 'gh pr merge 5 --admin')"
check allow guard_bash.py "$(bash_in "$repo" "gh pr merge 5 --squash --body --admin")"  # the body's text, not the flag
commits 1
export FAKE_TITLE="feat: a thing"
check deny guard_bash.py "$(bash_in "$repo" "${merge[*]}")"  # 10 since, not a pass
check deny guard_bash.py "$(bash_in "$repo" 'gh pr merge --repo o/r 5 --squash')"
check deny guard_bash.py "$(bash_in "$repo" 'gh -R o/r pr merge 5 --squash')"  # the repo before pr merge
check deny guard_bash.py "$(bash_in "$repo" "git status && ${merge[*]}")"
says "Run the drift pass first" guard_bash.py "$(bash_in "$repo" "${merge[*]}")"
says "10 merged since" guard_bash.py "$(bash_in "$repo" "${merge[*]}")"
check deny guard_github.py "$tool"
says "Run the drift pass first" guard_github.py "$tool"
check allow guard_bash.py "$(bash_in "$repo" 'gh pr view 5')"  # only a merge waits
export FAKE_TITLE="refactor: drift pass 2: y"
check allow guard_bash.py "$(bash_in "$repo" "${merge[*]}")"  # the pass itself may merge
check allow guard_github.py "$tool"
export FAKE_TITLE="docs: before the refactor: drift pass"
check deny guard_bash.py "$(bash_in "$repo" "${merge[*]}")"  # the title starts with it, not mentions it
unset FAKE_TITLE
FAKE_API_FAIL=pulls/5 says "can't read this pull request's title" guard_bash.py "$(bash_in "$repo" "${merge[*]}")"
FAKE_API_FAIL=pulls/5 says "can't read this pull request's title" guard_github.py "$tool"

# a folder where the count can't be read is refused, never let through
nomain=$tmp/gate-nomain && git init -q -b trunk "$nomain"
says "Can't count the merges since the last drift pass" guard_bash.py "$(bash_in "$nomain" "${merge[*]}")"
says "Can't count the merges since the last drift pass" guard_github.py \
  "$("$jq" -nc --arg d "$nomain" '{tool_name:"mcp__github__merge_pull_request",tool_input:{owner:"o",repo:"r",pullNumber:5},cwd:$d}')"
