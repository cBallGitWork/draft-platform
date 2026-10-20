#!/bin/bash
# line_ceiling.py's checks: a note past 250 lines, none at or under it, none for prose.
. "$(dirname "$0")/helpers.sh"

edited() { "$jq" -nc --arg p "$tmp/$1" '{tool_input:{file_path:$p}}'; }  # file: a Write or Edit of it
seq 251 > "$tmp/long.ts" && seq 250 > "$tmp/short.ts" && seq 400 > "$tmp/long.md" && seq 251 > "$tmp/long.sh"
said speaks line_ceiling.py "$(edited long.ts)"
said quiet line_ceiling.py "$(edited short.ts)"
said quiet line_ceiling.py "$(edited long.md)"
said speaks line_ceiling.py "$(edited long.sh)"  # a shell script is code too, these suites among them
