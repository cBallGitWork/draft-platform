"""The drift-pass merge gate, for guard_bash.py (gh pr merge) and guard_github.py
(merge_pull_request): denies a merge once DUE_AFTER or more pull requests have merged since the
last drift pass (drift_due.py's count, in the folder the merge runs in), unless the pull request
being merged is itself a drift pass: its title (pull_request.py) starts "refactor: drift pass".
The session-start note alone was missed (10 passes in 432 merges: the audit, 29 Oct 2026), so past
the trigger it is a refusal. A count or a title it can't read is a denial too, never a silent
pass. It stops the usual routes only: a merge through gh api or the web button doesn't pass
through it.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

from drift_due import DUE_AFTER, PASS_MARK, GitFailed, merged_since_pass
from pull_request import Unread, merges_problem, pull, tool_merge_problem

PASS_TITLE = PASS_MARK.lstrip("^")  # a drift pass's title starts with it
RUN_THE_PASS = ("Run the drift pass first (docs/REFACTORING.md \"The drift pass\"): a refactor/ branch "
                "whose pull request title starts \"refactor: drift pass\"; that one may merge.")


def pr_problem(repo, number, folder):
    """A deny reason if pull request number merges past the drift trigger and isn't a drift pass,
    else None."""
    try:
        merged, last_pass = merged_since_pass(folder)
    except GitFailed as error:
        return f"Can't count the merges since the last drift pass: {error}."
    if merged < DUE_AFTER:
        return None
    since = last_pass or "the start"
    try:
        title = pull(repo, number, folder)["title"]
    except (Unread, KeyError, TypeError) as error:
        return (f"{merged} merged since the last drift pass ({since}), and the guard can't read this "
                f"pull request's title to see if it is one: {error}.")
    if not str(title).startswith(PASS_TITLE):
        return (f"Merges wait for the drift pass: {merged} merged since {since} "
                f"(the trigger is {DUE_AFTER}). " + RUN_THE_PASS)
    return None


def merge_problem(cmds):
    """A deny reason if any of cmds (each (words, folder)) runs gh pr merge past the drift trigger
    on a pull request that isn't a drift pass, else None."""
    return merges_problem(cmds, pr_problem)


def mcp_merge_problem(tool, tool_input, folder):
    """The same, for the GitHub tool's merge_pull_request."""
    return tool_merge_problem(tool, tool_input, folder, pr_problem)
