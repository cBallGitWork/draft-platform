"""The approved-picture check, for guard_bash.py and guard_github.py (#947) and as look-gate.yml's
`look-approved` check. A pull request that changes a screen with an approved picture still carries
ui-verifier's "Approved vs built" section, every difference numbered (pr_body.py), but no difference
holds the merge: layout waits for the UI reskin (Craig, 7 Nov 2026: "we can worry about design
changes later in our ui reskin"). Before that, a layout difference waited for Craig's
`craig-approved` label (5 Nov 2026).

What stays is the merge's own guard, through pull_request.py: a gh pr merge with --admin, or one
whose pull request can't be named, is refused, by gh or the GitHub tool alike.

Run as a script, it is the `look-approved` check the `main` ruleset requires: it reads the pull
request from the event GitHub hands the job, lists any layout differences in the log for the reskin,
and passes. An event it can't read fails it, never a silent pass.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import os
import sys

from pull_request import merges_problem, tool_merge_problem
from pr_body import layout_differences


def _no_wait(repo, number, folder):
    """No pull request waits on its differences from an approved picture."""
    return None


def approval_problem(cmds):
    """A deny reason if any of cmds (each (words, folder)) is a gh pr merge pull_request.py refuses
    (--admin, or no pull request it can name), else None."""
    return merges_problem(cmds, _no_wait)


def mcp_approval_problem(tool, tool_input, folder):
    """The same, for the GitHub tool's merge_pull_request."""
    return tool_merge_problem(tool, tool_input, folder, _no_wait)


def main():
    """The check: the pull request in the event at GITHUB_EVENT_PATH. It passes, listing any layout
    differences; exit 1 only when the event can't be read."""
    try:
        with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as event:
            listed = layout_differences(json.load(event)["pull_request"]["body"] or "")
    except (KeyError, OSError, ValueError, TypeError, AttributeError) as error:
        print(f"Can't read this pull request's body from the event: {error}.", file=sys.stderr)
        return 1
    if listed:
        print(f"{len(listed)} layout difference(s) from the approved picture, left for the UI reskin:")
        print("\n".join(listed))
    else:
        print("No layout difference from an approved picture.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
