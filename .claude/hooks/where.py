"""Where a Bash command's git calls run, for guard_bash.py: the shell's cwd, moved by any cd
before them (a subshell's cd stays in the subshell), then by git's -C, and the program behind any
runner (sudo -u x git, timeout 5 git). None wherever the guard can't be sure, so it refuses rather
than guessing. Commands passed as a string (sh -c, eval, env -S, $(…)) are read by commands.py.

Out of its sight: commands in a file or on stdin (bash script.sh, a heredoc or pipe into sh,
python's subprocess), a string run by any other program (su -c, watch, ssh), a cd inside a
function or a sourced file, what a variable holds, and the arguments xargs reads from stdin.
Stdlib only, Python 3.9+.
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
MOVES_THE_SHELL = re.compile(r"\b(cd|pushd|popd)\b|\bGIT_(DIR|WORK_TREE)=")  # inside an eval's string
# shell words a command can sit behind: { git commit; }, if ...; then git commit
KEYWORDS = {"{", "}", "!", "if", "then", "else", "elif", "fi", "while", "until", "do", "done"}
# programs that run the command after them here: for each, its options that take a value, how
# many arguments come before the command (timeout 5 git), and its options that move the folder
RUNNERS = {
    "env": ({"-u", "--unset", "-C", "--chdir", "-S", "--split-string", "-P", "-L", "-U"}, 0,
            {"-C", "--chdir"}),
    "sudo": ({"-u", "--user", "-g", "--group", "-h", "--host", "-p", "--prompt", "-r", "--role",
              "-t", "--type", "-U", "--other-user", "-C", "--close-from", "-D", "--chdir",
              "-T", "--command-timeout"}, 0, {"-D", "--chdir", "-i", "--login"}),
    "xargs": ({"-I", "-L", "-n", "-P", "-s", "-E", "-d", "-a", "--max-lines", "--max-args",
               "--max-procs", "--max-chars", "--eof", "--delimiter", "--arg-file"}, 0, set()),
    "timeout": ({"-s", "--signal", "-k", "--kill-after"}, 1, set()),
    "nice": ({"-n", "--adjustment"}, 0, set()),
    "exec": ({"-a"}, 0, set()),
    **{name: (set(), 0, set()) for name in ("command", "builtin", "nohup", "time")},
}


def located(segs, cwd):
    """(words, folder) for each simple command (separators left out), following any cd before
    it; folder is None where the guard can't be sure: a cd it can't follow, one that may not
    run (after || or a broken && chain) or runs elsewhere (in a pipe or the background), a
    missing folder, pushd, popd, an eval that may move the shell, any command setting GIT_DIR
    or GIT_WORK_TREE. A worktree is a folder of its own, so its branch and staged lines are
    read there."""
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
        run = words[program_index(words):]  # { cd x; ...} and if cd x; ... move the shell too
        if run[:1] in (["pushd"], ["popd"]):
            here = None
        elif any(GIT_PLACE_VARS.match(w) for w in words):
            here = None
        elif run[:1] == ["eval"] and MOVES_THE_SHELL.search(" ".join(run[1:])):
            here = None
        elif run[:1] == ["cd"] and here is not None:
            target = run[1] if len(run) > 1 else "~"
            followable = (len(run) <= 2 and not UNFOLLOWABLE.search(target)
                          and before not in {"||", "|", "&"} and after not in {"|", "&"})
            here = os.path.join(here, os.path.expanduser(target)) if followable else None
            here = here if here and os.path.isdir(here) else None
            hung = hung or before == "&&"
        out.append((words, here))
    return out


def program_index(words):
    """Where the program this simple command runs is, past FOO=1 words, shell keywords, a
    function's name (its body is a command too) and any runner with its options."""
    return _past_runners(words)[0]


def runner_options(words):
    """Each option given to a runner before the program, as (runner, option, value)."""
    return _past_runners(words)[1]


def moved_by_runner(words):
    """True if a runner's option may run the program elsewhere: env -C, sudo -D, sudo -i."""
    return any(opt in RUNNERS[runner][2] for runner, opt, _ in runner_options(words))


def _past_runners(words):
    i, opts = 0, []
    while i < len(words):
        if re.match(r"^\w+=", words[i]) or words[i] in KEYWORDS:
            i += 1
        elif words[i] == "function":  # function f { git commit; }
            i += 2
        elif os.path.basename(words[i]) in RUNNERS:
            i = _past_one_runner(words, i, opts)
        else:
            break
    return i, opts


def _past_one_runner(words, i, opts):
    runner = os.path.basename(words[i])
    takes_value, before_command, _ = RUNNERS[runner]
    i += 1
    while i < len(words) and words[i].startswith("-"):
        word, i = words[i], i + 1
        if word == "--":
            break
        if word.startswith("--"):
            opt, has_value, value = word.partition("=")
            if not has_value and opt in takes_value and i < len(words):
                value, i = words[i], i + 1
            opts.append((runner, opt, value))
            continue
        for k, letter in enumerate(word[1:], 2):  # a cluster: sudo -nu craig, nice -n5
            opt, value = "-" + letter, word[k:]
            if opt in takes_value:
                if not value and i < len(words):
                    value, i = words[i], i + 1
                opts.append((runner, opt, value))
                break
            opts.append((runner, opt, ""))
    return i + before_command


def runs_at(words, program):
    """Where `program` is in this simple command, None if it doesn't run it."""
    i = program_index(words)
    return i if i < len(words) and os.path.basename(words[i]) == program else None


def git_call(words):
    """(subcommand, args) if this simple command runs git, else None."""
    i = runs_at(words, "git")  # FOO=1 git ..., env git ...
    if i is None:
        return None
    i += 1
    while i < len(words) and words[i].startswith("-"):
        i += 2 if words[i] in GIT_VALUE_OPTS else 1
    if i >= len(words):
        return None
    return words[i], words[i + 1 :]


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
    moved by any -C. A runner that moves it (env -C, sudo -D) makes it unsure."""
    start = program_index(words)
    if any(GIT_PLACE_VARS.match(w) for w in words[:start]) or moved_by_runner(words):
        return None
    for opt, val in git_options(words):
        if here is None or opt in {"--git-dir", "--work-tree"}:
            return None
        if opt == "-C":
            here = None if UNFOLLOWABLE.search(val) else os.path.join(here, os.path.expanduser(val))
    return here if here and os.path.isdir(here) else None


def git_output(folder, *args):
    """What git prints run in folder, None if it fails or can't run."""
    try:
        done = subprocess.run(["git", "-C", folder, *args], capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.SubprocessError):
        return None
    return done.stdout if done.returncode == 0 else None


def current_branch(folder):
    """The folder's branch, "" on a detached HEAD, None if git can't say."""
    out = git_output(folder, "branch", "--show-current")
    return None if out is None else out.strip()


def previous_branch(folder, back=1):
    """The branch `git switch -` (or @{-back}) goes back to, None if git can't say."""
    out = git_output(folder, "rev-parse", "--abbrev-ref", f"@{{-{back}}}")
    return None if out is None else out.strip()
