#!/bin/bash
# scripts/recorded-add-only.mjs, the add-only check on recorded feed payloads that npm run verify
# runs: in a throwaway repo whose origin/main holds two payloads, adding one passes; changing,
# deleting or renaming one fails, committed or not, unless a branch commit carries
# "Re-record: <file>: <why>" for it.
source "$(dirname "$0")/helpers.sh"

script="$hooks/../../scripts/recorded-add-only.mjs"
repo="$tmp/repo"
g() { git -C "$repo" "${as_tester[@]}" "$@" >/dev/null 2>&1; }
passes() { # what: the check exits 0 in the repo
  (cd "$repo" && node "$script" >/dev/null 2>&1) || fail "recorded-add-only: expected a pass: $1"
}
refuses() { # what: the check exits 1 in the repo
  (cd "$repo" && node "$script" >/dev/null 2>&1); [ $? -eq 1 ] || fail "recorded-add-only: expected a failure: $1"
}
fresh() { # a branch off origin/main, clean
  g checkout -q -f main && g branch -q -D work; g checkout -q -b work
}

mkdir -p "$repo/tests/support/recorded"
g init -q -b main
echo '{"a":1}' > "$repo/tests/support/recorded/a.json"
echo '{"b":1}' > "$repo/tests/support/recorded/b.json"
g add tests && g commit -q -m base && g update-ref refs/remotes/origin/main HEAD

fresh; passes "nothing changed"
fresh; echo '{"c":1}' > "$repo/tests/support/recorded/c.json"; passes "a new file, not committed"
g add tests/support/recorded/c.json && g commit -q -m "add c"; passes "a new file, committed"
fresh; echo 'x' > "$repo/other.txt"; g add other.txt && g commit -q -m other; passes "a file outside the folder"

fresh; echo '{"a":2}' > "$repo/tests/support/recorded/a.json"; refuses "a change, not committed"
g add tests && g commit -q -m "edit a"; refuses "a change, committed"
g commit -q --allow-empty -m "why" -m "Re-record: b.json: the feed changed"; refuses "a trailer for another file"
g commit -q --allow-empty -m "why" -m "Re-record: a.json:"; refuses "a trailer with no reason"
g commit -q --allow-empty -m "Re-record: a.json: in the subject, not a trailer"; refuses "no trailer, only a subject"
g commit -q --allow-empty -m "why" -m "Re-record: a.json: FPL renamed a key"; passes "a trailer by file name"

fresh; g rm -q tests/support/recorded/b.json && g commit -q -m "drop b"; refuses "a deletion"
g commit -q --allow-empty -m "why" -m "Re-record: tests/support/recorded/b.json: cut down"; passes "a trailer by path"

fresh; g mv tests/support/recorded/a.json tests/support/recorded/a2.json && g commit -q -m "rename a"
refuses "a rename"

g update-ref -d refs/remotes/origin/main
fresh; refuses "no origin/main to compare with"
