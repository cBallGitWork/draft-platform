#!/usr/bin/env python3
"""Stop hook: a session can't finish while the gate is failing.

When there are uncommitted changes under the watched paths, run `npm run verify`
(tests, typecheck, hook checks); on failure, block the stop and hand Claude the end of
the output. Respects `stop_hook_active`, so it blocks once and never loops.
Adapted from sideband's gate_on_stop.py (17 Oct 2026). DRAFT_GATE_CMD overrides the
command, for test.sh. Stdlib only, Python 3.9+.
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


def changed(project):
    proc = subprocess.run(
        ["git", "status", "--porcelain", "--", *WATCHED],
        cwd=project,
        capture_output=True,
        text=True,
    )
    return proc.returncode == 0 and bool(proc.stdout.strip())


def main():
    raw = sys.stdin.read()
    payload = json.loads(raw) if raw.strip() else {}
    if payload.get("stop_hook_active"):
        return 0
    project = Path(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    if not changed(project):
        return 0
    command = shlex.split(os.environ.get("DRAFT_GATE_CMD") or "npm run verify")
    proc = subprocess.run(command, cwd=project, capture_output=True, text=True, timeout=170)
    if proc.returncode != 0:
        tail = "\n".join((proc.stdout + proc.stderr).strip().splitlines()[-TAIL_LINES:])
        reason = (
            "The gate (npm run verify) fails on uncommitted changes. Fix it before finishing, "
            "or tell Craig exactly why it can't be fixed now:\n" + tail
        )
        print(json.dumps({"decision": "block", "reason": reason}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
