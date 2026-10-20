"""Where a Bash command's git calls run, for guard_bash.py: the shell's cwd, moved by any cd
before them (a subshell's cd stays in the subshell), then by git's -C. None wherever the guard
can't be sure, so it refuses rather than guessing. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os
import re
import subprocess

GIT_VALUE_OPTS = {"-C", "-c", "--git-dir", "--work-tree", "--namespace"}
SEPARATORS = {";", "&", "&&", "|", "||", "(", ")", "\n"}
ENDS_A_CHAIN = {";", "\n", "&", "||"}  # after these, a cd that hung on an earlier && may not have run
GIT_PLACE_VARS = re.compile(r"^(GIT_DIR|GIT_WORK_TREE)=")
UNFOLLOWABLE = re.compile(r"[$`]|^-")  # a cd or -C the guard can't follow: a variable, an option, cd -
WRAPPERS = {"env", "command", "exec"}  # run the command after them: env git commit is a commit
WRAPPER_VALUE_OPTS = {"-u", "-C", "-S", "-a", "--unset", "--chdir", "--split-string"}  # env's, and exec -a


def located(segs, cwd):
    """(words, folder) for each simple command (separators left out), following any cd before
    it; folder is None where the guard can't be sure: a cd it can't follow, one that may not
    run (after || or a broken && chain) or runs elsewhere (in a pipe or the background), a
    missing folder, pushd, popd, any command setting GIT_DIR or GIT_WORK_TREE. A worktree is
    a folder of its own, so its branch and staged lines are read there."""
    here, out, outer, before, hung = cwd, [], [], ";", False
    for i, words in enumerate(segs):
        after = segs[i + 1][0] if i + 1 < len(segs) else ";"
        if words[0] in SEPARATORS:
            if words == ["("]:
                outer.append(here)
            elif words == [")"]:
                here = outer.pop() if outer else None
            elif hung and words[0] in ENDS_A_CHAIN:
                here = None
            before = words[0]
            continue
        if words[0] in {"pushd", "popd"}:
            here = None
        elif any(GIT_PLACE_VARS.match(w) for w in words):
            here = None
        elif words[0] == "cd" and here is not None:
            target = words[1] if len(words) > 1 else "~"
            followable = (len(words) <= 2 and not UNFOLLOWABLE.search(target)
                          and before not in {"||", "|", "&"} and after not in {"|", "&"})
            here = os.path.join(here, os.path.expanduser(target)) if followable else None
            here = here if here and os.path.isdir(here) else None
            hung = hung or before == "&&"
        out.append((words, here))
    return out


def program_index(words):
    """Where the program this simple command runs is, past FOO=1 words and any env, command or
    exec (with their options)."""
    i, wrapped = 0, False
    while i < len(words):
        if re.match(r"^\w+=", words[i]):
            i += 1
        elif words[i] in WRAPPERS:
            i, wrapped = i + 1, True
        elif wrapped and words[i].startswith("-"):
            i += 2 if words[i] in WRAPPER_VALUE_OPTS else 1
        else:
            break
    return i


def runs_at(words, program):
    """Where `program` is in this simple command, None if it doesn't run it."""
    i = program_index(words)
    return i if i < len(words) and os.path.basename(words[i]) == program else None


def git_options(words):
    """git's own options, before the subcommand, as (option, value) pairs."""
    start = runs_at(words, "git")
    if start is None:
        return []
    out, i = [], start + 1
    while i < len(words) and words[i].startswith("-"):
        if words[i] in GIT_VALUE_OPTS:
            out.append((words[i], words[i + 1] if i + 1 < len(words) else ""))
            i += 2
        else:
            opt, _, val = words[i].partition("=")
            out.append((opt, val))
            i += 1
    return out


def git_dir(words, here):
    """The folder a git command runs in, None if the guard can't be sure: where the shell is,
    moved by any -C. A wrapper's option (env -C, env -S) may move it too, so that's unsure."""
    start = program_index(words)
    if any(GIT_PLACE_VARS.match(w) or w.startswith("-") for w in words[:start]):
        return None
    for opt, val in git_options(words):
        if here is None or opt in {"--git-dir", "--work-tree"}:
            return None
        if opt == "-C":
            here = None if UNFOLLOWABLE.search(val) else os.path.join(here, os.path.expanduser(val))
    return here if here and os.path.isdir(here) else None


def current_branch(folder):
    try:
        return subprocess.run(
            ["git", "-C", folder, "branch", "--show-current"],
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""
