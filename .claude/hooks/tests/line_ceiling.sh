#!/bin/bash
# line_ceiling.py's checks: a note past 250 lines, none at or under it, none for prose.
# Usage: .claude/hooks/tests/line_ceiling.sh   (test.sh runs it with the others)
. "$(dirname "$0")/helpers.sh"

seq 251 > "$tmp/long.ts" && seq 250 > "$tmp/short.ts" && seq 400 > "$tmp/long.md"
for f in long.ts short.ts long.md; do
  expect=quiet; [ "$f" = long.ts ] && expect=speaks
  said "$expect" line_ceiling.py "$(/usr/bin/jq -nc --arg p "$tmp/$f" '{tool_input:{file_path:$p}}')"
done
