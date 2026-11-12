"""Where a Bash command's git calls run, for guard_bash.py: the shell's cwd, moved by any cd
before them (a subshell's cd stays in the subshell), then by git's -C, and the program behind any
runner (sudo -u x git, timeout 5 git). None wherever the guard can't be sure, so it refuses rather
than guessing. Commands passed as a string or on stdin (sh -c, eval, a heredoc into bash, ssh,
find -exec) are read by commands.py.

Out of its sight: commands in a file (bash script.sh, ./x.sh, python's subprocess), a string run
by any other program (python -c, node -e, make, a git alias), a shell started inside a shell to
read its stdin (sh -c sh, eval sh, bash /dev/stdin), a function defined before this command line,
what a variable holds (in a double-quoted sh -c "…" string too: the shell fills it in before sh
reads it), the arguments xargs adds to git commit or push from a program's output, and the paths
find puts in for {}.
It also holds main's names, which the hooks share. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os
import re
from collections import namedtuple

from run_command import call

MAIN = "main"
REMOTE = "origin"  # GitHub's copy of the repo
REMOTE_MAIN = f"{REMOTE}/{MAIN}"  # GitHub's main, as fresh as the last fetch
GIT_VALUE_OPTS = {"-C", "-c", "--git-dir", "--work-tree", "--namespace"}
SEPARATORS = {";", "&", "&&", "|", "||", "(", ")", "\n"}
ENDS_A_CHAIN = {";", "\n", "&", "||"}  # after these, a cd that hung on an earlier && may not have run
GIT_PLACE_VARS = re.compile(r"^(GIT_DIR|GIT_WORK_TREE)=")
UNFOLLOWABLE = re.compile(r"[$`]|^-")  # a cd or -C the guard can't follow: a variable, an option, cd -
# in an eval's string: eval "cd ..", eval ". x.sh"
MOVES_THE_SHELL = re.compile(r"\b(cd|pushd|popd|source)\b|(^|\s)\.\s|\bGIT_(DIR|WORK_TREE)=")
# shell words a command can sit behind: { git commit; }, if ...; then git commit; fish's and git commit
KEYWORDS = {"{", "}", "!", "if", "then", "else", "elif", "fi", "while", "until", "do", "done",
            "and", "or", "not"}
MAY_MOVE = {"pushd", "popd", "source", "."}  # each leaves the folder unsure: a sourced file may cd
SPLIT_STRING = {"-S", "--split-string"}  # env -S 'git commit': a string env splits and runs
# a program that runs the command after it, here: its options that take a value, how many
# arguments come before the command (timeout 5 git, flock <file> git), its options that move the
# folder, and those whose value is a string it runs (env -S '…', flock <file> -c '…')
Runner = namedtuple("Runner", "takes_value args_before_command moves_folder runs_string")
RUNNERS = {
    "env": Runner({"-u", "--unset", "-C", "--chdir", "-P", "-L", "-U", *SPLIT_STRING}, 0,
                  {"-C", "--chdir"}, SPLIT_STRING),
    "sudo": Runner({"-u", "--user", "-g", "--group", "-h", "--host", "-p", "--prompt", "-r", "--role",
                    "-t", "--type", "-U", "--other-user", "-C", "--close-from", "-D", "--chdir",
                    "-T", "--command-timeout"}, 0, {"-D", "--chdir", "-i", "--login"}, set()),
    "xargs": Runner({"-I", "-L", "-n", "-P", "-s", "-E", "-d", "-a", "--max-lines", "--max-args",
                     "--max-procs", "--max-chars", "--eof", "--delimiter", "--arg-file"}, 0, set(), set()),
    "timeout": Runner({"-s", "--signal", "-k", "--kill-after"}, 1, set(), set()),
    "nice": Runner({"-n", "--adjustment"}, 0, set(), set()),
    "exec": Runner({"-a"}, 0, set(), set()),
    "time": Runner({"-f", "--format", "-o", "--output"}, 0, set(), set()),  # GNU's /usr/bin/time
    "ionice": Runner({"-c", "--class", "-n", "--classdata", "-p", "--pid", "-P", "--pgid", "-u", "--uid"},
                     0, set(), set()),
    "stdbuf": Runner({"-i", "--input", "-o", "--output", "-e", "--error"}, 0, set(), set()),
    "flock": Runner({"-w", "--wait", "--timeout", "-E", "--conflict-exit-code", "-c", "--command"}, 1,
                    set(), {"-c", "--command"}),
    "doas": Runner({"-u", "-C"}, 0, set(), set()),
    "caffeinate": Runner({"-t", "-w"}, 0, set(), set()),
    **{name: Runner(set(), 0, set(), set())
       for name in ("command", "builtin", "nohup", "setsid", "chronic", "busybox")},
}


def located(segs, cwd):
    """(words, folder) for each simple command (separators left out), following any cd before
    it; folder is None where the guard can't be sure: a cd it can't follow, one that may not
    run (after || or a broken && chain) or runs elsewhere (in a pipe or the background), a
    missing folder, pushd, popd, source, an eval that may move the shell, any command setting
    GIT_DIR or GIT_WORK_TREE, a cd once a function is defined (it runs when the function is
    called, not where it's written). A worktree is a folder of its own, so its branch and staged
    lines are read there."""
    here, out, outer, before, hung, defined = cwd, [], [], ";", False, False
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
        defined = defined or words[:1] == ["function"] or segs[i + 1 : i + 3] == [["("], [")"]]
        if run and (run[0] in MAY_MOVE or (defined and run[0] == "cd")):
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


def runners(words):
    """The runners this simple command's program sits behind: xargs for xargs -n 1 git add."""
    return _past_runners(words)[2]


def moved_by_runner(words):
    """True if a runner's option may run the program elsewhere: env -C, sudo -D, sudo -i."""
    return any(opt in RUNNERS[runner].moves_folder for runner, opt, _ in runner_options(words))


def _past_runners(words):
    i, opts, crossed = 0, [], []
    while i < len(words):
        if re.match(r"^\w+=", words[i]) or words[i] in KEYWORDS:
            i += 1
        elif words[i] == "function":  # function f { git commit; }
            i += 2
        elif os.path.basename(words[i]) in RUNNERS:
            runner = os.path.basename(words[i])
            crossed.append(runner)
            i = _past_one_runner(words, i, runner, opts)
        else:
            break
    return i, opts, crossed


def _past_one_runner(words, i, runner, opts):
    spec = RUNNERS[runner]
    found, i = options(words, i + 1, spec.takes_value)
    if spec.args_before_command:  # and its options may follow them: flock <file> -c '…'
        more, i = options(words, i + spec.args_before_command, spec.takes_value)
        found += more
    opts += [(runner, opt, value) for opt, value in found]
    return i


def options(words, i, takes_value):
    """The options from words[i] on, as (option, value), and where they end: at the first word
    that isn't one, or just past a --. A cluster's letters are options each (sudo -nu craig), up
    to one that takes a value (nice -n5)."""
    found = []
    while i < len(words) and words[i].startswith("-"):
        word, i = words[i], i + 1
        if word == "--":
            break
        if word.startswith("--"):
            opt, has_value, value = word.partition("=")
            if not has_value and opt in takes_value and i < len(words):
                value, i = words[i], i + 1
            found.append((opt, value))
            continue
        for k, letter in enumerate(word[1:], 2):
            opt, value = "-" + letter, word[k:]
            if opt in takes_value:
                if not value and i < len(words):
                    value, i = words[i], i + 1
                found.append((opt, value))
                break
            found.append((opt, ""))
    return found, i


def arguments(args, takes_value):
    """Every option in args, as (option, value), and the words that aren't one or an option's value
    (the operands, everything after a -- among them), in order. Options may follow operands, as gh
    and git allow."""
    found, operands, i = [], [], 0
    while i < len(args):
        more, end = options(args, i, takes_value)
        found += more
        if end > i and args[end - 1] == "--":
            return found, operands + args[end:]
        if end < len(args):
            operands.append(args[end])
        i = end + 1
    return found, operands


# options whose value is a file a commit, tag, pull request, issue or release takes its text from:
# git commit/tag -F and --file, gh's -F and --body-file, gh release's --notes-file
TEXT_FILE_OPTS = {"-F", "--file", "--body-file", "--notes-file"}


def text_files(args, takes_value=frozenset()):
    """The path each TEXT_FILE_OPTS option in these git or gh args names (- for stdin), split
    (-F b.md), attached (-Fb.md) or after = (--file=b.md). takes_value is the command's other
    options that take a value, so a value is never read as an option."""
    found, _ = arguments(args, TEXT_FILE_OPTS | set(takes_value))
    return [value for opt, value in found if opt in TEXT_FILE_OPTS]


def program_name(words):
    """The program this simple command runs, as a file name (git for /usr/bin/git), or ""."""
    i = program_index(words)
    return os.path.basename(words[i]) if i < len(words) else ""


def runs_at(words, program):
    """Where `program` is in this simple command, None if it doesn't run it."""
    return program_index(words) if program_name(words) == program else None


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


# a guard's git call is on every command, so it gets less time than run_command's default
GIT_TIMEOUT_SECONDS = 5


def git_output(folder, *args):
    """git's output, run in folder; None if it fails or can't run."""
    code, out = call(folder, "git", "-C", folder, *args, timeout=GIT_TIMEOUT_SECONDS)
    return out if code == 0 else None


def current_branch(folder):
    """The folder's branch, "" on a detached HEAD, None if git can't say."""
    out = git_output(folder, "branch", "--show-current")
    return None if out is None else out.strip()


def previous_branch(folder, back=1):
    """The branch `git switch -` (or @{-back}) goes back to, None if git can't say."""
    out = git_output(folder, "rev-parse", "--abbrev-ref", f"@{{-{back}}}")
    return None if out is None else out.strip()
