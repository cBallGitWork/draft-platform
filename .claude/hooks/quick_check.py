#!/usr/bin/env python3
"""SessionStart and Stop hook: Claude can't finish a turn while the project's quick checks fail.

The project names its checks in .studio/project.json as "quickCheck" (a shell command, run in the
project folder) and may give "quickCheckSeconds" (default 90). At SessionStart this notes the
commit the session began on. At Stop it runs the checks only when the work has changed: uncommitted
changes, or a commit since the session began. A tree that already passed in this session isn't
checked again, so a turn of pure talk costs nothing. When the checks fail it exits 2 with their
last lines on stderr, which Claude Code hands back to Claude to fix before it finishes; when they
run out of time it says so and lets the turn end. stop_hook_active (Claude is already fixing what a
block said) lets the turn end at once, so it never loops. A project without "quickCheck", or a
folder that isn't a git checkout, is never checked. A payload that isn't JSON exits 1 with one line
on stderr (hook_payload.py). State is kept per session in the temp folder. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from hook_payload import BadPayload, field, project_dir, read_payload, report
from run_command import call

SETTINGS = Path(".studio") / "project.json"
DEFAULT_SECONDS = 90
TAIL_LINES = 40  # of a failing check's output, handed back to Claude
STATE_DIR = Path(tempfile.gettempdir()) / "claude-quick-check"  # one file per session id
BLOCKED = 2  # Claude Code's exit code for "don't stop yet": stderr goes back to Claude


def settings(project):
    """(command, seconds) from the project's .studio/project.json, or (None, 0) without one."""
    try:
        data = json.loads((Path(project) / SETTINGS).read_text())
    except (OSError, ValueError):
        return None, 0
    command = data.get("quickCheck") if isinstance(data, dict) else None
    if not isinstance(command, str) or not command.strip():
        return None, 0
    seconds = data.get("quickCheckSeconds", DEFAULT_SECONDS)
    return command, seconds if isinstance(seconds, int) and seconds > 0 else DEFAULT_SECONDS


def git(project, *args):
    code, out = call(project, "git", *args)
    return out if code == 0 else None


def fingerprint(project):
    """What the work is now: the commit, the diff against it and the untracked files' sizes and
    times. None when the folder isn't a git checkout."""
    head = git(project, "rev-parse", "HEAD")
    if head is None:
        return None
    digest = hashlib.sha256(head.encode())
    digest.update((git(project, "diff", "HEAD", "--binary") or "").encode())
    for name in (git(project, "ls-files", "--others", "--exclude-standard", "-z") or "").split("\0"):
        try:
            stat = (Path(project) / name).stat() if name else None
        except OSError:
            stat = None
        if stat:
            digest.update(f"{name}:{stat.st_size}:{stat.st_mtime_ns}".encode())
    return digest.hexdigest()


def state_file(session):
    return STATE_DIR / ("".join(c for c in session if c.isalnum() or c in "-_") or "no-session")


def load(session):
    try:
        state = json.loads(state_file(session).read_text())
    except (OSError, ValueError):
        return {}
    return state if isinstance(state, dict) else {}


def save(session, state):
    try:
        STATE_DIR.mkdir(exist_ok=True)
        state_file(session).write_text(json.dumps(state))
    except OSError:
        pass  # worst case the checks run again next turn


def changed(project, start):
    """Whether the work changed this session: uncommitted changes, or a commit since start."""
    status = git(project, "status", "--porcelain")
    if status is None:
        return False
    return bool(status.strip()) or (start is not None and git(project, "rev-parse", "HEAD") != start)


def run_checks(project, command, seconds):
    """(passed, output); passed is None when the checks ran out of time or couldn't start."""
    try:
        done = subprocess.run(command, shell=True, cwd=project, capture_output=True, text=True, timeout=seconds)
    except subprocess.TimeoutExpired:
        return None, f"ran past {seconds} seconds"
    except OSError as error:
        return None, f"couldn't start ({error})"
    return done.returncode == 0, done.stdout + done.stderr


def on_stop(project, session, state):
    command, seconds = settings(project)
    if command is None:
        return 0
    if "start" not in state:  # the session began before this hook was on: judge from now
        state["start"] = git(project, "rev-parse", "HEAD")
    now = fingerprint(project)
    if now is None or not changed(project, state["start"]) or state.get("passed") == now:
        save(session, state)
        return 0
    passed, output = run_checks(project, command, seconds)
    if passed is None:
        note = f"Quick checks ({command}) {output}, so they didn't judge this turn. Run them before saying it's done."
        print(json.dumps({"systemMessage": note}))
        return 0
    if passed:
        state["passed"] = now
        save(session, state)
        return 0
    save(session, state)
    tail = "\n".join(output.strip().splitlines()[-TAIL_LINES:])
    print(f"The quick checks fail ({command}). Fix them before finishing, or say exactly why they can't be "
          f"fixed now:\n{tail}", file=sys.stderr)
    return BLOCKED


def main():
    try:
        payload = read_payload()
        event = field(payload, "hook_event_name", str, "Stop")
        session = field(payload, "session_id", str, "")
        active = field(payload, "stop_hook_active", bool, False)
        folder = project_dir(field(payload, "cwd", str, ""))
    except BadPayload as error:
        return report(error, "the quick checks didn't run")
    if active:
        return 0
    project = (git(folder, "rev-parse", "--show-toplevel") or folder).strip()  # cwd may be a subfolder
    state = load(session)
    if event == "SessionStart":
        state = {"start": git(project, "rev-parse", "HEAD")}
        save(session, state)
        return 0
    return on_stop(project, session, state)


if __name__ == "__main__":
    sys.exit(main())
