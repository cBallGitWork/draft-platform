#!/usr/bin/env python3
"""SessionStart note: says when a drift pass is due, since the 10-merge trigger was missed every
time by hand (passes ran after 18, 14 and 35 merges: the second repo audit, 22 Oct 2026).

It runs docs/REFACTORING.md's count, the commits on main since the last commit whose message has
a line starting "refactor: drift pass" (each merged pull request is one commit), against
origin/main, falling back to main. At DUE_AFTER or more it prints `drift pass due: N merged since
<sha>`, which Claude Code hands Claude as context; otherwise it says nothing. It never fetches,
so origin/main is as fresh as the last fetch. Main with no drift pass yet counts every commit,
"since the start". A git call that fails exits 1 with one line on stderr: Claude Code shows it,
and the session goes ahead. It judges CLAUDE_PROJECT_DIR, else the folder it runs in.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os
import subprocess
import sys

DUE_AFTER = 10  # docs/REFACTORING.md's "10 merged pull requests since the last drift pass"
MAINS = ("origin/main", "main")  # the first that exists is counted
PASS_MARK = "^refactor: drift pass"  # how a drift pass's pull request title starts


class GitFailed(Exception):
    """A git call failed; the message says which and why."""


def git(folder, *args):
    proc = subprocess.run(["git", "-C", folder, *args], capture_output=True, text=True)
    if proc.returncode != 0:
        said = proc.stderr.strip().splitlines() or [f"exit {proc.returncode}"]
        raise GitFailed(f"git {' '.join(args)} failed in {folder} ({said[0]})")
    return proc.stdout.strip()


def main_ref(folder):
    for ref in MAINS:
        found = subprocess.run(["git", "-C", folder, "rev-parse", "--verify", "-q", f"{ref}^{{commit}}"],
                               capture_output=True)
        if found.returncode == 0:
            return ref
    raise GitFailed(f"neither {' nor '.join(MAINS)} exists in {folder}")


def main():
    folder = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    try:
        ref = main_ref(folder)
        last_pass = git(folder, "log", "-1", "--format=%h", f"--grep={PASS_MARK}", ref)
        merged = int(git(folder, "rev-list", "--count", f"{last_pass}..{ref}" if last_pass else ref))
    except GitFailed as error:
        name = os.path.basename(sys.argv[0])
        print(f"{name}: {error}, so it can't say whether a drift pass is due.", file=sys.stderr)
        return 1
    if merged >= DUE_AFTER:
        print(f"drift pass due: {merged} merged since {last_pass or 'the start'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
