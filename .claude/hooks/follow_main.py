"""After a merge, tidy_after_merge.py moves the main checkout to origin/main when it is detached and
behind: the hooks run from its .claude/hooks/, so a merged hook fix waited until someone moved it by
hand (31 Oct 2026: still at #767 after #777 merged). git checkout --detach keeps a changed file the
move doesn't touch, and refuses over one it would overwrite; that refusal is said, naming each file
in the way, as is a commit of its own or a rebase or bisect under way keeping it there. Each such
line starts NOT_MOVED, which tidy_after_merge.py also shows Craig: a checkout left behind runs old
hooks until someone notices. On a branch it is left alone. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os
import subprocess

from main_writes import MAIN
from tidy_branch import REMOTE, RUN_TIMEOUT_SECONDS, run, worktrees

REMOTE_MAIN = f"{REMOTE}/{MAIN}"  # where the main checkout is moved to
NOT_MOVED = "MAIN CHECKOUT NOT MOVED:"  # starts each line saying it stays behind
BLOCKING_FILE = "\t"  # git checkout's refusal lists each file in its way on a line of its own, tab first
# the most calls follow_main() makes: worktree list, fetch, rev-list, checkout
MAIN_MOVE_CALLS = 4
# what git keeps in .git/ while a rebase, merge, cherry-pick, revert or bisect is under way (a
# rebase or bisect leaves HEAD detached), when moving the checkout would wreck it
UNDER_WAY = ("rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "BISECT_LOG")


def follow_main(folder):
    """Moves the main checkout to origin/main when it is detached and behind it; a line saying what
    happened, or None when it is on a branch or already there."""
    path, branch, _ = worktrees(folder)[0]
    if branch != "":
        return None
    checkout = f"The main checkout ({path})"
    stays = f"{NOT_MOVED} {checkout} stays off {REMOTE_MAIN}, so merged hook fixes don't take effect yet"
    under_way = [mark for mark in UNDER_WAY if os.path.exists(os.path.join(path, ".git", mark))]
    if under_way:
        return f"{stays}: a git operation is under way there ({', '.join(under_way)})."
    ok, said = run(path, "git", "fetch", "--quiet", "--no-write-fetch-head", REMOTE, MAIN)
    if not ok:
        return f"{stays}: git fetch failed ({said})."
    ok, counts = run(path, "git", "rev-list", "--count", "--left-right", f"HEAD...{REMOTE_MAIN}")
    if not ok:
        return f"{stays}: git rev-list failed ({counts})."
    ahead, behind = (int(n) for n in counts.split())
    if ahead:
        return f"{stays}: it holds {ahead} commit(s) {REMOTE_MAIN} doesn't."
    if not behind:
        return None
    move = ("git", "checkout", "--quiet", "--detach", REMOTE_MAIN)
    try:
        done = subprocess.run(move, cwd=path, capture_output=True, text=True, timeout=RUN_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError) as error:
        return f"{stays}: {' '.join(move)} couldn't run ({error})."
    if done.returncode != 0:
        blocking = [line.strip() for line in done.stderr.splitlines() if line.startswith(BLOCKING_FILE)]
        if blocking:
            return (f"{stays}: git refused to move it over changed file(s) there: {', '.join(blocking)}. "
                    f"Commit, move or undo them, then run git -C {path} checkout --detach {REMOTE_MAIN}.")
        said = done.stderr.strip().splitlines() or [f"exit {done.returncode}"]
        return f"{stays}: {' '.join(move)} failed ({said[0]})."
    return f"{checkout} moved {behind} commit(s) on to {REMOTE_MAIN}, so merged hook fixes take effect."
