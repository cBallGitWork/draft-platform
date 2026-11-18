#!/bin/bash
# words_voice.py's checks: a note on a manager's words file, in src or convex, and none for any other file.
. "$(dirname "$0")/helpers.sh"

edited() { "$jq" -nc --arg p "$tmp/$1" '{tool_input:{file_path:$p}}'; }  # file: a Write or Edit of it
says "src/home/words.ts is shown to managers" words_voice.py "$(edited src/home/words.ts)"
says "matchday-voice.md" words_voice.py "$(edited convex/mail/letterWords.ts)"
silent words_voice.py "$(edited src/home/HomePage.tsx)"
silent words_voice.py "$(edited convex/mail/letters.ts)"
silent words_voice.py "$(edited tests/src/home/words.ts)"
# a payload it can't read is said on stderr, never taken for "no file"
for ((i = 0; i < ${#bad_payloads[@]}; i += 2)); do
  fails_loudly "${bad_payloads[i + 1]}" words_voice.py "${bad_payloads[i]}"
done
silent words_voice.py '{"tool_input":null}'  # no file named: nothing to point at
