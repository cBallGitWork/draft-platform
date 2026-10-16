#!/bin/bash
# PreToolUse guard for file edits: no code before SPEC.md exists.
# CLAUDE.md: the product is not defined yet, and the first session is an interview.
# Until SPEC.md is at the repo root, only docs and Claude's own setup can be written.
# Once SPEC.md lands this guard allows everything; delete it when it stops earning its place.
# It sees Write/Edit only; a file written through a shell command never reaches it.
set -euo pipefail

root="${CLAUDE_PROJECT_DIR:-$PWD}"
[ -f "$root/SPEC.md" ] && exit 0

input=$(cat)
path=$(printf '%s' "$input" | /usr/bin/jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
[ -z "$path" ] && exit 0

case "$path" in
  /*) ;;
  *) path="$root/$path" ;;
esac
case "$path" in
  "$root"/*) rel="${path#"$root"/}" ;;
  *) exit 0 ;; # outside this repo: not ours to police
esac

case "$rel" in
  *.md | .claude/* | .gitignore) exit 0 ;;
esac

/usr/bin/jq -n --arg r "There is no SPEC.md yet, so no code or config: the product is not defined (CLAUDE.md). Run /grill with Craig first; until then only .md files, .claude/ and .gitignore can be written. Blocked: $rel" \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
