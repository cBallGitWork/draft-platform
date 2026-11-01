#!/usr/bin/env python3
"""PostToolUse note for Bash: after gh pr merge, removes the merged pull request's local branch and
the worktree it is checked out in. GitHub deletes the branch on its side (the repo's "delete
branch on merge"), but nothing deleted the copy here, so 842 branches and 70 worktrees piled up
(30 Oct 2026). What is safe to remove, and what stays, is tidy_branch.py's.

Then it moves the main checkout to origin/main when it is detached and behind (follow_main.py).

Last, it sweeps earlier leftovers (#933): a worktree kept as in use (#929) stays after its builder
finishes, so each merge also looks, in one gh pr list, for worktrees whose branch belongs to one
of the last MERGED_LOOKBACK merged pull requests, and tidies each by the same rules. A locked one is
passed over without a word: a builder is running in it. It starts a leftover only while that
leftover's worst case fits in the time settings.json gives the hook, and says how many it left
for a later merge.

It runs after the command, so it never blocks one. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import sys
import time

from commands import commands
from drift_gate import merge_args, view_args
from follow_main import follow_main
from hook_payload import BadPayload, field, project_dir, read_payload, report
from parsing import Unbalanced, Unreadable
from stdin_reading import UnreadableStdin
from tidy_branch import RUN_TIMEOUT_SECONDS, TIDY_CALLS, inside, run, tidy, worktrees

STARTED = time.monotonic()  # the hook's time runs from here
MERGED = "MERGED"
# the hook's timeout in settings.json. Before the sweep, each merge takes at most 1 + TIDY_CALLS
# calls and the main checkout's move four, each up to RUN_TIMEOUT_SECONDS (165 s for one merge), so
# the sweep looks only while it has time left for its two lists and one leftover, and starts a
# leftover only while its worst case fits
HOOK_SECONDS = 180
# how many merged pull requests, newest first, the sweep matches worktrees against: some three
# nights of merges at the overnight pace (64 in a night, 22 Oct 2026); gh lists 200 in about a second
MERGED_LOOKBACK = 200
NOT_SWEPT = "Earlier merged branches weren't tidied"


def pull_request(args, folder):
    """The merged pull request's number, state, branch and head commit; ValueError says why not."""
    ok, out = run(folder, "gh", "pr", "view", *view_args(args), "--json", "number,state,headRefName,headRefOid")
    if not ok:
        raise ValueError(f"gh pr view failed ({out})")
    try:
        pr = json.loads(out)
        return pr["number"], pr["state"], pr["headRefName"], pr["headRefOid"]
    except (ValueError, KeyError, TypeError) as error:
        raise ValueError(f"gh pr view gave no head ({error})") from error


def merged_heads(folder):
    """{branch: (number, head commit)} for the last MERGED_LOOKBACK merged pull requests, the newest
    for a branch name used twice; ValueError says why not."""
    ok, out = run(folder, "gh", "pr", "list", "--state", "merged", "--limit", str(MERGED_LOOKBACK),
                  "--json", "number,headRefName,headRefOid")
    if not ok:
        raise ValueError(f"gh pr list failed ({out})")
    found = {}
    try:
        for pr in json.loads(out):  # newest first
            found.setdefault(pr["headRefName"], (pr["number"], pr["headRefOid"]))
    except (ValueError, KeyError, TypeError) as error:
        raise ValueError(f"gh pr list gave no heads ({error})") from error
    return found


def has_time(calls, deadline):
    """Whether calls more, each at its worst, end before the deadline (a time.monotonic() value)."""
    return time.monotonic() + calls * RUN_TIMEOUT_SECONDS <= deadline


def sweep(folder, done, deadline):
    """Tidies each unlocked worktree, other than the main checkout and the folder the merge ran in,
    whose branch a merged pull request had and isn't in done (tidied already), while time is left
    before the deadline; the lines saying what happened."""
    if not has_time(2 + TIDY_CALLS, deadline):  # gh pr list, git worktree list, then one leftover
        return [f"{NOT_SWEPT}: the hook's time ran short before it could look."]
    try:
        merged = merged_heads(folder)
        leftovers = [
            branch for i, (path, branch, locked) in enumerate(worktrees(folder))
            if i and branch in merged and branch not in done and not locked and not inside(path, folder)
        ]
    except ValueError as error:
        return [f"{NOT_SWEPT}: {error}."]
    lines = []
    for n, branch in enumerate(leftovers):
        if not has_time(TIDY_CALLS, deadline):
            lines.append(f"{len(leftovers) - n} earlier merged branch(es) wait for a later merge: the hook's time ran short.")
            break
        number, head = merged[branch]
        lines.append(tidy(number, branch, head, folder))
    return lines


def notes(cmd, cwd, deadline):
    lines, merged_in, done = [], None, set()
    try:
        cmds = commands(cmd, cwd)
    except (Unbalanced, Unreadable, UnreadableStdin):
        return lines  # guard_bash.py refuses what it can't read, so this ran no merge it could see
    for words, here in cmds:
        args = merge_args(words)
        if args is None:
            continue
        if here is None:
            lines.append("A pull request merged, but in a folder the hook can't be sure of: its branch was kept.")
            continue
        try:
            number, state, branch, head = pull_request(args, here)
            if state != MERGED:
                lines.append(f"#{number} isn't merged yet ({state}): its branch stays.")
            else:
                merged_in = here
                done.add(branch)
                lines.append(tidy(number, branch, head, here))
        except ValueError as error:
            lines.append(f"After the merge, the branch wasn't tidied: {error}.")
    if merged_in is not None:
        try:
            lines.append(follow_main(merged_in))
        except ValueError as error:
            lines.append(f"After the merge, the main checkout wasn't moved: {error}.")
        lines += sweep(merged_in, done, deadline)
    return [line for line in lines if line]


def main():
    try:
        payload = read_payload()
        cmd = field(field(payload, "tool_input", dict, {}), "command", str, "")
        cwd = project_dir(field(payload, "cwd", str, ""))
    except BadPayload as error:
        return report(error, "no merged branch was tidied")
    said = notes(cmd, cwd, STARTED + HOOK_SECONDS)
    if said:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": " ".join(said)}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
