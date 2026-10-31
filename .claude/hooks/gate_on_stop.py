#!/usr/bin/env python3
"""Stop and SubagentStop hook: a session, or a subagent, can't finish while the gate fails.

It judges the checkout the stop came from: the git top-level of the payload's `cwd` (so a
builder in .claude/worktrees/ is judged on its own worktree), else of CLAUDE_PROJECT_DIR, else of
the folder it runs in; one with no git or no package.json has no gate, so it says nothing. While
the watched paths there have uncommitted changes, it runs `npm run verify` there (package.json's
verify script: the install check, tests, typecheck, the recorded-payload check, the tests-kept
check, the spec-ID check and the hook checks); on failure, it blocks the stop and hands Claude the end of the output.
Respects `stop_hook_active`, so it blocks once and never loops. If git status fails, the gate's
program can't start or times out, an override (below) can't be read, or the payload can't be read
(hook_payload.py), it exits 1 with one line on stderr saying what failed: Claude Code shows it,
but the stop goes ahead (it fails open, never quietly). A subagent's `cwd` is the folder it works
in: an agent spawned with its own worktree has that worktree, but one that only names a worktree
by absolute path has the main checkout (checked 20 Oct 2026 in subagent transcripts). A subagent
stopping in the main checkout isn't gated: the session's own Stop gates it, and a builder or a
reviewer there would otherwise be held up by changes that aren't its own.
DRAFT_GATE_CMD overrides the command and DRAFT_GATE_TIMEOUT its timeout in seconds, both for
.claude/hooks/tests/gate_on_stop.sh.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import sys
from pathlib import Path

from hook_payload import BadPayload, field, project_dir, read_payload, report

PACKAGE = "package.json"  # a checkout without one has no gate
# what `npm run verify` checks: it changes with verify's scope (a new vitest project, say)
WATCHED = ("convex", "src", "scripts", "tests", PACKAGE, "package-lock.json", "tsconfig.json", "vite.config.ts",
           "vitest.config.ts", "playwright.config.ts", ".claude", "index.html", "docs/design")
TAIL_LINES = 40
GATE = "npm run verify"
GATE_TIMEOUT_SECONDS = 420  # inside settings.json's hook timeout; .claude/hooks/tests/settings.sh checks the pair
UNGATED = "the stop goes ahead ungated"  # what follows a gate that couldn't run


def checkout_of(cwd):
    """The top-level of the checkout the stop came from, None if it has no gate to run."""
    proc = subprocess.run(
        ["git", "-C", project_dir(cwd), "rev-parse", "--show-toplevel"], capture_output=True, text=True
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


def gate_command():
    """DRAFT_GATE_CMD split into words where set, else GATE's; ValueError says what it was."""
    name = "DRAFT_GATE_CMD"
    value = os.environ.get(name)
    try:
        return shlex.split(value or GATE)
    except ValueError as error:
        raise ValueError(f"{name} is {value!r}, which doesn't split into words ({error})") from None


def gate_timeout():
    """DRAFT_GATE_TIMEOUT in seconds where set, else GATE_TIMEOUT_SECONDS; ValueError says what it was."""
    name = "DRAFT_GATE_TIMEOUT"
    value = os.environ.get(name)
    try:
        return float(value) if value else GATE_TIMEOUT_SECONDS
    except ValueError:
        raise ValueError(f"{name} is {value!r}, not a number of seconds") from None


def failure(error, checkout):
    """One line for a git call that failed, a program that couldn't start or a gate that ran past its
    timeout, where Python would print a 20-line traceback."""
    if isinstance(error, OSError):
        return f"{error.filename or 'a program'} couldn't start in {checkout} ({error.strerror})"
    command = shlex.join(error.cmd)
    if isinstance(error, subprocess.TimeoutExpired):
        return f"the gate ({command}) ran past its {error.timeout:g}-second timeout in {checkout}"
    said = (error.stderr or "").strip().splitlines()
    return f"{command} failed in {checkout} (exit {error.returncode}{': ' + said[0] if said else ''})"


def main():
    try:
        payload = read_payload()
        active = field(payload, "stop_hook_active", bool, False)
        cwd = field(payload, "cwd", str, "")
        event = field(payload, "hook_event_name", str, "")
    except BadPayload as error:
        return report(error, "the gate didn't run")
    if active:
        return 0
    checkout = checkout_of(cwd)
    if checkout is None:
        return 0
    try:
        if event == "SubagentStop" and is_main_checkout(checkout):
            return 0
        if not changed(checkout):
            return 0
        proc = subprocess.run(gate_command(), cwd=checkout, capture_output=True, text=True, timeout=gate_timeout())
    except ValueError as error:
        return report(error, UNGATED)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as error:
        return report(failure(error, checkout), UNGATED)
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
