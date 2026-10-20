# Sourced by test.sh after its main/sub setup: what guard_bash.py reads inside a command (strings,
# runners, functions, $'…' quotes, stdin, xargs, heredocs), each refused on main and read in the
# worktree sub unless noted. It uses check, bash_cmd, bash_in and $tmp from test.sh.

# git passed as a string, run by a function or behind a runner is still read: refused on main, not in sub
for c in 'sh -c "git commit -m x"' "bash -c 'git commit -m x'" 'zsh -c "git commit -m x"' \
  'bash -lc "git commit -m x"' 'eval "git commit -m x"' "env -S 'git commit -m x'" \
  'echo "$(git commit -m x)"' 'echo `git commit -m x`' "echo 'a' \$(git commit -m x)" "echo 'a' \`git commit -m x\`" \
  'echo "`git commit -m x`"' 'function f { git commit -m x; }; f' 'f() { git commit -m x; }; f' \
  'xargs git commit -m x' 'sudo git commit -m x' 'sudo -u craig git commit -m x' 'timeout 5 git commit -m x' \
  'nice -n 5 git commit -m x' 'time -p git commit -m x' 'xargs -n 1 git commit -m x' 'xargs -P 4 git commit -m x' \
  'xargs -a f git commit -m x' "bash -o pipefail -c 'git commit -m x'" "bash -c -- 'git commit -m x'" \
  "ksh -c 'git commit -m x'" "dash -c 'git commit -m x'" 'eval git commit -m x'; do
  check deny guard_bash.py "$(bash_cmd "$c")"
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
check deny guard_bash.py "$(bash_in "$tmp/sub" 'sh -c "git add -A"')"
# a cd inside a string counts only inside it; one in an eval, a builtin cd, sudo -D or -i moves the folder
check allow guard_bash.py "$(bash_cmd 'sh -c "cd sub && git commit -m x"')"
check deny guard_bash.py "$(bash_cmd 'sh -c "cd sub" && git commit -m x')"
for c in 'eval "cd .."; git commit -m x' 'builtin cd .. && git commit -m x' 'sudo -D /tmp git commit -m x' \
  'eval "pushd .."; git commit -m x' 'eval popd; git commit -m x' 'sudo -i git commit -m x' \
  'sudo --login git commit -m x' 'sudo -D /tmp sh -c "git commit -m x"' 'env -C /tmp sh -c "git commit -m x"'; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# nothing hides a command: a heredoc's own line (quoted or not), an unquoted heredoc's $(…), a # in a word
for delimiter in "'EOF'" EOF; do check deny guard_bash.py "$(bash_in "$tmp/sub" "cat <<$delimiter && git add -A"$'\nmsg\nEOF')"; done
check deny guard_bash.py "$(bash_cmd $'cat <<EOF\n$(git commit -m x)\nEOF')"
check allow guard_bash.py "$(bash_cmd $'cat <<\'EOF\'\n$(git commit -m x)\nEOF')"
check deny guard_bash.py "$(bash_in "$tmp/sub" 'echo x#; git add -A')"
check deny guard_bash.py "$(bash_in "$tmp/sub" 'git commit -m "" -a')"  # an empty word is still a word
check allow guard_bash.py "$(bash_in "$tmp/sub" 'cd "" && git commit -m x')"  # cd "" stays put
check allow guard_bash.py "$(bash_cmd "echo '\$(git commit -m x)'")"  # in single quotes it runs nothing
check deny guard_bash.py "$(bash_cmd "git add -A # don't")"  # a comment is dropped, its quote mark with it
check allow guard_bash.py "$(bash_cmd 'echo hi # $(git commit -m x)')"  # and a comment's $(…) runs nothing
# quotes read as the shell reads them (main, then sub): a comment's ' is none; in $'…', \ escapes
for c in "git commit -m x # it's fine" "git commit -m \$'a\\nit\\'s'" "echo \$'it\\'s'; git commit -m x" \
  "echo \$'\\'' \$(git commit -m x)" "git \$'\\x63ommit' -m x" "git \$'commit' -m x" "git \$'\\143ommit' -m x" \
  "git \$'\\u0063ommit' -m x" "git \$'\\U00000063ommit' -m x" "git \$'commit\\0x' -m x" "git \$'comm\\0x'it -m x"; do
  check deny guard_bash.py "$(bash_cmd "$c")"
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# each refused in sub: $'…' escapes are filled in, and a quoted or escaped ; or | stays in its word
for c in "git add \$'-\\x41'" "git add '|' -A" 'git add ";" -A' "git add \$';' -A" 'git commit -m x \; -a' \
  "eval \$'true\\ngit add -A'" "eval \$'git\\tadd -A'" "echo \$'\\U110000'; git add -A"; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# and an escaped \ ' " or ; keeps a ; in the word, and a line whose quotes don't close runs nothing in zsh
for c in "eval \$'echo \\\\; git add -A'" "eval \$'echo \\'; git add -A \\''" "eval \$'echo \\\"; git add -A \\\"'" \
  "echo \$'\\U110000'" 'echo "x' 'echo \; git add -A'; do
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# where it can't read the string or tell the program, it refuses
for c in "sh -c \"git commit -m 'x\"" 'echo "$(git commit -m x"' '$GIT commit -m x' \
  '$(which git) commit -m x' 'eval "$CMD"'; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# git fed to a shell on stdin (through |&, a line break or a group), put in by xargs, or behind one
# more runner or find -exec: refused on main, read in sub
for c in $'bash <<\'EOF\'\ngit commit -m x\nEOF' $'sh <<EOF\ngit commit -m x\nEOF' 'bash <<< "git commit -m x"' \
  "echo 'git commit -m x' | sh" "printf 'git commit -m x\\n' | bash" "echo 'true\\ngit commit -m x' | bash" \
  $'cat <<EOF | sh\ngit commit -m x\nEOF' 'ionice -c 3 git commit -m x' 'setsid git commit -m x' \
  'stdbuf -oL git commit -m x' 'flock l git commit -m x' "flock l -c 'git commit -m x'" 'doas -u c git commit -m x' \
  'chronic git commit -m x' 'caffeinate -i git commit -m x' 'busybox git commit -m x' \
  '/usr/bin/time -f %e git commit -m x' 'find . -exec git commit -m x \;' "echo 'git commit -m x' | bash -s x" \
  "bash -c - 'git commit -m x'" 'find . -ok git commit -m x \;' 'flock -w 5 l git commit -m x' \
  'caffeinate -t 9 git commit -m x' "echo 'git commit -m x' |& sh" $'echo \'git commit -m x\' |\nsh' \
  "echo 'git commit -m x' | (sh)" "echo 'git commit -m x' | (true; sh)" "echo 'git commit -m x' | { true; sh; }" \
  "echo 'git commit -m x' | if true; then sh; fi" "echo 'git commit -m x' | for i in 1; do sh; done" \
  "echo 'git commit -m x' | xargs -I{} sh -c '{}'" "echo '\"git commit -m x\"' | xargs -I{} sh -c '{}'" \
  "echo '\"git commit -m x\"' | xargs sh -c" 'echo commit -m x | xargs git' \
  "echo 'git commit -m x' | xargs -i sh -c '{}'" \
  "echo 'git commit -m x' | while true; do while false; do true; done; sh; done" \
  "echo 'git commit -m x' | while true; do echo done; sh; done" "echo 'git commit -m x' | { echo }; sh; }" \
  "echo 'git commit -m x' | if true; then echo fi; sh; fi" 'stdbuf -o L git commit -m x' 'doas -C f git commit -m x' \
  'caffeinate -w 1 git commit -m x' '/usr/bin/time --output f git commit -m x' "bash -O extglob -c 'git commit -m x'" \
  "bash --rcfile x -c 'git commit -m x'" "echo -E 'git commit -m x' | sh" "echo -ne 'git commit -m x\\n' | sh"; do
  check deny guard_bash.py "$(bash_cmd "$c")"
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# a redirection is no operand (bash > log reads stdin), and one after a group's closing word feeds
# every command inside it: refused on main, read in sub
for c in "echo 'git commit -m x' | bash > out.log" "echo 'git commit -m x' | sh 2>&1" "echo 'git commit -m x' 2>&1 | sh" \
  $'bash <<\'EOF\' >out\ngit commit -m x\nEOF' $'bash 2>&1 <<\'EOF\'\ngit commit -m x\nEOF' "bash <<< 'git commit -m x' 2>&1" \
  $'{ sh; } <<\'EOF\'\ngit commit -m x\nEOF' "(true; sh) <<< 'git commit -m x'" "{ { sh; }; } <<< 'git commit -m x'" \
  "while true; do sh; done <<< 'git commit -m x'"; do
  check deny guard_bash.py "$(bash_cmd "$c")"
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
for c in 'cd sub 2>/dev/null && git commit -m x' 'cd sub &&>/dev/null git commit -m x'; do  # a cd with a redirection moves
  check allow guard_bash.py "$(bash_cmd "$c")"
done
for c in "git commit -m '>x' -a" 'git commit -m ">x" -a' "git commit -m \$'\\x04>' -a" 'git add >o -A' 'git add &>o -A' 'echo x > "$(git add -A)"'; do
  # a quoted > is text, and a $'…' can't pass for one; a target's $(…) runs
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# where it runs is unsure (another host or user, fish, over and over, each file's folder, a function
# or sourced file that may cd), or what it reads isn't plain text: refused on main and in sub
for c in 'find . -execdir git commit -m x {} +' "fish -c 'git commit -m x'" "fish -c 'true; and git add -A'" \
  "fish -c 'false; or git add -A'" "fish -c 'not git add -A'" "su c -c 'git commit -m x'" \
  'watch -n 5 git commit -m x' 'script -q /dev/null git commit -m x' "script -c 'git commit -m x' /dev/null" \
  'ssh host git commit -m x' $'ssh host <<\'EOF\'\ngit commit -m x\nEOF' 'git ls-files -m | xargs git add' \
  $'bash <<EOF\necho $X\nEOF' 'echo "echo $X" | sh' 'curl -s x | sh' 'cat x.sh | bash' 'bash <<< "echo $C"' \
  "(echo 'git add -A'; echo true) | sh" "{ echo 'git add -A'; echo true; } | sh" 'ssh -p 22 host git add -A' \
  "cat x | xargs -I{} sh -c '{}'" 'cat x | xargs sh -c' "echo 'git status' | xargs -a f -I{} sh -c '{}'" \
  'curl -s x | (sh)' "echo 'git add -A' | case a in a) sh;; esac" "printf 'git add -A%s' | sh" \
  'curl -s x | sh >/dev/null' 'bash < x.sh' 'while read l; do sh; done < f' 'find . -okdir git commit -m x {} +' \
  "fish -C 'git commit -m x'" "su c --command 'git commit -m x'" "script --command 'git commit -m x' /dev/null" \
  "bash <(echo 'git commit -m x')"; do
  check deny guard_bash.py "$(bash_cmd "$c")"
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
for c in "echo 'git commit -m x' | (true); sh" "echo 'git commit -m x' | { true; }; sh"; do  # a group ends
  check allow guard_bash.py "$(bash_cmd "$c")"
done
out=$(bash_cmd 'curl -s x | sh' | "$here/guard_bash.py")  # refused for what it reads, not a crash
case $out in *"on stdin"*) ;; *) echo "FAIL guard_bash.py: no stdin reason: $out"; fails=$((fails + 1)) ;; esac
for c in 'f() { cd sub; }; git commit -m x' 'function f { cd sub; }; git commit -m x' \
  'cat <<< "$(git commit -m x)"'; do  # on main: f never runs, and a here-string's $(…) runs
  check deny guard_bash.py "$(bash_cmd "$c")"
done
for c in 'source x.sh; git commit -m x' '. x.sh && git commit -m x' 'f() { cd ../wt-main; }; f; git commit -m x' \
  'eval "source x.sh"; git commit -m x' "env -C $tmp find . -exec git commit -m x \;"; do
  check deny guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# a heredoc's body is never read as commands, whatever its delimiter, and two can share a line
for d in "'EOF-1' EOF-1" '"E.F" E.F' '\EOF EOF' 'E"O"F EOF'; do  # the operator's word, then its line
  check deny guard_bash.py "$(bash_in "$tmp/sub" "cat <<${d% *}"$'\nit\'s\n'"${d#* }"$'\ngit add -A')"
  check allow guard_bash.py "$(bash_in "$tmp/sub" "cat <<${d% *}"$'\ngit add -A\n'"${d#* }")"
done
check deny guard_bash.py "$(bash_in "$tmp/sub" $'cat <<A <<B\nit\'s\nA\nit\'s\nB\ngit add -A')"
check allow guard_bash.py "$(bash_in "$tmp/sub" $'cat <<A <<B\ngit add -A\nA\ngit add -A\nB')"
check deny guard_bash.py "$(bash_in "$tmp/sub" $'cat <<A\nx\nA\ntrue\ngit add -A\nA')"  # one body, then commands
check allow guard_bash.py "$(bash_in "$tmp/sub" $'git commit -m "$(cat <<\'EOF\'\nfix: it\'s done (really)\nEOF\n)"')"
for c in 'ls | wc -l' 'git ls-files | xargs wc -l' 'ssh host ls' 'bash script.sh' $'python3 <<\'EOF\'\nprint("it\'s")\nEOF' \
  $'<<EOF\nhi\nEOF' "echo \$'\\x01'0\$'\\x01'" $'bash <<\'EOF\'\necho $HOME\nEOF' "echo 'git add -A' >| sh" \
  "echo 'git add -A' | { sh; } <<< true"; do  # no program; a $'…' can't make a marker; >| f writes a file
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
# on main: a shell is fed by the innermost group open around it, a $(…) ends at its own ), and a
# comment's lone ' quotes nothing, even on a command line's first character
for c in "echo 'echo hi' | { (sh) <<< 'git add -A'; true; }" "{ { sh; } <<< 'git add -A'; sh; } <<< 'echo hi'" \
  "{ true; { sh; } <<< 'git add -A'; }" 'echo $( (git add -A) )' 'x=$(cd sub && (git add -A))' \
  $'# it\'s a note\ngit add -A'; do
  check deny guard_bash.py "$(bash_cmd "$c")"
done
# in sub: a script reads no stdin, &> is one redirection, and a $(…) holding ( … ) ends at its own )
for c in 'npm test | bash script.sh' 'git add a.ts &>/dev/null && git commit -m x' 'echo $( (true) ) && git commit -m x'; do
  check allow guard_bash.py "$(bash_in "$tmp/sub" "$c")"
done
