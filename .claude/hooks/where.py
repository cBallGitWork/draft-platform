"""Where a Bash command's git calls run, for guard_bash.py: the shell's cwd, moved by any cd
before them (a subshell's cd stays in the subshell), then by git's -C. None wherever the guard
can't be sure, so it refuses rather than guessing. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os
import re
import subprocess

GIT_VALUE_OPTS = {"-C", "-c", "--git-dir", "--work-tree", "--namespace"}
UNFOLLOWABLE = re.compile(r"[$`]|^-")  # a cd or -C the guard can't follow: a variable, an option, cd -


def located(segs, cwd):
    """(words, folder) for each simple command, following any cd before it; folder is None
    where the guard can't be sure (a cd it can't follow, a missing folder, pushd or popd).
    A worktree is a folder of its own, so its branch and staged lines are read there."""
    here, out, outer = cwd, [], []
    for words in segs:
        if words == ["("]:
            outer.append(here)
        elif words == [")"]:
            here = outer.pop() if outer else None
        elif words[0] in {"pushd", "popd"}:
            here = None
        elif words[0] == "cd" and here is not None:
            target = words[1] if len(words) > 1 else "~"
            followable = len(words) <= 2 and not UNFOLLOWABLE.search(target)
            here = os.path.join(here, os.path.expanduser(target)) if followable else None
            here = here if here and os.path.isdir(here) else None
        out.append((words, here))
    return out


def git_options(words):
    """git's own options, before the subcommand, as (option, value) pairs."""
    i = 0
    while i < len(words) and re.match(r"^\w+=", words[i]):
        i += 1
    out, i = [], i + 1
    while i < len(words) and words[i].startswith("-"):
        if words[i] in GIT_VALUE_OPTS:
            out.append((words[i], words[i + 1] if i + 1 < len(words) else ""))
            i += 2
        else:
            opt, _, val = words[i].partition("=")
            out.append((opt, val))
            i += 1
    return out


def git_dir(words, here):
    """The folder a git command runs in, None if the guard can't be sure: where the shell is,
    moved by any -C."""
    for opt, val in git_options(words):
        if here is None or opt in {"--git-dir", "--work-tree"}:
            return None
        if opt == "-C":
            here = None if UNFOLLOWABLE.search(val) else os.path.join(here, os.path.expanduser(val))
    return here if here and os.path.isdir(here) else None


def current_branch(folder):
    try:
        return subprocess.run(
            ["git", "-C", folder, "branch", "--show-current"],
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""
