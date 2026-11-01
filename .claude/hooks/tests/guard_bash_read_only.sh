#!/bin/bash
# guard_bash.py's read-only agents (read_only.py): pr-reviewer, ui-verifier and Claude Code's
# Explore and Plan, run in a builder's worktree, may read any commit but run no git command that
# changes a checkout of the repo, so the builder's branch stays attached (#938); a builder, the main
# thread and a scratch repo of the reviewer's own are not held to it. A subagent's payload naming
# no agent_type gets a note, since the check can't run without it.
. "$(dirname "$0")/helpers.sh"

repo=$tmp/repo && git init -q -b main "$repo"
git -C "$repo" "${as_tester[@]}" commit -q --allow-empty -m "start"
git -C "$repo" update-ref refs/remotes/origin/main HEAD
wt=$tmp/wt && git -C "$repo" worktree add -q -b feat/builder "$wt"
scratch=$tmp/scratch && git init -q -b chore/s "$scratch"
# a PreToolUse payload from a subagent, shaped as Claude Code's hooks reference shows one (its
# common input fields, agent_id and agent_type among them), run in the builder's worktree
as_agent() { # agent command
  "$jq" -nc --arg a "$1" --arg c "$2" --arg d "$wt" '{session_id:"abc123",
    transcript_path:"/home/user/.claude/projects/p/abc123.jsonl", cwd:$d, permission_mode:"default",
    hook_event_name:"PreToolUse", tool_name:"Bash", tool_input:{command:$c, description:"d"},
    tool_use_id:"toolu_01ABC", agent_id:"a509eb1718d06248f", agent_type:$a}'
}

changes=(
  'git checkout -q origin/main' 'git checkout -q --detach origin/main' 'git switch --detach main'
  "cd $wt; git checkout -q origin/main 2>&1|tail -1; grep -rn x ." 'git checkout origin/main -- a.ts'
  "git -C $repo reset --hard" 'git stash' 'git stash pop' 'git merge origin/main' 'git commit -m x'
  'git add a.ts' 'git read-tree -u -m origin/main' 'git update-ref HEAD origin/main'
  'git update-ref refs/heads/feat/builder origin/main' 'git symbolic-ref HEAD refs/heads/main'
  'git symbolic-ref -d HEAD' 'git branch -f feat/builder origin/main' 'git branch --force x main'
  'git branch -D feat/builder' 'git branch -m feat/builder y' 'git config alias.co checkout'
  'git config --add alias.co "checkout -q"' 'git -c alias.co=checkout co origin/main'
  'git -c Alias.co=checkout co main'
  'git -C "$X" checkout main'  # a folder the guard can't place
)
reads=(
  'git diff origin/main...HEAD' 'git show origin/main:a.ts' 'git grep -n x origin/main' 'git log --oneline -3'
  'git status --short' 'git ls-tree -r --name-only origin/main' "git -C $scratch commit -q --allow-empty -m x"
  'git stash list' 'git stash show -p stash@{0}' 'git branch --show-current' 'git branch -a --contains HEAD'
  'git symbolic-ref HEAD' 'git symbolic-ref --short HEAD' 'git config --get alias.co' 'git config -l'
  'git config user.name' "git worktree add --detach $tmp/read origin/main"
)
for agent in pr-reviewer ui-verifier Explore Plan; do
  for c in "${changes[@]}"; do check deny guard_bash.py "$(as_agent "$agent" "$c")"; done
  for c in "${reads[@]}"; do check allow guard_bash.py "$(as_agent "$agent" "$c")"; done
done
for agent in general-purpose fork; do  # builders: no file says they are read-only
  check allow guard_bash.py "$(as_agent "$agent" 'git checkout -q origin/main')"
done
check allow guard_bash.py "$(bash_in "$wt" 'git checkout -q origin/main')"  # the main thread: no agent_type

# what it says names the ways to read another commit
says "git show <rev>:<path>" guard_bash.py "$(as_agent pr-reviewer 'git checkout -q origin/main')"
says "git worktree add --detach <scratch dir> <rev>" guard_bash.py "$(as_agent pr-reviewer 'git stash')"

# a subagent's payload with no agent_type: let through, with a note to Claude and to Craig
no_type=$(as_agent x 'git checkout -q origin/main' | "$jq" -c 'del(.agent_type)')
check allow guard_bash.py "$no_type"
says "names no agent_type" guard_bash.py "$no_type"
silent guard_bash.py "$(bash_in "$wt" 'git status')"  # the main thread has no agent_id: no note
