#!/usr/bin/env python3
"""PreToolUse guard for file edits: no code before SPEC.md exists.

CLAUDE.md: the product is not defined yet, and the first session is an interview.
Until SPEC.md is at the repo root, only .md files, .claude/ and the root .gitignore
can be written. Once SPEC.md lands this allows everything; delete it when it stops
earning its place. It sees Write/Edit only; a file written through a shell command
never reaches it.

Reads the hook payload (JSON) on stdin; prints a deny decision or nothing.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import os
import sys


def decide(payload, project_dir):
    """A deny reason, or None to allow."""
    root = os.path.realpath(project_dir)
    if os.path.exists(os.path.join(root, "SPEC.md")):
        return None
    tool_input = payload.get("tool_input") or {}
    raw = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
    if not raw:
        return None
    # realpath settles `..` and symlinks (on macOS /tmp is /private/tmp) on both sides
    path = os.path.realpath(os.path.join(root, raw))
    if os.path.commonpath([root, path]) != root:
        return None  # outside this repo: not ours to police
    rel = os.path.relpath(path, root)
    if rel.endswith(".md") or rel.startswith(".claude" + os.sep) or rel == ".gitignore":
        return None
    return (
        "There is no SPEC.md yet, so no code or config: the product is not defined "
        "(CLAUDE.md). Ask Craig to run /grill first; until then only .md files, "
        f".claude/ and .gitignore can be written. Blocked: {rel}"
    )


def main():
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        return
    reason = decide(payload, os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}))


if __name__ == "__main__":
    main()
