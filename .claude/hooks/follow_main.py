"""After a merge, tidy_after_merge.py moves the main checkout to origin/main when it is detached and
behind: the hooks run from its .claude/hooks/, so a merged hook fix waited until someone moved it by
hand (31 Oct 2026: still at #767 after #777 merged). git checkout --detach keeps a changed file the
move doesn't touch, and refuses over one it would overwrite; that refusal is said, as is a commit of
its own or a rebase or bisect under way keeping it there. On a branch it is left alone. Stdlib only,
Python 3.9+.
"""

from __future__ import annotations

import os

from main_writes import MAIN
from tidy_branch import REMOTE, run, worktrees

REMOTE_MAIN = f"{REMOTE}/{MAIN}"  # where the main checkout is moved to
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
    stays = f"{checkout} stays off {REMOTE_MAIN}, so merged hook fixes don't take effect yet"
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
    ok, said = run(path, "git", "checkout", "--quiet", "--detach", REMOTE_MAIN)
    if not ok:
        return f"{stays}: git checkout --detach {REMOTE_MAIN} failed ({said})."
    return f"{checkout} moved {behind} commit(s) on to {REMOTE_MAIN}, so merged hook fixes take effect."
