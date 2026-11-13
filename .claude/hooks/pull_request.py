"""Which pull request a merge names, and GitHub's record of it, for the merge gates
(approval_gate.py). A merge comes two ways: gh pr merge through
Bash (guard_bash.py), or the GitHub tool's merge_pull_request (guard_github.py), the route a cloud
session takes. Every gate reads GitHub's REST API (gh api), which a cloud session reaches where gh
pr view's GraphQL can't (403), so each gate judges both routes alike (#1045). What it can't read
raises Unread, which each gate turns into a denial, never a silent pass. Which pull request a
gh pr merge names is worked out before any gate judges it, so one it can't name is refused, and one with --admin is refused before any gate: the gh token is Craig's, and
an admin merge bypasses the main ruleset's review rule, as #1066 and #1067 did. A write to gh api's merge
endpoint (repos/o/r/pulls/N/merge) is refused outright: it is the same admin merge with no checks of
gh pr merge's own, and gh pr merge or the GitHub tool does the job (#1075). So is a gh api graphql call
whose query runs the mergePullRequest or enablePullRequestAutoMerge mutation, or whose query the hook can't
read (from a file, --input or the shell), the same merge by GraphQL (#2057). Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import functools
import json
import re

from parsing import MARKED
from run_command import call
from private_words import GH_VALUE_OPTS
from where import arguments, current_branch, runs_at

MERGE_CALL = ["pr", "merge"]
MERGE_TOOL = "mcp__github__merge_pull_request"
REPO_OPTS = {"-R", "--repo"}
MERGE_VALUE_OPTS = {"-b", "--body", "-F", "--body-file", "-t", "--subject", "-A", "--author-email",
                    "--match-head-commit"} | REPO_OPTS  # gh pr merge's options that take a value
PLACEHOLDER = "{owner}/{repo}"  # gh api fills it from the folder's remote
PR_URL = re.compile(r"github\.com/([^/\s]+/[^/\s]+)/pull/(\d+)")
WHICH_PR = "Can't tell which pull request this merges"
ADMIN_OPT = "--admin"
API_VALUE_OPTS = GH_VALUE_OPTS | {"-F", "--field", "-H", "--header", "--input", "--template", "--cache",
                                 "--preview", "--hostname"}  # gh api's options that take a value
METHOD_OPTS = {"-X", "--method"}
READ_METHODS = {"GET", "HEAD"}
API_MERGE_PATH = re.compile(r"(?:^|/)pulls/[^/]*/merge/?(?:\?.*)?$")
GRAPHQL_MERGE = re.compile(r"\b(?:mergePullRequest|enablePullRequestAutoMerge)\b")
GRAPHQL_PATH = re.compile(r"^(?:https?://[^/]+)?(?:/api/v3)?/?graphql/?$")  # graphql, /graphql, the full URL
HIDDEN_QUERY = re.compile(r"^query=(?:\$|.*(?:\$\(|\$\{|`|<\())", re.S)  # a query the shell fills in: $Q, $(cat q)
FIELD_OPTS = {"-f", "--raw-field", "-F", "--field"}
API_MERGE = ("gh api's merge endpoint, or a GraphQL merge or auto-merge through gh api graphql (#2057), "
             "skips gh pr merge's checks, and with Craig's admin token the main ruleset's bypass can let it merge "
             "a pull request whose checks or review aren't done (#1075). Merge with gh pr merge (no --admin) or "
             "the GitHub tool, or ask Craig.")
ADMIN_BYPASS = ("gh pr merge --admin bypasses the main ruleset's checks and review, and the admin bypass "
                "is Craig's, used by him in GitHub. Merge without --admin once the pull request is "
                "mergeable, or ask Craig to merge it.")


class Unread(Exception):
    """Something a gate needs that GitHub didn't give."""


def merge_args(words):
    """The args after gh pr merge, if this simple command runs it, else None. A -R/--repo given
    before pr merge (gh -R o/r pr merge 5) is skipped over and kept, first, in the args."""
    i = runs_at(words, "gh")
    if i is None:
        return None
    i, before = i + 1, []
    while i < len(words) and (words[i].startswith("-R") or words[i].partition("=")[0] in REPO_OPTS):
        joined = "=" in words[i] or (words[i].startswith("-R") and len(words[i]) > 2)  # --repo=o/r, -Ro/r
        step = 1 if joined else 2
        before += words[i : i + step]
        i += step
    if words[i : i + 2] != MERGE_CALL:
        return None
    return before + words[i + 2 :]


def api_merge(words):
    """True if this simple command runs gh api with a method other than GET on a pull request's merge
    endpoint. With no -X gh api reads (or posts fields), and neither merges."""
    i = runs_at(words, "gh")
    if i is None:
        return False
    opts, operands = arguments(words[i + 1 :], API_VALUE_OPTS)
    if operands[:1] != ["api"] or len(operands) < 2 or not API_MERGE_PATH.search(operands[1]):
        return False
    methods = [value for opt, value in opts if opt in METHOD_OPTS]
    return bool(methods) and methods[-1].upper() not in READ_METHODS


def graphql_merge(words):
    """True if this simple command runs gh api graphql with a query that merges a pull request or turns on
    its auto-merge, or with one the hook can't read: a field read from a file (-F query=@q.graphql), --input, or a
    query the shell fills in ($Q, $(cat q.graphql)). The endpoint may be spelled graphql, /graphql or its full URL.
    A query that only reads passes."""
    i = runs_at(words, "gh")
    if i is None:
        return False
    opts, operands = arguments(words[i + 1 :], API_VALUE_OPTS)
    if operands[:1] != ["api"] or len(operands) < 2 or not GRAPHQL_PATH.search(operands[1]):
        return False
    fields = [value for opt, value in opts if opt in FIELD_OPTS]
    unread = (any(opt == "--input" for opt, _ in opts)
              or any(opt in {"-F", "--field"} and value.partition("=")[2].startswith("@") for opt, value in opts)
              # MARKED is a $(…) or `…` the splitter lifted out
              or any(HIDDEN_QUERY.search(value) or MARKED.search(value) for value in fields))
    return unread or any(GRAPHQL_MERGE.search(value) for value in fields)


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


def uses_admin(args):
    """True if these gh pr merge args pass --admin (anywhere, or as --admin=value), other than as
    the value of an option such as --body."""
    i = 0
    while i < len(args):
        arg = args[i]
        if arg.partition("=")[0] == ADMIN_OPT:
            return True
        i += 2 if arg in MERGE_VALUE_OPTS else 1
    return False


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
        if api_merge(words) or graphql_merge(words):
            return API_MERGE
        args = merge_args(words)
        if args is None:
            continue
        if uses_admin(args):
            return ADMIN_BYPASS
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
