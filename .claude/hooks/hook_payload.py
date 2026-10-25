"""Reads a hook's payload, for gate_on_stop.py and line_ceiling.py: the JSON object Claude Code
writes on stdin. Anything else (nothing, text that isn't JSON, a JSON list or string) raises
BadPayload saying what came, and the hook exits 1 with it on stderr: Claude Code shows that,
where a payload read as {} would have checked nothing and said nothing. guard_bash.py reads its
own, since it denies where these two only report; all three take the project's folder from
project_dir(). Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import os
import sys


class BadPayload(Exception):
    """The payload isn't what Claude Code sends; the message says what it was."""


def project_dir():
    """The project's folder: CLAUDE_PROJECT_DIR, else the folder the hook runs in."""
    return os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()


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


def report(error, consequence):
    """Says on stderr, in one line, why the hook running couldn't do its job (an unreadable payload,
    or gate_on_stop.py's failed git call or timeout); returns the exit code for it."""
    print(f"{os.path.basename(sys.argv[0])}: {error}, so {consequence}.", file=sys.stderr)
    return 1
