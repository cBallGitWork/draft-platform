#!/bin/bash
# context_size.py's checks: it says nothing under the first step, says the note once at each step a
# session's newest assistant turn reaches (input + cache-read + cache-creation tokens), never twice
# for the same step, and says nothing where the transcript is missing; a payload that isn't JSON
# is one line on stderr.
. "$(dirname "$0")/helpers.sh"

transcript() { # file tokens: a transcript whose newest assistant turn read that many tokens
  printf '%s\n' '{"type":"assistant","message":{"usage":{"input_tokens":1,"cache_read_input_tokens":999999,"cache_creation_input_tokens":0}}}' \
    "{\"type\":\"assistant\",\"message\":{\"usage\":{\"input_tokens\":5,\"cache_read_input_tokens\":$2,\"cache_creation_input_tokens\":5}}}" \
    '{"type":"user","message":{"content":"hi"}}' > "$1"
}
payload() { printf '{"session_id":"%s","transcript_path":"%s"}' "$1" "$2"; }
session=ctx-$$-$RANDOM

transcript "$tmp/t.jsonl" 160000
silent context_size.py "$(payload "$session" "$tmp/t.jsonl")"  # 160k, under the first step
transcript "$tmp/t.jsonl" 320000
says "about 320k tokens" context_size.py "$(payload "$session" "$tmp/t.jsonl")"
silent context_size.py "$(payload "$session" "$tmp/t.jsonl")"  # the same step isn't said again
transcript "$tmp/t.jsonl" 520000
says "about 520k tokens" context_size.py "$(payload "$session" "$tmp/t.jsonl")"
transcript "$tmp/t.jsonl" 900000
silent context_size.py "$(payload "$session" "$tmp/t.jsonl")"  # past the last step, already said
silent context_size.py "$(payload "$session-other" "$tmp/missing.jsonl")"
silent context_size.py '{}'
fails_loudly "the hook payload isn't JSON" context_size.py 'nope'
