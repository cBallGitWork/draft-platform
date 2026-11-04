#!/usr/bin/env python3
"""UserPromptSubmit hook: says when a session's context has grown big, since every turn re-reads all
of it and that, not the answers, was nearly all of a week's Opus spend (3 Nov 2026, summed from the
usage lines of this project's transcripts in ~/.claude/projects: 5.5 billion tokens read from cache
by Opus against 27 million written, sessions of 1,000+ turns peaking at 500-860k tokens each).

It reads the newest assistant turn's usage from the payload's transcript_path (only the file's
tail) and adds it up: input, cache-read and cache-creation tokens are the context that turn read.
Each time that crosses the next of STEPS it prints a note, which Claude Code hands Claude as context
and shows Craig, telling him to wrap up and clear or start a fresh session; the step reached is kept
in a file named for the session, so a step is said once, not on every prompt. A missing or
unreadable transcript, or no usage in its tail, says nothing: a note that can't be judged is not
worth stopping a prompt for. A payload that isn't JSON exits 1 with one line on stderr (hook_payload.py).
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

from hook_payload import BadPayload, field, read_payload, report

STEPS = (300_000, 500_000)  # context tokens at which the note is said, once each
TAIL_BYTES = 400_000  # the end of the transcript read: far more than the last assistant turn
USAGE_FIELDS = ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
STATE_DIR = Path(tempfile.gettempdir()) / "draft-context-size"


def context_tokens(transcript):
    """The context the newest assistant turn in the transcript's tail read, or 0 if it has none."""
    try:
        with open(transcript, "rb") as handle:
            handle.seek(0, 2)
            handle.seek(max(0, handle.tell() - TAIL_BYTES))
            lines = handle.read().decode("utf-8", errors="ignore").splitlines()
    except OSError:
        return 0
    for line in reversed(lines):
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue  # the first line of a tail is cut mid-way
        if not isinstance(entry, dict):
            continue  # a line that is JSON but not an object holds no turn
        message = entry.get("message")
        usage = message.get("usage") if isinstance(message, dict) else None
        if entry.get("type") == "assistant" and isinstance(usage, dict):
            return sum(int(usage.get(name) or 0) for name in USAGE_FIELDS)
    return 0


def step_reached(tokens):
    return sum(1 for step in STEPS if tokens >= step)


def new_step(session, reached):
    """True, and remembered, when reached is above the step already said for this session."""
    state = STATE_DIR / "".join(c for c in session if c.isalnum() or c in "-_")
    try:
        said = int(state.read_text())
    except (OSError, ValueError):
        said = 0
    if reached <= said:
        return False
    try:
        STATE_DIR.mkdir(exist_ok=True)
        state.write_text(str(reached))
    except OSError:
        pass  # worst case the note is said again next prompt
    return True


def main():
    try:
        payload = read_payload()
        transcript = field(payload, "transcript_path", str, "")
        session = field(payload, "session_id", str, "")
    except BadPayload as error:
        return report(error, "the context size wasn't checked")
    if not transcript or not session:
        return 0
    tokens = context_tokens(transcript)
    reached = step_reached(tokens)
    if reached and new_step(session, reached):
        note = (f"Context size: this session is now about {tokens // 1000}k tokens, and every turn re-reads all of it, "
                "which is what uses up credits. Finish the task in hand, say where things stand in three lines, "
                "then tell Craig to clear the chat or start a fresh session with those lines.")
        print(json.dumps({"systemMessage": note,
                          "hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": note}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
