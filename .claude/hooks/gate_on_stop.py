#!/usr/bin/env python3
"""Stop and SubagentStop hook: a session, or a subagent, can't finish while the gate fails.

It judges the checkout the stop came from: the git top-level of the payload's `cwd` (so a
builder in .claude/worktrees/ is judged on its own worktree), else of CLAUDE_PROJECT_DIR, else of
the folder it runs in; one with no git or no package.json has no gate, so it says nothing. While
the watched paths there have uncommitted changes, it runs `npm run verify` (tests, typecheck, hook
checks) there; on failure, it blocks the stop and hands Claude the end of the output. Respects
`stop_hook_active`, so it blocks once and never loops. If git status fails or the gate times
out, it exits 1 with the error on stderr: Claude Code shows it, but the stop goes ahead (it fails
open, never quietly). A subagent's `cwd` is the folder it works in: an agent spawned with its own
worktree has that worktree, but one that only names a worktree by absolute path has the main
checkout (checked 20 Oct 2026 in subagent transcripts). A subagent stopping in the main checkout
isn't gated: the session's own Stop gates it, and a builder or a reviewer there would otherwise
be held up by changes that aren't its own.
DRAFT_GATE_CMD overrides the command, for tests/gate_on_stop.sh. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import sys
from pathlib import Path

PACKAGE = "package.json"  # a checkout without one has no gate
WATCHED = ("convex", "src", PACKAGE, "package-lock.json", "vitest.config.ts", ".claude")
TAIL_LINES = 40
GATE = "npm run verify"
GATE_TIMEOUT_SECONDS = 170  # inside the 180 settings.json gives the hook


def checkout_of(payload):
    """The top-level of the checkout the stop came from, None if it has no gate to run."""
    folder = payload.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    proc = subprocess.run(
        ["git", "-C", folder, "rev-parse", "--show-toplevel"], capture_output=True, text=True
    )
    top = Path(proc.stdout.strip()) if proc.returncode == 0 else None
    return top if top and (top / PACKAGE).is_file() else None


def is_main_checkout(checkout):
    """True for the repo's own folder, False for a linked worktree (whose git dir is its own)."""
    proc = subprocess.run(
        ["git", "-C", str(checkout), "rev-parse", "--git-dir", "--git-common-dir"],
        capture_output=True, text=True, check=True,
    )
    git_dir, common_dir = proc.stdout.split("\n")[:2]
    return (checkout / git_dir).resolve() == (checkout / common_dir).resolve()


def changed(checkout):
    proc = subprocess.run(
        ["git", "status", "--porcelain", "--", *WATCHED],
        cwd=checkout,
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
    checkout = checkout_of(payload)
    if checkout is None:
        return 0
    if payload.get("hook_event_name") == "SubagentStop" and is_main_checkout(checkout):
        return 0
    if not changed(checkout):
        return 0
    command = shlex.split(os.environ.get("DRAFT_GATE_CMD") or GATE)
    proc = subprocess.run(
        command, cwd=checkout, capture_output=True, text=True, timeout=GATE_TIMEOUT_SECONDS
    )
    if proc.returncode != 0:
        tail = "\n".join((proc.stdout + proc.stderr).strip().splitlines()[-TAIL_LINES:])
        reason = (
            f"The gate ({GATE}) fails on uncommitted changes in {checkout}. Fix it before "
            "finishing, or tell Craig exactly why it can't be fixed now:\n" + tail
        )
        print(json.dumps({"decision": "block", "reason": reason}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
