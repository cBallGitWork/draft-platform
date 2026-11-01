#!/bin/bash
# guard_bash.py's read-only agents (read_only.py): pr-reviewer, ui-verifier and Claude Code's
# Explore and Plan, run in a builder's worktree, may read any commit but run no git command that
# changes a checkout of the repo, so the builder's branch stays attached (#938); a builder, the main
# thread and a scratch repo of the reviewer's own are not held to it.
. "$(dirname "$0")/helpers.sh"

repo=$tmp/repo && git init -q -b main "$repo"
git -C "$repo" "${as_tester[@]}" commit -q --allow-empty -m "start"
git -C "$repo" update-ref refs/remotes/origin/main HEAD
wt=$tmp/wt && git -C "$repo" worktree add -q -b feat/builder "$wt"
scratch=$tmp/scratch && git init -q -b chore/s "$scratch"
as_agent() { # agent command: a Bash payload from that subagent, run in the builder's worktree
  "$jq" -nc --arg a "$1" --arg c "$2" --arg d "$wt" '{tool_name:"Bash",tool_input:{command:$c},cwd:$d,agent_type:$a}'
}

changes=(
  'git checkout -q origin/main' 'git checkout -q --detach origin/main' 'git switch --detach main'
  "cd $wt; git checkout -q origin/main 2>&1|tail -1; grep -rn x ." 'git checkout origin/main -- a.ts'
  "git -C $repo reset --hard" 'git stash' 'git merge origin/main' 'git commit -m x' 'git add a.ts'
  'git -C "$X" checkout main'  # a folder the guard can't place
)
reads=(
  'git diff origin/main...HEAD' 'git show origin/main:a.ts' 'git grep -n x origin/main' 'git log --oneline -3'
  'git status --short' 'git ls-tree -r --name-only origin/main' "git -C $scratch commit -q --allow-empty -m x"
)
for agent in pr-reviewer ui-verifier Explore Plan; do
  for c in "${changes[@]}"; do check deny guard_bash.py "$(as_agent "$agent" "$c")"; done
  for c in "${reads[@]}"; do check allow guard_bash.py "$(as_agent "$agent" "$c")"; done
done
for agent in general-purpose fork; do  # builders: no file says they are read-only
  check allow guard_bash.py "$(as_agent "$agent" 'git checkout -q origin/main')"
done
check allow guard_bash.py "$(bash_in "$wt" 'git checkout -q origin/main')"  # the main thread: no agent_type

# what it says names the way to read another commit
says "git show <rev>:<path>" guard_bash.py "$(as_agent pr-reviewer 'git checkout -q origin/main')"
