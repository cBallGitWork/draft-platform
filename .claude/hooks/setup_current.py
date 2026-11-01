#!/usr/bin/env python3
"""SessionStart note, beside drift_due.py: says loudly when this checkout's setup (.claude/ and
CLAUDE.md) differs from origin/main, so a session can see whether the agents, skills, hooks and
rules it loaded are the merged ones. Claude Code reads them once, at the start, from the checkout
it opens in: a worktree cut before a fix merged runs the old reviewer, and a pulled fix only takes
effect in a session started after it (the design-setup audit, 1 Nov 2026).

`git diff --quiet HEAD origin/main -- .claude CLAUDE.md` decides. When it finds a difference it
prints one line, to Claude and to Craig: the agents and skills that differ by name, how many
other files, and "restart after updating". A branch that changes the setup itself gets the line
too, saying it is only the branch's own change. It never fetches, so origin/main is as fresh as
the last fetch. A git call that fails exits 1 with one line on stderr: Claude Code shows it, and
the session goes ahead. It judges CLAUDE_PROJECT_DIR, else the folder it runs in. Stdlib only,
Python 3.9+.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

from drift_due import GitFailed
from hook_payload import project_dir
from main_writes import REMOTE_MAIN
from tidy_branch import failure_line

SETUP = (".claude", "CLAUDE.md")  # what Claude Code loads at a session's start
AGENTS, SKILLS = ".claude/agents/", ".claude/skills/"
DIFFERS = 1  # git diff --quiet's exit when the trees differ


def git(folder, *args):
    """(exit code, stdout) of a git call; GitFailed past DIFFERS."""
    proc = subprocess.run(["git", "-C", folder, *args], capture_output=True, text=True)
    if proc.returncode > DIFFERS:
        raise GitFailed(f"git {' '.join(args)} failed in {folder} ({failure_line(proc)})")
    return proc.returncode, proc.stdout


def differing(folder):
    """The setup files that differ between HEAD and REMOTE_MAIN, [] when none do. Raises GitFailed."""
    code, _ = git(folder, "diff", "--quiet", "HEAD", REMOTE_MAIN, "--", *SETUP)
    if code != DIFFERS:
        return []
    _, out = git(folder, "diff", "--name-only", "HEAD", REMOTE_MAIN, "--", *SETUP)
    return out.split()


def names(paths, prefix):
    """The agent or skill each path under prefix belongs to, sorted, once each."""
    return sorted({path[len(prefix):].split("/")[0].removesuffix(".md") for path in paths if path.startswith(prefix)})


def merged_since(folder):
    """True if REMOTE_MAIN changed the setup since this branch left it (so the checkout is behind),
    False if only this branch changed it. Raises GitFailed."""
    code, _ = git(folder, "diff", "--quiet", f"HEAD...{REMOTE_MAIN}", "--", *SETUP)
    return code == DIFFERS


def summary(paths, behind):
    """The loud line for these differing paths; behind says whether REMOTE_MAIN moved on."""
    agents, skills = names(paths, AGENTS), names(paths, SKILLS)
    rest = [path for path in paths if not path.startswith((AGENTS, SKILLS))]
    parts = ([f"agents {', '.join(agents)}"] if agents else []) + ([f"skills {', '.join(skills)}"] if skills else [])
    parts += [f"{len(rest)} other file(s) ({', '.join(rest[:3])}{', …' if len(rest) > 3 else ''})"] if rest else []
    why = (f"{REMOTE_MAIN} has changed them since this branch left it, so restart after updating"
           if behind else "only this branch changes them; if it didn't mean to, restart after updating")
    return f"SETUP DIFFERS FROM {REMOTE_MAIN}: this session loaded {'; '.join(parts)} as this checkout has them: {why}."


def main():
    folder = project_dir()
    try:
        paths = differing(folder)
        line = summary(paths, merged_since(folder)) if paths else None
    except GitFailed as error:
        name = os.path.basename(sys.argv[0])
        print(f"{name}: {error}, so it can't say whether this session's setup is the merged one.", file=sys.stderr)
        return 1
    if line:  # additionalContext reaches Claude; systemMessage shows it to Craig
        print(json.dumps({"systemMessage": line,
                          "hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": line}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
