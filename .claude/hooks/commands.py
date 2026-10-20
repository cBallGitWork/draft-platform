"""Every simple command a Bash command line runs, for guard_bash.py, each with the folder it
starts in (where.py). The line is split as the shell splits it (parsing.py), and then each string
it hands to a shell is read the same way: sh, bash or zsh -c, eval, env -S, flock -c, each $(…)
or `…`, and what a heredoc, here-string or pipe feeds a shell on stdin (bash <<'EOF',
echo … | sh). A cd inside a string counts only inside it; an eval that may move the shell leaves
the folder after it unsure (where.py), and so does every command run by ssh, su, watch, script,
fish or find -execdir. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import re
import shlex
from collections import namedtuple

from parsing import HEREDOC_MARKED, HERE_STRING, MARKED, Unbalanced, Unreadable, ansi_c_text, parse
from where import RUNNERS, SEPARATORS, located, moved_by_runner, options, program_index, program_name, runner_options

SHELLS = {"sh", "bash", "zsh", "dash", "ksh"}
SHELL_VALUE_OPTS = {"-o", "+o", "-O", "+O", "--rcfile", "--init-file"}
FILLED_IN = re.compile("[$`\x01]")  # a word the shell fills in: $GIT, "$(which git)"
SHORT_FLAGS = re.compile(r"^-[A-Za-z]+$")  # -lc, -am
ECHO_FLAGS = re.compile(r"^-[neE]+$")
UNKNOWN = object()  # stdin a program writes, or one the shell fills in: not something to read
STDIN = object()  # in place of a string: the commands a shell reads on its stdin
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


class UnreadableStdin(Exception):
    """A shell reads commands on stdin that the guard can't read: a program's output, or a heredoc
    or here-string the shell fills in."""


def commands(cmd, cwd):
    """(words, folder) for every simple command cmd runs, those in its strings included; the
    folder is None where the guard can't be sure. Raises Unbalanced if cmd's own quotes don't
    balance (zsh then runs none of it; bash runs the lines before the bad one), Unreadable if a
    string inside it doesn't, and UnreadableStdin."""
    segs, lifted = parse(cmd)
    segs, feeds = _stdins(segs, lifted)
    out = []
    for (words, here), (stdin, substituted) in zip(located(segs, cwd), feeds):
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
    return out


def _commands_in_string(string, here):
    try:
        return commands(string, here)
    except Unbalanced:
        raise Unreadable(string) from None


def _stdins(segs, lifted):
    """segs with each command's heredoc and here-string words taken out, and for each command in
    turn: what it reads on stdin (the text, UNKNOWN, or None if nothing on the line feeds it) and
    the lifted $(…) those words run."""
    out, feeds, output, piped = [], [], UNKNOWN, None
    for seg in segs:
        if seg[0] in SEPARATORS:  # (echo x) | sh: what ran inside a ( … ) isn't followed
            piped, output = output if seg == ["|"] else None, UNKNOWN
            out.append(seg)
            continue
        words, stdin, substituted = _redirects(seg, lifted)
        stdin = piped if stdin is None else stdin
        out.append(words or [""])  # a heredoc with no command runs no program, but its $(…) runs
        feeds.append((stdin, substituted))
        output = _output(words, stdin)
    return out, feeds


def _redirects(seg, lifted):
    """seg without its heredoc and here-string words, what the last of them feeds it on stdin,
    and the numbers of the $(…) they run."""
    words, stdin, substituted, i = [], None, [], 0
    while i < len(seg):
        word, i = seg[i], i + 1
        heredoc = HEREDOC_MARKED.fullmatch(word)
        if heredoc:
            body, quoted = lifted[int(heredoc.group(1))]
            if body is not None and not quoted:
                substituted += MARKED.findall(body)
            stdin = UNKNOWN if body is None or (not quoted and FILLED_IN.search(body)) else body
        elif word == HERE_STRING:
            value, i = (seg[i], i + 1) if i < len(seg) else ("", i)
            substituted += MARKED.findall(value)
            stdin = UNKNOWN if FILLED_IN.search(value) else value + "\n"
        else:
            words.append(word)
    return words, stdin, [int(n) for n in substituted]


def _output(words, stdin):
    """What this simple command writes to a pipe where the guard can tell: echo's words, printf's
    plain format, cat's stdin. UNKNOWN for anything else, or where the shell fills a word in."""
    i, program = program_index(words), program_name(words)
    args = words[i + 1 :]
    if program == "cat" and not args:
        return stdin
    if program == "echo":
        flags = ""
        while args and ECHO_FLAGS.match(args[0]):
            flags += args.pop(0)
        text = " ".join(args) + ("" if "n" in flags else "\n")
        text = text if "E" in flags else ansi_c_text(text)  # zsh's echo fills \n in unasked
    elif program == "printf" and len(args) == 1 and "%" not in args[0]:
        text = ansi_c_text(args[0])
    else:
        return UNKNOWN
    return UNKNOWN if FILLED_IN.search(text) else text


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
            out += [(string, True) for string in operands[:1]]
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
            while end < len(words) and not (words[end] == ";" or (words[end] == "+" and words[end - 1] == "{}")):
                end += 1
            out.append((words[i + 1 : end], FIND_RUNS[words[i]]))
            i = end
        i += 1
    return out


def runs_unknown(words):
    """True if the program this simple command runs is a variable or a $(…)."""
    return FILLED_IN.search(program_name(words)) is not None


def short_flags(arg):
    """The letters of a cluster of short options (-lc gives lc), "" for anything else."""
    return arg[1:] if SHORT_FLAGS.match(arg) else ""
