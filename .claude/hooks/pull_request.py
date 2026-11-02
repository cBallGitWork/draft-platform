"""Which pull request a merge names, and GitHub's record of it, for the merge gates
(drift_gate.py, approval_gate.py, checks_gate.py). A merge comes two ways: gh pr merge through
Bash (guard_bash.py), or the GitHub tool's merge_pull_request (guard_github.py), the route a cloud
session takes. Every gate reads GitHub's REST API (gh api), which a cloud session reaches where gh
pr view's GraphQL can't (403), so each gate judges both routes alike (#1045). What it can't read
raises Unread, which each gate turns into a denial, never a silent pass. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import functools
import json
import re

from tidy_branch import call
from where import current_branch, runs_at

MERGE_CALL = ["pr", "merge"]
MERGE_TOOL = "mcp__github__merge_pull_request"
REPO_OPTS = {"-R", "--repo"}
MERGE_VALUE_OPTS = {"-b", "--body", "-F", "--body-file", "-t", "--subject", "-A", "--author-email",
                    "--match-head-commit"} | REPO_OPTS  # gh pr merge's options that take a value
PLACEHOLDER = "{owner}/{repo}"  # gh api fills it from the folder's remote
PR_URL = re.compile(r"github\.com/([^/\s]+/[^/\s]+)/pull/(\d+)")
WHICH_PR = "Can't tell which pull request this merges"


class Unread(Exception):
    """Something a gate needs that GitHub didn't give."""


def merge_args(words):
    """The args after gh pr merge, if this simple command runs it, else None."""
    i = runs_at(words, "gh")
    if i is None or words[i + 1 : i + 3] != MERGE_CALL:
        return None
    return words[i + 3 :]


def view_args(args):
    """gh pr view's args for the same pull request: its number, url or branch, and any --repo."""
    out, i = [], 0
    while i < len(args):
        arg = args[i]
        if arg.partition("=")[0] in REPO_OPTS:
            out += [arg] if "=" in arg else args[i : i + 2]
            i += 0 if "=" in arg else 1
        elif arg in MERGE_VALUE_OPTS:
            i += 1
        elif not arg.startswith("-"):
            out.append(arg)
        i += 1
    return out


def api(folder, path):
    """gh api's JSON for this REST path, run in folder; raises Unread saying why it can't be read."""
    code, out = call(folder, "gh", "api", path)
    if code != 0:
        raise Unread(f"gh api {path} failed ({out})")
    try:
        return json.loads(out)
    except ValueError as error:
        raise Unread(f"gh api {path} gave no JSON ({error})") from error


def _target(args, folder):
    """(owner/repo, pull request number) for these gh pr merge args: a number, a URL or a branch,
    or none for the folder's own branch; the repo from -R, the URL or the folder's remote."""
    repo, named = PLACEHOLDER, []
    joined = [arg for arg in args if arg.startswith("-R") and len(arg) > 2]  # -Rowner/repo
    if joined:
        repo = joined[-1][2:]
    rest = view_args(args)
    i = 0
    while i < len(rest):
        opt, _, value = rest[i].partition("=")
        if opt in REPO_OPTS:
            repo = value or (rest[i + 1] if i + 1 < len(rest) else repo)
            i += 1 if value else 2
            continue
        named.append(rest[i])
        i += 1
    ref = named[0] if named else current_branch(folder)
    if not ref:
        raise Unread("no pull request named, and the folder's branch can't be read")
    found = PR_URL.search(ref)
    if found:
        return found.group(1), int(found.group(2))
    if ref.lstrip("#").isdigit():
        return repo, int(ref.lstrip("#"))
    open_prs = api(folder, f"repos/{repo}/pulls?state=open&per_page=100")
    numbers = [pr["number"] for pr in open_prs if pr["head"]["ref"] == ref] if isinstance(open_prs, list) else []
    if len(numbers) != 1:
        raise Unread(f"no single open pull request has the branch {ref}")
    return repo, numbers[0]


@functools.lru_cache(maxsize=None)
def pull(repo, number, folder):
    """GitHub's record of pull request number in repo (title, body, labels, head, base), read once
    a hook run however many gates ask; raises Unread saying why it can't be read."""
    found = api(folder, f"repos/{repo}/pulls/{number}")
    if not isinstance(found, dict):
        raise Unread(f"gh api gave no pull request #{number}")
    return found


def merges_problem(cmds, judge):
    """judge(repo, number, folder)'s deny reason for the first gh pr merge in cmds (each (words,
    folder)) that has one, else None."""
    for words, here in cmds:
        args = merge_args(words)
        if args is None:
            continue
        try:
            repo, number = _target(args, here)
        except (Unread, KeyError, TypeError) as error:
            return f"{WHICH_PR}: {error}."
        problem = judge(repo, number, here)
        if problem:
            return problem
    return None


def tool_merge_problem(tool, tool_input, folder, judge):
    """judge(repo, number, folder)'s deny reason if this GitHub tool call merges a pull request,
    else None."""
    if tool != MERGE_TOOL:
        return None
    try:
        repo = f"{tool_input['owner']}/{tool_input['repo']}"
        number = int(tool_input["pullNumber"])
    except (KeyError, TypeError, ValueError) as error:
        return f"{WHICH_PR}: {error}."
    return judge(repo, number, folder)
