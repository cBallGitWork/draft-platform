"""The checks merge gate, for guard_bash.py (gh pr merge) and guard_github.py (merge_pull_request):
a merge waits until every check on the pull request's head has passed and that head holds all of
main. Main went red three times on 1 Nov 2026 with every pull request's own checks green: two
pull requests each passed alone and failed together (the glossary test), and CI's timeouts
(#894). Its checks run on the head merged with main as it stood, so a head behind main merges
untested code; a pull request behind main is updated, and merges once its checks pass again.
Checks pass when each check run has finished as success, skipped or neutral and each commit status
is success; a head with no checks at all hasn't been checked, so it waits too. Read through
GitHub's REST API (gh api), which a cloud session can reach where gh pr view's GraphQL can't. A
pull request, its checks or its distance from main it can't read is a denial, never a silent
pass, and so is a head with more checks than one read returns. gh pr merge --auto waits on
checks itself but is refused here too while any is pending: a merge goes once they have passed.
Up to six gh calls of at most 11s each (tidy_branch.py) sit inside the guards' 60s in
settings.json, as a hook that times out allows. Like drift_gate.py it stops the usual routes only:
the web button doesn't pass through it. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import re

from drift_gate import REPO_OPTS, merge_args, view_args
from tidy_branch import call
from where import current_branch

PLACEHOLDER = "{owner}/{repo}"  # gh api fills it from the folder's remote
PR_URL = re.compile(r"github\.com/([^/\s]+/[^/\s]+)/pull/(\d+)")
PAGE = 100  # GitHub's most per read
PASSED_RUNS = {"success", "skipped", "neutral"}
UPDATE = ("Update the branch with main (git merge origin/main, then push), wait for its checks, "
          "then merge.")
WHICH_PR = "Can't tell which pull request this merges, to read its checks"


class Unread(Exception):
    """Something the gate needs that GitHub didn't give."""


def _api(folder, path):
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
    open_prs = _api(folder, f"repos/{repo}/pulls?state=open&per_page=100")
    numbers = [pr["number"] for pr in open_prs if pr["head"]["ref"] == ref] if isinstance(open_prs, list) else []
    if len(numbers) != 1:
        raise Unread(f"no single open pull request has the branch {ref}")
    return repo, numbers[0]


def _failing(folder, repo, sha):
    """The names of the head's checks that haven't passed, each with its state."""
    found = _api(folder, f"repos/{repo}/commits/{sha}/check-runs?per_page={PAGE}")
    combined = _api(folder, f"repos/{repo}/commits/{sha}/status?per_page={PAGE}")
    runs, statuses = found["check_runs"], combined["statuses"]
    if found["total_count"] > len(runs) or combined["total_count"] > len(statuses):
        raise Unread(f"the head has more checks than one read of {PAGE} returns")
    if not runs and not statuses:
        return ["no checks have run"]
    out = [f"{run['name']} ({run.get('conclusion') or run.get('status')})" for run in runs
           if run.get("status") != "completed" or run.get("conclusion") not in PASSED_RUNS]
    return out + [f"{status['context']} ({status['state']})" for status in statuses if status.get("state") != "success"]


def pr_problem(repo, number, folder):
    """A deny reason if pull request number in repo hasn't passed its checks on a head holding all
    of main, else None."""
    try:
        pr = _api(folder, f"repos/{repo}/pulls/{number}")
        sha, base = pr["head"]["sha"], pr["base"]["ref"]
        failing = _failing(folder, repo, sha)
        behind = _api(folder, f"repos/{repo}/compare/{base}...{sha}")["behind_by"]
    except (Unread, KeyError, TypeError) as error:
        return (f"Can't read pull request #{number}'s checks and how far it is behind its base, to see "
                f"whether it may merge: {error}.")
    if behind:
        return (f"Pull request #{number} is {behind} commit(s) behind {base}, so its checks didn't run on "
                f"what would merge. {UPDATE}")
    if failing:
        return (f"Pull request #{number}'s checks haven't all passed: {', '.join(failing[:4])}"
                f"{' …' if len(failing) > 4 else ''}. Fix or wait for them, then merge.")
    return None


def checks_problem(cmds):
    """A deny reason if any of cmds (each (words, folder)) runs gh pr merge on a pull request that
    hasn't passed its checks on all of main, else None."""
    for words, here in cmds:
        args = merge_args(words)
        if args is None:
            continue
        try:
            repo, number = _target(args, here)
        except (Unread, KeyError, TypeError) as error:
            return f"{WHICH_PR}: {error}."
        problem = pr_problem(repo, number, here)
        if problem:
            return problem
    return None


def mcp_checks_problem(tool, tool_input, folder):
    """A deny reason if this GitHub tool call merges a pull request that hasn't passed its checks on
    all of main, else None."""
    if tool != "mcp__github__merge_pull_request":
        return None
    try:
        repo = f"{tool_input['owner']}/{tool_input['repo']}"
        number = int(tool_input["pullNumber"])
    except (KeyError, TypeError, ValueError) as error:
        return f"{WHICH_PR}: {error}."
    return pr_problem(repo, number, folder)
