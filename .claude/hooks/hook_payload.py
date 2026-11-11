"""Reads a hook's payload: the JSON object Claude Code writes on stdin. Anything else (nothing,
text that isn't JSON, a JSON list or string) raises BadPayload saying what came. What a hook does
with it depends on what the hook is for:
- a guard (guard_bash.py, guard_github.py, guard_mode.py, guard_sessions.py) runs through
  run_guard(), which denies the call when the payload can't be read or the guard crashes: allowing
  it would check nothing, and Claude Code lets a PreToolUse hook's exit 1 through;
- a note (line_ceiling.py, last_prompt.py) and guard_ask.py, whose blocking would stop every
  question to Craig, report() it instead: the hook exits 1 with it on stderr, which Claude Code
  shows, where a payload read as {} would have checked nothing and said nothing.
project_dir() is the folder every hook falls back to. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import os
import sys


class BadPayload(Exception):
    """The payload isn't what Claude Code sends; the message says what it was."""


def read_payload():
    raw = sys.stdin.read()
    if not raw.strip():
        raise BadPayload("the hook payload is empty")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise BadPayload(f"the hook payload isn't JSON ({error})") from error
    if not isinstance(payload, dict):
        raise BadPayload(f"the hook payload is JSON but not an object (a Python {type(payload).__name__})")
    return payload


def field(payload, key, kind, default):
    """payload[key] if it is a kind, default where it is missing or null; BadPayload otherwise."""
    value = payload.get(key)
    if value is None:
        return default
    if not isinstance(value, kind):
        raise BadPayload(f"the hook payload's {key} is {type(value).__name__} where {kind.__name__} was expected")
    return value


def project_dir(cwd=""):
    """The folder a hook judges: cwd (the payload's, where it has one), else CLAUDE_PROJECT_DIR, else
    the folder the hook runs in."""
    return cwd or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()


def report(error, consequence):
    """Says on stderr, in one line, why the hook running couldn't do its job (an unreadable payload,
    or whatever kept the hook from running); returns the exit code for it."""
    print(f"{os.path.basename(sys.argv[0])}: {error}, so {consequence}.", file=sys.stderr)
    return 1


def deny(reason):
    """Prints a PreToolUse denial with this reason."""
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }}))


def run_guard(name, decide):
    """Runs a guard: decide(payload) returns (reason, advice), a deny reason or None and a note for an
    allowed call or None. A payload it can't read, or a guard that crashes, is denied, never let
    through unchecked; name says which guard in the reason. Returns the exit code, always 0."""
    advice = None
    try:
        reason, advice = decide(read_payload())
    except BadPayload as error:
        reason = f"The {name} guard couldn't read the call: {error}, so nothing was checked."
    except Exception as error:  # a guard that crashes prints nothing, which would allow
        reason = f"The {name} guard failed ({type(error).__name__}: {error}), so nothing was checked."
    if reason:
        deny(reason)
    elif advice:  # additionalContext reaches Claude; systemMessage shows it to Craig
        print(json.dumps({"systemMessage": advice,
                          "hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": advice}}))
    return 0
