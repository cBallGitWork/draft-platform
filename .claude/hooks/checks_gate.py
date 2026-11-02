"""The checks merge gate, for guard_bash.py (gh pr merge) and guard_github.py (merge_pull_request):
a merge waits until every check on the pull request's head has passed and that head holds all of
main. Main went red three times on 1 Nov 2026 with every pull request's own checks green: two
pull requests each passed alone and failed together (the glossary test), and CI's timeouts
(#894). Its checks run on the head merged with main as it stood, so a head behind main merges
untested code; a pull request behind main is updated, and merges once its checks pass again.
Checks pass when each check run has finished as success, skipped or neutral and each commit status
is success; a head with no checks at all hasn't been checked, so it waits too. Read through
pull_request.py. A pull request, its checks or its distance from main it can't read is a
denial, never a silent pass, and so is a head with more checks than one read returns. gh pr
merge --auto waits on checks itself but is refused here too while any is pending: a merge goes
once they have passed.
Up to six gh calls of at most 11s each (run_command.py) sit inside the guards' 60s in
settings.json, as a hook that times out allows. Like drift_gate.py it stops the usual routes only:
the web button doesn't pass through it. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

from pull_request import Unread, api, merges_problem, pull, tool_merge_problem

PAGE = 100  # GitHub's most per read
PASSED_RUNS = {"success", "skipped", "neutral"}
UPDATE = ("Update the branch with main (git merge origin/main, then push), wait for its checks, "
          "then merge.")


def _failing(folder, repo, sha):
    """The names of the head's checks that haven't passed, each with its state."""
    found = api(folder, f"repos/{repo}/commits/{sha}/check-runs?per_page={PAGE}")
    combined = api(folder, f"repos/{repo}/commits/{sha}/status?per_page={PAGE}")
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
        pr = pull(repo, number, folder)
        sha, base = pr["head"]["sha"], pr["base"]["ref"]
        failing = _failing(folder, repo, sha)
        behind = api(folder, f"repos/{repo}/compare/{base}...{sha}")["behind_by"]
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
    return merges_problem(cmds, pr_problem)


def mcp_checks_problem(tool, tool_input, folder):
    """A deny reason if this GitHub tool call merges a pull request that hasn't passed its checks on
    all of main, else None."""
    return tool_merge_problem(tool, tool_input, folder, pr_problem)
