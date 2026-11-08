"""Running a command for a hook and saying why it failed: one call's time limit, its exit code and
output, and a failure's first line, shared by the hooks that run git, gh or lsof for a verdict
(#1013). Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import subprocess

# each git, gh or lsof call's limit: a hook's time is counted in these
RUN_TIMEOUT_SECONDS = 11


def failure_line(done):
    """A failed command's first stderr line, or its exit code when it said nothing."""
    said = done.stderr.strip().splitlines() or [f"exit {done.returncode}"]
    return said[0]


def call(folder, *args, timeout=RUN_TIMEOUT_SECONDS):
    """(exit code, output) for a command run in folder; output is stderr's first line when it fails,
    and the code is None when the command couldn't run or ran out of time."""
    try:
        done = subprocess.run(list(args), cwd=folder, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.SubprocessError) as error:
        return None, str(error)
    if done.returncode == 0:
        return 0, done.stdout
    return done.returncode, failure_line(done)


def run(folder, *args):
    """(ok, output) for a command run in folder; output is stderr's first line when it fails."""
    code, out = call(folder, *args)
    return code == 0, out
