#!/usr/bin/env python3
"""Stop and SubagentStop hook: a session, or a builder subagent, can't finish while the gate fails.

It judges the checkout the stop came from: the git top-level of the payload's `cwd` (a builder's
worktree under .claude/worktrees/, even from a subfolder of it), else of CLAUDE_PROJECT_DIR, else
of the folder it runs in. A folder that isn't a git checkout, or has no package.json, has no gate,
so it says nothing. When there are uncommitted changes under the watched paths there, it runs
`npm run verify` (tests, typecheck, hook checks) there; on failure, it blocks the stop and hands
Claude the end of the output. Respects `stop_hook_active`, so it blocks once and never loops.
Adapted from sideband's gate_on_stop.py (17 Oct 2026). DRAFT_GATE_CMD overrides the command, for
test.sh. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import sys
from pathlib import Path

WATCHED = ("convex", "src", "package.json", "package-lock.json", "vitest.config.ts", ".claude")
TAIL_LINES = 40
GATE = "npm run verify"


def checkout(payload):
    """The top-level of the checkout the stop came from, None if it has no gate to run."""
    folder = payload.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    proc = subprocess.run(
        ["git", "-C", folder, "rev-parse", "--show-toplevel"], capture_output=True, text=True
    )
    top = Path(proc.stdout.strip()) if proc.returncode == 0 else None
    return top if top and (top / "package.json").is_file() else None


def changed(project):
    proc = subprocess.run(
        ["git", "status", "--porcelain", "--", *WATCHED],
        cwd=project,
        capture_output=True,
        text=True,
        check=True,
    )
    return bool(proc.stdout.strip())


def main():
    raw = sys.stdin.read()
    payload = json.loads(raw) if raw.strip() else {}
    if payload.get("stop_hook_active"):
        return 0
    project = checkout(payload)
    if project is None or not changed(project):
        return 0
    command = shlex.split(os.environ.get("DRAFT_GATE_CMD") or GATE)
    proc = subprocess.run(command, cwd=project, capture_output=True, text=True, timeout=170)
    if proc.returncode != 0:
        tail = "\n".join((proc.stdout + proc.stderr).strip().splitlines()[-TAIL_LINES:])
        reason = (
            f"The gate ({GATE}) fails on uncommitted changes in {project}. Fix it before "
            "finishing, or tell Craig exactly why it can't be fixed now:\n" + tail
        )
        print(json.dumps({"decision": "block", "reason": reason}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
