#!/bin/bash
# setup_current.py's checks: silent while .claude/ and CLAUDE.md match origin/main; one loud line
# naming the agents and skills that differ, and how many other files, when they don't, whichever
# side is newer; a git call that fails is one line on stderr.
. "$(dirname "$0")/helpers.sh"

repo=$tmp/setup && git init -q -b main "$repo"
export CLAUDE_PROJECT_DIR=$repo
mkdir -p "$repo/.claude/agents" "$repo/.claude/skills/design" "$repo/.claude/hooks" "$repo/src"
for f in .claude/agents/pr-reviewer.md .claude/agents/ui-verifier.md .claude/skills/design/SKILL.md \
  .claude/hooks/guard.py CLAUDE.md src/app.ts; do echo start > "$repo/$f"; done
git -C "$repo" add .claude CLAUDE.md src && git -C "$repo" "${as_tester[@]}" commit -q -m start
merged() { # files...: a commit on origin/main (made on a side branch) changing them
  git -C "$repo" switch -q -c "side-$RANDOM" origin/main
  for f in "$@"; do echo "$RANDOM" >> "$repo/$f"; done
  git -C "$repo" add "$@" && git -C "$repo" "${as_tester[@]}" commit -q -m "merged $*"
  git -C "$repo" update-ref refs/remotes/origin/main HEAD && git -C "$repo" switch -q main
}
git -C "$repo" update-ref refs/remotes/origin/main HEAD

silent setup_current.py '{}'  # the same
merged src/app.ts
silent setup_current.py '{}'  # only the app moved on: the setup is the same
merged .claude/agents/ui-verifier.md .claude/skills/design/SKILL.md
says "SETUP DIFFERS FROM origin/main: this session loaded agents ui-verifier; skills design as this checkout" setup_current.py '{}'
says "origin/main has changed them since this branch left it, so restart after updating" setup_current.py '{}'
says '"systemMessage": "SETUP DIFFERS' setup_current.py '{}'  # Craig sees it too
merged .claude/hooks/guard.py CLAUDE.md .claude/agents/pr-reviewer.md
says "agents pr-reviewer, ui-verifier; skills design; 2 other file(s) (.claude/hooks/guard.py, CLAUDE.md)" setup_current.py '{}'

# caught up: silent again; a branch's own change to the setup is said too
git -C "$repo" reset -q --hard origin/main
silent setup_current.py '{}'
echo mine >> "$repo/CLAUDE.md" && git -C "$repo" "${as_tester[@]}" commit -q -am "mine"
says "1 other file(s) (CLAUDE.md) as this checkout has them: only this branch changes them" setup_current.py '{}'
# an uncommitted change isn't what the session's branch holds, so it isn't counted
git -C "$repo" reset -q --hard origin/main && echo edit >> "$repo/.claude/agents/pr-reviewer.md"
silent setup_current.py '{}'

# no origin/main, or no git at all: one line on stderr, never silence
nomain=$tmp/setup-nomain && git init -q -b main "$nomain" && git -C "$nomain" "${as_tester[@]}" commit -q --allow-empty -m x
fails_loudly "so it can't say whether this session's setup is the merged one." setup_current.py '{}' CLAUDE_PROJECT_DIR="$nomain"
nogit=$(mktemp -d) || exit 1
fails_loudly "setup_current.py: git diff --quiet HEAD origin/main" setup_current.py '{}' CLAUDE_PROJECT_DIR="$nogit"
rm -rf "$nogit"
