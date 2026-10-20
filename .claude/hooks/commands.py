"""Every simple command a Bash command line runs, for guard_bash.py, each with the folder it
starts in (where.py). The line is split as the shell splits it (parsing.py), and then each string
it hands to a shell is read the same way: sh, bash or zsh -c, eval, env -S, flock -c, each $(…)
or `…`, what a heredoc, here-string or pipe feeds a shell on stdin (bash <<'EOF', echo … | sh:
stdin_reading.py), and what xargs adds from it (xargs -I{} sh -c '{}'). A cd inside a string counts only
inside it; an eval that may move the shell leaves the folder after it unsure (where.py), and so
does every command run by ssh, su, watch, script, fish or find -execdir. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import re
import shlex
from collections import namedtuple

from stdin_reading import FILLED_IN, STDIN, UNKNOWN, UnreadableStdin, stdins
from parsing import MARKED, Unbalanced, Unreadable, parse
from where import (RUNNERS, located, moved_by_runner, options, program_index, program_name, runner_options,
                   runners)

SHELLS = {"sh", "bash", "zsh", "dash", "ksh"}
SHELL_VALUE_OPTS = {"-o", "+o", "-O", "+O", "--rcfile", "--init-file"}
SHORT_FLAGS = re.compile(r"^-[A-Za-z]+$")  # -lc, -am
XARGS = "xargs"  # it adds what it reads on stdin to the command after it
XARGS_REPLACE = {"-I", "-i", "--replace"}  # xargs -I{}: each line it reads goes where {} is
XARGS_FILE = {"-a", "--arg-file"}  # xargs -a f: it reads a file, not stdin
# a program that runs a string as shell commands where the guard can't follow it (another host,
# another user, its own syntax, over and over): its options that take a value, those whose value
# is the string, and how many operands come before a command made of the rest (ssh host git
# status); None where its operands are never a command (su craig -c '…', fish script.fish)
Elsewhere = namedtuple("Elsewhere", "takes_value runs_string operands_before")
ELSEWHERE = {
    "ssh": Elsewhere({"-" + letter for letter in "BbcDEeFIiJLlmOopQRSWw"}, set(), 1),
    "watch": Elsewhere({"-n", "--interval", "-q", "--equexit"}, set(), 0),
    "script": Elsewhere({"-c", "--command", "-E", "--echo", "-I", "--log-in", "-O", "--log-out", "-B",
                         "--log-io", "-T", "--log-timing", "-m", "--logging-format", "-o", "--output-limit",
                         "-t"}, {"-c", "--command"}, 1),  # macOS: script [-q] <file> git commit
    "su": Elsewhere({"-c", "--command", "--session-command", "-s", "--shell", "-g", "--group", "-G",
                     "--supp-group", "-w", "--whitelist-environment"}, {"-c", "--command", "--session-command"},
                    None),
    "fish": Elsewhere({"-c", "--command", "-C", "--init-command", "-d", "--debug", "-o", "--debug-output",
                       "-f", "--features", "--profile", "--profile-startup"},
                      {"-c", "--command", "-C", "--init-command"}, None),
}
FIND_RUNS = {"-exec": True, "-ok": True, "-execdir": False, "-okdir": False}  # True: in find's folder


def commands(cmd, cwd):
    """(words, folder) for every simple command cmd runs, those in its strings included; the
    folder is None where the guard can't be sure. Raises Unbalanced if cmd's own quotes don't
    balance (zsh then runs none of it; bash runs the lines before the bad one), Unreadable if a
    string inside it doesn't, and UnreadableStdin."""
    segs, lifted = parse(cmd)
    segs, inputs = stdins(segs, lifted)
    out = []
    for (words, here), (stdin, substituted) in zip(located(segs, cwd), inputs):
        out += _with_inner(words, here, stdin, lifted)
        for n in substituted:
            out += _commands_in_string(lifted[n], here)
    return out


def _with_inner(words, here, stdin, lifted):
    """(words, folder) for this simple command and for each command it runs: its $(…), the
    strings it hands a shell, what a shell reads on its stdin and what find runs."""
    out = [(words, here)]
    for n in (int(n) for word in words for n in MARKED.findall(word)):
        out += _commands_in_string(lifted[n], here)
    inner_here = None if moved_by_runner(words) else here
    for script, same_folder in scripts(words):  # its $(…) ran in this shell, above: the next sees output
        if script is STDIN:
            if stdin is UNKNOWN:
                raise UnreadableStdin(" ".join(words))
            script = stdin
        if script:
            out += _commands_in_string(MARKED.sub("$_", script), inner_here if same_folder else None)
    for run, same_folder in find_runs(words):
        out += _with_inner(run, inner_here if same_folder else None, None, lifted)
    for run in _xargs_runs(words, stdin):
        out += _with_inner(run, here, None, lifted)
    return out


def _commands_in_string(string, here):
    try:
        return commands(string, here)
    except Unbalanced:
        raise Unreadable(string) from None


def scripts(words):
    """The strings this simple command runs as shell commands, each with whether it runs them in
    its own folder (not for ssh, su, watch, script or fish): sh -c "…", eval …, env -S '…',
    flock <file> -c '…', ssh host git …; STDIN where a shell reads them on stdin."""
    i, program = program_index(words), program_name(words)
    args = words[i + 1 :]
    out = [(value + " " + shlex.join(words[i:]), True) for runner, opt, value in runner_options(words)
           if opt in RUNNERS[runner].runs_string]
    if program == "eval":
        out.append((" ".join(args), True))
    elif program in SHELLS:
        flags, operands = _shell_args(args)
        if "c" in flags:
            given = operands[:1] or ([STDIN] if XARGS in runners(words) else [])  # xargs sh -c: from stdin
            out += [(string, True) for string in given]
        elif "s" in flags or not operands:  # bash script.sh runs a file, out of sight
            out.append((STDIN, True))
    elif program in ELSEWHERE:
        out += [(string, False) for string in _run_elsewhere(ELSEWHERE[program], args)]
    return out


def _shell_args(args):
    """A shell's short option letters (bash -lc gives lc) and the operands after them."""
    flags, i = "", 0
    while i < len(args) and args[i].startswith(("-", "+")) and args[i] not in {"-", "--"}:
        flags += short_flags(args[i])
        i += 2 if args[i] in SHELL_VALUE_OPTS else 1
    if args[i : i + 1] in (["-"], ["--"]):
        i += 1
    return flags, args[i:]


def _run_elsewhere(spec, args):
    """The strings a program in ELSEWHERE runs; [STDIN] if it's given none, as a bare ssh host,
    su or fish then runs what it reads on stdin."""
    strings, operands, i = [], [], 0
    while i < len(args):
        found, i = options(args, i, spec.takes_value)
        strings += [value for opt, value in found if opt in spec.runs_string]
        if spec.operands_before is not None:  # its options end at its first operand
            operands = args[i:]
            break
        operands += args[i : i + 1]  # su craig -c '…': an option may follow an operand
        i += 1
    before = spec.operands_before or 0
    if spec.operands_before is not None and operands[before:]:
        strings.append(" ".join(operands[before:]))
    return strings or ([STDIN] if len(operands) <= before else [])


def find_runs(words):
    """Each command find runs, as (words, whether it runs in find's folder): -exec … ; and -ok
    run there, -execdir and -okdir in each file's own folder."""
    if program_name(words) != "find":
        return []
    out, i = [], program_index(words) + 1
    while i < len(words):
        if words[i] in FIND_RUNS:
            end = i + 1
            while end < len(words) and words[end] != ";" and words[end - 1 : end + 1] != ["{}", "+"]:
                end += 1
            out.append((words[i + 1 : end], FIND_RUNS[words[i]]))
            i = end
        i += 1
    return out


def _xargs_runs(words, stdin):
    """What a command behind xargs runs once xargs adds what it reads: each line in place of its
    -I string (xargs -I{} sh -c '{}'), or its words after the rest (xargs git, xargs sh -c), each
    as written and as xargs unquotes it. Raises UnreadableStdin where xargs fills in a string the
    command runs from stdin the guard can't read."""
    if XARGS not in runners(words) or stdin is None:
        return []
    xargs = [(opt, value) for runner, opt, value in runner_options(words) if runner == XARGS]
    replace = next((value or "{}" for opt, value in xargs if opt in XARGS_REPLACE), None)
    if stdin is UNKNOWN or any(opt in XARGS_FILE for opt, _ in xargs):
        if any(script is STDIN or (replace and replace in script) for script, _ in scripts(words)):
            raise UnreadableStdin(" ".join(words))
        return []
    if not replace:
        return [words + _xargs_words(stdin)]
    i = program_index(words)
    lines = [line.strip() for line in stdin.splitlines() if line.strip()]
    items = lines + [" ".join(_xargs_words(line)) for line in lines]
    return [words[:i] + [word.replace(replace, item) for word in words[i:]] for item in items]


def _xargs_words(text):
    """The words xargs reads from text: split at blanks, its quotes taken out where they balance."""
    try:
        return shlex.split(text)
    except ValueError:
        return text.split()


def runs_unknown(words):
    """True if the program this simple command runs is a variable or a $(…)."""
    return FILLED_IN.search(program_name(words)) is not None


def short_flags(arg):
    """The letters of a cluster of short options (-lc gives lc), "" for anything else."""
    return arg[1:] if SHORT_FLAGS.match(arg) else ""
