#!/bin/bash
# line_ceiling.py's checks: a note past 250 lines and a sterner one past 300, none at or under 250,
# none for prose, and the note for every kind of code file it names.
. "$(dirname "$0")/helpers.sh"

edited() { "$jq" -nc --arg p "$tmp/$1" '{tool_input:{file_path:$p}}'; }  # file: a Write or Edit of it
seq 251 > "$tmp/long.ts" && seq 250 > "$tmp/short.ts" && seq 301 > "$tmp/past.ts" && seq 400 > "$tmp/long.md"
says "closing on the 300-line ceiling" line_ceiling.py "$(edited long.ts)"
says "past the 300-line ceiling" line_ceiling.py "$(edited past.ts)"
silent line_ceiling.py "$(edited short.ts)"
silent line_ceiling.py "$(edited long.md)"
for suffix in tsx js mjs css py sh; do  # .sh: a shell script is code too, these suites among them
  seq 251 > "$tmp/long.$suffix" && says "closing on" line_ceiling.py "$(edited "long.$suffix")"
done
