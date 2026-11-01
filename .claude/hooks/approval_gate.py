"""The approved-picture merge gate, for guard_bash.py and guard_github.py (#947). CLAUDE.md: a pull
request that changes a screen with an approved picture shows approved and built, every difference
numbered; "with any, it waits for Craig's yes". pr_body.py makes such a body carry ui-verifier's
"Approved vs built" section; this refuses gh pr merge while that section numbers a difference,
unless the pull request has the label CRAIG_APPROVED, which only Craig adds: a gh command or GitHub
tool call of Claude's that adds it is refused too (in any case: GitHub's label names ignore it). A
body or labels it can't read is a denial, never a silent pass. Like drift_gate.py it stops the
usual route only: a merge through gh api or the web button, a label named by a shell variable, and
a body edited after it opened (gh pr edit, which pr_body.py doesn't screen-check) get past it.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

from drift_gate import merge_args, pr_view
from pr_body import differences
from where import options, runs_at

CRAIG_APPROVED = "craig-approved"  # the label: Craig's yes to the differences listed
# gh's subcommands that can put a label on a pull request or issue, and their options naming one
LABELLING = {("pr", "create"), ("pr", "edit"), ("issue", "create"), ("issue", "edit")}
LABEL_OPTS = {"-l", "--label", "--add-label"}
LABEL_VALUE_OPTS = LABEL_OPTS | {"-t", "--title", "-b", "--body", "-F", "--body-file", "-B", "--base", "-H",
                                 "--head", "-a", "--assignee", "-m", "--milestone", "-p", "--project",
                                 "-r", "--reviewer", "-R", "--repo", "--remove-label", "--add-assignee",
                                 "--remove-assignee", "--add-project", "--remove-project", "--add-reviewer",
                                 "--remove-reviewer", "-T", "--template", "--recover"}
ONLY_CRAIG = (f"Only Craig adds the {CRAIG_APPROVED} label: it is his yes to a screen's differences from its "
              "approved picture. Ask him in chat, with the numbered differences.")


def _labels_added(args):
    """The labels these gh pr/issue create or edit args add, in lower case."""
    out, i = [], 0
    while i < len(args):
        found, i = options(args, i, LABEL_VALUE_OPTS)
        out += [name.strip() for opt, value in found if opt in LABEL_OPTS for name in value.lower().split(",")]
        i += 1
    return out


def label_problem(cmds):
    """A deny reason if any of cmds adds the CRAIG_APPROVED label (gh pr edit --add-label, gh pr
    create --label, or any gh api call naming it), else None."""
    for words, _ in cmds:
        i = runs_at(words, "gh")
        if i is None:
            continue
        if words[i + 1 : i + 2] == ["api"] and any(CRAIG_APPROVED in word.lower() for word in words[i + 2 :]):
            return ONLY_CRAIG
        if tuple(words[i + 1 : i + 3]) in LABELLING and CRAIG_APPROVED in _labels_added(words[i + 3 :]):
            return ONLY_CRAIG
    return None


def mcp_label_problem(tool_input):
    """A deny reason if a GitHub tool's input sets the CRAIG_APPROVED label, else None."""
    labels = tool_input.get("labels") if isinstance(tool_input, dict) else None
    if isinstance(labels, str):
        labels = [labels]
    if isinstance(labels, list) and any(isinstance(label, str) and label.strip().lower() == CRAIG_APPROVED
                                        for label in labels):
        return ONLY_CRAIG
    return None


def approval_problem(cmds):
    """A deny reason if any of cmds (each (words, folder)) merges a pull request whose Approved vs
    built section numbers a difference and that lacks the CRAIG_APPROVED label, else None."""
    for words, here in cmds:
        args = merge_args(words)
        if args is None:
            continue
        try:
            pr = pr_view(args, here, ["body", "labels"])
            listed = differences(pr["body"] or "")
            labels = {(label.get("name") or "").lower() for label in pr["labels"] or []}
        except (ValueError, TypeError, AttributeError) as error:
            return (f"Can't read this pull request's body and labels, to see whether it waits for Craig's "
                    f"yes to a screen's differences from its approved picture: {error}.")
        if listed and CRAIG_APPROVED not in labels:
            return (f"This pull request waits for Craig: its Approved vs built section lists {len(listed)} "
                    f"difference(s) from the approved picture ({listed[0]}"
                    f"{' …' if len(listed) > 1 else ''}). It merges once Craig adds the {CRAIG_APPROVED} "
                    "label, or once the build matches and the section says so.")
    return None
