"""Reads a hook's payload, for gate_on_stop.py, line_ceiling.py and tidy_after_merge.py: the JSON
object Claude Code writes on stdin. Anything else (nothing, text that isn't JSON, a JSON list or
string) raises BadPayload saying what came, and the hook exits 1 with it on stderr: Claude Code
shows that, where a payload read as {} would have checked nothing and said nothing. guard_bash.py
reads its own, since it denies where these only report. project_dir() is the folder every hook
falls back to. Stdlib only, Python 3.9+.
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
    or whatever kept gate_on_stop.py's gate from running); returns the exit code for it."""
    print(f"{os.path.basename(sys.argv[0])}: {error}, so {consequence}.", file=sys.stderr)
    return 1
