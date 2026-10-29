#!/bin/bash
# drift_gate.py's checks, through guard_bash.py: gh pr merge is refused at 10 or more merges since
# the last drift pass unless the pull request's title (a stand-in gh pr view) starts
# "refactor: drift pass"; a count or title it can't read is refused too.
. "$(dirname "$0")/helpers.sh"

repo=$tmp/gate && git init -q -b main "$repo"
commits() { # n [message]: n empty commits on main
  local i
  for ((i = 0; i < $1; i++)); do git -C "$repo" "${as_tester[@]}" commit -q --allow-empty -m "${2:-fix: x}"; done
}
# a stand-in gh: gh pr view prints $FAKE_TITLE as JSON, or fails when it is unset
mkdir "$tmp/bin" && cat > "$tmp/bin/gh" <<'EOF'
#!/bin/bash
[ -n "${FAKE_TITLE:-}" ] || { echo "no pull requests found" >&2; exit 1; }
printf '{"title":"%s"}\n' "$FAKE_TITLE"
EOF
chmod +x "$tmp/bin/gh" && export PATH="$tmp/bin:$PATH"
merge=(gh pr merge 5 --squash --delete-branch)

commits 1 "refactor: drift pass 1: x (#1)" && commits 9
check allow guard_bash.py "$(bash_in "$repo" "${merge[*]}")"  # 9 since the pass
commits 1
export FAKE_TITLE="feat: a thing"
check deny guard_bash.py "$(bash_in "$repo" "${merge[*]}")"  # 10 since, not a pass
check deny guard_bash.py "$(bash_in "$repo" 'gh pr merge --repo o/r 5 --squash')"
check deny guard_bash.py "$(bash_in "$repo" "git status && ${merge[*]}")"
says "Run the drift pass first" guard_bash.py "$(bash_in "$repo" "${merge[*]}")"
says "10 merged since" guard_bash.py "$(bash_in "$repo" "${merge[*]}")"
check allow guard_bash.py "$(bash_in "$repo" 'gh pr view 5')"  # only a merge waits
export FAKE_TITLE="refactor: drift pass 2: y"
check allow guard_bash.py "$(bash_in "$repo" "${merge[*]}")"  # the pass itself may merge
export FAKE_TITLE="docs: before the refactor: drift pass"
check deny guard_bash.py "$(bash_in "$repo" "${merge[*]}")"  # the title starts with it, not mentions it
unset FAKE_TITLE
says "can't read this pull request's title" guard_bash.py "$(bash_in "$repo" "${merge[*]}")"

# a folder where the count can't be read is refused, never let through
nomain=$tmp/gate-nomain && git init -q -b trunk "$nomain"
says "Can't count the merges since the last drift pass" guard_bash.py "$(bash_in "$nomain" "${merge[*]}")"
