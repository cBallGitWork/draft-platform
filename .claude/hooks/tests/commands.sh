#!/bin/bash
# commands.py's checks, run straight on it (with parsing.py, stdin_reading.py and where.py), so the
# shared reading of a command line is tested in Forge, apart from any project's guard: each case
# names a command the line runs (or must not), and the folder it runs in where that matters.
. "$(dirname "$0")/helpers.sh"

mkdir -p "$tmp/sub"
out=$(cd "$hooks" && python3 - "$tmp" <<'EOF'
import sys
from commands import commands, Unbalanced, Unreadable

root = sys.argv[1]
sub = f"{root}/sub"
failed = 0


def runs(line, words, folder=root, expect=True):
    """Whether reading line from root finds words run in folder (None: a folder it can't be sure of)."""
    global failed
    found = (words, folder) in [(w, f) for w, f in commands(line, root)]
    if found != expect:
        print(f"FAIL commands.py: {line!r} {'should' if expect else 'should not'} run {words} in {folder}: {commands(line, root)}")
        failed += 1


GIT = ["git", "commit", "-m", "x"]
# a command inside a string a shell, eval or env -S runs, or inside $(…) and `…`, is still read
for line in ['sh -c "git commit -m x"', "bash -lc 'git commit -m x'", 'eval "git commit -m x"',
             "env -S 'git commit -m x'", 'echo "$(git commit -m x)"', "echo `git commit -m x`",
             "bash -o pipefail -c 'git commit -m x'", "bash -c -- 'git commit -m x'"]:
    runs(line, GIT)
# what a pipe, heredoc or here-string feeds a shell is read as commands
for line in ["echo git commit -m x | sh", "bash <<'EOF'\ngit commit -m x\nEOF", "sh <<< 'git commit -m x'"]:
    runs(line, GIT)
# an unquoted heredoc runs its $(…); a quoted one, single quotes and a comment run nothing
runs("cat <<EOF\n$(git commit -m x)\nEOF", GIT)
for line in ["cat <<'EOF'\n$(git commit -m x)\nEOF", "echo '$(git commit -m x)'", "echo hi # $(git commit -m x)"]:
    runs(line, GIT, expect=False)
# $'…' is read as the shell reads it
for line in ["git $'\\x63ommit' -m x", "git $'\\143ommit' -m x", "git $'\\u0063ommit' -m x"]:
    runs(line, GIT)
# a cd moves the folder; one inside a string counts only inside it; one the reader can't follow leaves it unsure
runs("cd sub && git commit -m x", GIT, sub)
runs('sh -c "cd sub" && git commit -m x', GIT, root)
runs('sh -c "cd sub && git commit -m x"', GIT, sub)
for line in ['eval "cd .."; git commit -m x', "pushd sub; git commit -m x", 'cd "$X" && git commit -m x']:
    runs(line, GIT, None)
# a command run on another host or by another user's shell is read, its folder unsure
runs("ssh host git commit -m x", GIT, None)
# a line whose quotes don't balance is refused, never half read
try:
    commands('echo "x', root)
    print("FAIL commands.py: an unbalanced quote was read")
    failed += 1
except (Unbalanced, Unreadable):
    pass
sys.exit(1 if failed else 0)
EOF
) || fail "commands.py: wrong readings"
[ -z "$out" ] || echo "$out"
