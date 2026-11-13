#!/bin/bash
# approval_gate.py's and pr_body.py's screen checks (#947), through guard_bash.py and guard_github.py:
# gh pr create on a branch that changes a file rendering a route with an approved picture needs
# ui-verifier's signature and an Approved vs built section that matches or numbers each difference;
# gh pr merge is never held by it (Craig, 7 Nov 2026: layout waits for the UI reskin), and the
# look-approved check passes, listing the layout differences.
. "$(dirname "$0")/helpers.sh"

# a small app: /team's route hands it TeamPage, which imports a table; /other renders OtherPage
repo=$tmp/app && mkdir -p "$repo/docs/design/approved/team" "$repo/src/routes" "$repo/src/frame" \
  "$repo/src/team" "$repo/src/other" "$repo/src/ui"
printf '# Team\n\nRoute: `/team`, checked on `/team?preview=manager`.\n' > "$repo/docs/design/approved/team/README.md"
printf 'export const TEAM_PATH = "/team";\nexport const TEAM_SQUAD_PATH = `${TEAM_PATH}/squad`;\nexport const OTHER_PATH = "/other";\n' \
  > "$repo/src/frame/menu.ts"
cat > "$repo/src/routes/frame.tsx" <<'EOF'
import { createRoute, redirect } from "@tanstack/react-router";
import { OTHER_PATH, TEAM_PATH } from "../frame/menu";
import { OtherPage } from "../other/OtherPage";
import { TeamPage } from "../team/TeamPage";
import { rootRoute } from "./root";

const landingRoute = createRoute({
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: TEAM_PATH });
  },
});
const teamRoute = leaguePage(TEAM_PATH, "team", TeamPage);
const otherRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: OTHER_PATH,
  component: OtherPage,
});
EOF
printf 'export const rootRoute = 1;\n' > "$repo/src/routes/root.tsx"
printf 'import { Table } from "./Table";\nimport type { Seam } from "./seam";\nexport function TeamPage() {}\n' > "$repo/src/team/TeamPage.tsx"
printf 'export function Table() {}\n' > "$repo/src/team/Table.tsx"
printf 'export type Seam = 1;\n' > "$repo/src/team/seam.ts"
printf 'export function OtherPage() {}\n' > "$repo/src/other/OtherPage.tsx"
printf 'import "./styles.css";\n' > "$repo/src/main.tsx"
printf '@import "tailwindcss";\n@import "./ui/controls.css";\n' > "$repo/src/styles.css"
printf '.x {}\n' > "$repo/src/ui/controls.css"
git init -q -b main "$repo" && git -C "$repo" add docs src && git -C "$repo" "${as_tester[@]}" commit -q -m start
git -C "$repo" update-ref refs/remotes/origin/main HEAD

# the bodies: the whole template with an empty Approved vs built section, then ui-verifier's block several ways
{ template_body; printf '\n## Approved vs built\n'; } > "$repo/pr.md"
verifier="*Verifier: ui-verifier (sonnet), 2026-11-01, abc..def*"
filled() { # name lines...: pr.md with these lines under its Approved vs built heading
  local name=$1; shift
  printf '%s\n' "$@" > "$tmp/lines"
  sed "/^## Approved vs built/r $tmp/lines" "$repo/pr.md" > "$repo/$name"
}
filled pr-matches.md '/team: matches the approved picture' "$verifier"
filled pr-differs.md '1. Density: rows 20px, the picture 28px' '2. Columns: Form missing' "$verifier"
filled pr-unsigned.md '/team: matches the approved picture'
filled pr-unchanged.md '/team: unchanged from main' "$verifier"
filled pr-says-nothing.md 'looked fine' "$verifier"
filled pr-pasted.md '## Approved vs built' '1. Columns: Form missing' "$verifier"  # the block, heading and all
create() { echo "gh pr create --title x --body-file $1"; }
on_branch() { # name file: a branch off main changing that file
  git -C "$repo" switch -q -C "$1" main && printf '// changed\n' >> "$repo/$2"
  git -C "$repo" add "$2" && git -C "$repo" "${as_tester[@]}" commit -q -m "$1"
}

# a branch changing a file /team's page imports must carry ui-verifier's block
on_branch screen src/team/Table.tsx
for body in pr.md pr-unsigned.md pr-says-nothing.md; do
  check deny guard_bash.py "$(bash_in "$repo" "$(create "$body")")"
done
says "changes a screen with an approved picture: /team (src/team/Table.tsx)" guard_bash.py "$(bash_in "$repo" "$(create pr.md)")"
check allow guard_bash.py "$(bash_in "$repo" "$(create pr-matches.md)")"
check allow guard_bash.py "$(bash_in "$repo" "$(create pr-unchanged.md)")"  # shot identical to main's
check allow guard_bash.py "$(bash_in "$repo" "$(create pr-differs.md)")"  # opens; the merge waits
check allow guard_bash.py "$(bash_in "$repo" "$(create pr-pasted.md)")"
check allow guard_bash.py "$(bash_in "$repo" 'gh pr edit 3 --body-file pr.md')"  # create only
# the global stylesheets draw every screen
on_branch css src/ui/controls.css
check deny guard_bash.py "$(bash_in "$repo" "$(create pr.md)")"
# a page with no picture, a type the page only imports as a type, and a file outside src/ don't
for path in src/other/OtherPage.tsx src/team/seam.ts docs/design/approved/team/README.md; do
  on_branch "elsewhere-$(basename "$path")" "$path"
  check allow guard_bash.py "$(bash_in "$repo" "$(create pr.md)")"
done
# a Route: line the guard can't trace to a page is refused, never passed as untouched
mkdir -p "$repo/docs/design/approved/gone" && printf 'Route: `/gone`\n' > "$repo/docs/design/approved/gone/README.md"
on_branch traced src/team/Table.tsx
says "can't trace which files under src/ render /gone" guard_bash.py "$(bash_in "$repo" "$(create pr-matches.md)")"
rm -r "$repo/docs/design/approved/gone"
# a Routes: paragraph guards each route it names, over its lines; a path holding a ? is the preview (#1721)
both=$repo/docs/design/approved/both && mkdir -p "$both"
printf 'Routes: `/team` and\n`/other`, checked on `/other?preview=manager`.\n' > "$both/README.md"
on_branch several src/other/OtherPage.tsx
says "changes a screen with an approved picture: /other (src/other/OtherPage.tsx)" guard_bash.py "$(bash_in "$repo" "$(create pr.md)")"
# a README saved with CRLF line endings is read as LF (Python's text mode), so its paragraph still ends at its blank line
printf 'Route: `/other`.\r\n\r\nIts button opens `/gone`.\r\n' > "$both/README.md"
says "changes a screen with an approved picture: /other (src/other/OtherPage.tsx)" guard_bash.py "$(bash_in "$repo" "$(create pr.md)")"
# a folder whose README names no route, or that has none, is refused, never passed as no screen
printf '# Both\n\nRoute: the Both tab, `spec/12`.\n' > "$both/README.md"
says "can't read which routes docs/design/approved/both/ shows" guard_bash.py "$(bash_in "$repo" "$(create pr-matches.md)")"
rm "$both/README.md"
says "can't read which routes docs/design/approved/both/ shows" guard_bash.py "$(bash_in "$repo" "$(create pr-matches.md)")"
# a picture approved before its screen is built says so, and guards nothing yet
printf 'Route: none yet. The slice that builds it names it.\n' > "$both/README.md"
check allow guard_bash.py "$(bash_in "$repo" "$(create pr.md)")"
rm -r "$both"
# a branch git can't diff against origin/main is refused too
git -C "$repo" update-ref -d refs/remotes/origin/main
says "Can't tell whether this branch changes a screen" guard_bash.py "$(bash_in "$repo" "$(create pr-matches.md)")"
git -C "$repo" update-ref refs/remotes/origin/main main

# the merge: no difference from an approved picture holds it (Craig, 7 Nov 2026: layout waits for the
# UI reskin), by gh or the GitHub tool, label or none; --admin is still refused
stand_in_gh <<'EOF2'
echo "stand-in gh: no answer for $*" >&2; exit 1
EOF2
tool=$("$jq" -nc --arg d "$repo" '{tool_name:"mcp__github__merge_pull_request",tool_input:{owner:"o",repo:"r",pullNumber:5},cwd:$d}')
git -C "$repo" switch -q main
check allow guard_bash.py "$(bash_in "$repo" "gh pr merge 5 --squash")"
check allow guard_github.py "$tool"
# gh pr merge with no number merges the branch's pull request: one open on it is named, none or two can't be
git -C "$repo" switch -q -c feat/x
check allow guard_bash.py "$(bash_in "$repo" "gh pr merge --squash")"
FAKE_OPEN_PRS='[]' says "no single open pull request has the branch feat/x" guard_bash.py "$(bash_in "$repo" "gh pr merge --squash")"
FAKE_OPEN_PRS='[{"number":5,"head":{"ref":"feat/x"}},{"number":6,"head":{"ref":"feat/x"}}]' \
  says "no single open pull request has the branch feat/x" guard_bash.py "$(bash_in "$repo" "gh pr merge --squash")"
git -C "$repo" switch -q main
says "bypasses the main ruleset" guard_bash.py "$(bash_in "$repo" "gh pr merge 5 --squash --admin")"
# a write to gh api's merge endpoint is the same admin merge with none of gh pr merge's checks (#1075)
for merge in "gh api -X PUT repos/o/r/pulls/5/merge" "gh api --method=put /repos/{owner}/{repo}/pulls/5/merge -f merge_method=squash" \
  "gh -R o/r api -XPUT repos/o/r/pulls/5/merge" "cd /x && gh api --method PUT https://api.github.com/repos/o/r/pulls/5/merge" \
  'gh api -X "$M" repos/o/r/pulls/5/merge'; do
  check deny guard_bash.py "$(bash_in "$repo" "$merge")"
done
says "gh api's merge endpoint" guard_bash.py "$(bash_in "$repo" "gh api -X PUT repos/o/r/pulls/5/merge")"
for read in "gh api repos/o/r/pulls/5/merge" "gh api -X GET repos/o/r/pulls/5/merge" "gh api -X PATCH repos/o/r/pulls/5 -f body=x" \
  "gh api repos/o/r/pulls/5 --jq .merged" 'echo "gh api -X PUT repos/o/r/pulls/5/merge"'; do
  check allow guard_bash.py "$(bash_in "$repo" "$read")"
done
# so is a GraphQL merge or auto-merge through gh api graphql, or a query the hook can't read (#2057); a read passes
for merge in "gh api graphql -f query='mutation{mergePullRequest(input:{pullRequestId:\"x\"}){clientMutationId}}'" \
  "gh api graphql -f 'query=mutation { enablePullRequestAutoMerge(input:{pullRequestId:\"x\"}) { clientMutationId } }'" \
  "cd /x && gh -R o/r api graphql --raw-field=query='mutation{mergePullRequest(input:{}){clientMutationId}}'" \
  "gh api graphql -F query=@merge.graphql" "gh api graphql --input q.json" \
  "gh api /graphql -f query='mutation{mergePullRequest(input:{}){clientMutationId}}'" \
  "gh api https://api.github.com/graphql/ -f query='mutation{enablePullRequestAutoMerge(input:{}){clientMutationId}}'" \
  'gh api graphql -f query="$(cat merge.graphql)"' 'gh api graphql -f query=$Q' 'gh api graphql -f query="${Q}"'; do
  check deny guard_bash.py "$(bash_in "$repo" "$merge")"
done
says "gh api graphql" guard_bash.py "$(bash_in "$repo" "gh api graphql -f query='mutation{mergePullRequest(input:{}){clientMutationId}}'")"
for read in "gh api graphql -f query='query{viewer{login}}'" "gh api graphql -f query='query(\$o:String!){repository(owner:\$o,name:\"r\"){id}}' -F o=x" \
  'echo "gh api graphql -f query=mutation{mergePullRequest}"'; do
  check allow guard_bash.py "$(bash_in "$repo" "$read")"
done

# this repo's own routes trace to their pages and the stylesheets, so a rename in src/routes/ that
# loses a page fails here rather than letting its changes pass as no screen
traced() { # route: the files that render it in this repo, one a line
  (cd "$hooks" && python3 -c 'import sys, screen_routes as s; print("\n".join(sorted(s.files_rendering(sys.argv[1], sys.argv[2]))))' \
    "$1" "$hooks/../..")
}
for row in '/team|src/myTeam/tactics/TacticsPage.tsx' '/team/squad|src/myTeam/SquadPage.tsx'; do
  route=${row%%|*} page=${row#*|}
  found=$(traced "$route")
  for file in "$page" src/styles.css src/ui/controls.css; do
    printf '%s\n' "$found" | grep -qx "$file" || fail "screen_routes.py: $route doesn't trace to $file"
  done
done
if traced /team | grep -qx src/myTeam/SquadPage.tsx; then fail "screen_routes.py: /team traces to the Squad tab's page"; fi
# every folder in this repo's docs/design/approved/ names its routes and each traces, so a README naming none,
# or a route src/routes/ doesn't have, fails here rather than at the next gh pr create (#1721)
(cd "$hooks" && python3 -c 'import sys, screen_routes as s; c = s.path_constants(sys.argv[1]); [s.files_rendering(r, sys.argv[1], c) for r in s.approved_routes(sys.argv[1])]' \
  "$hooks/../..") || fail "screen_routes.py: an approved folder in this repo names no route, or one that doesn't trace"

# the same as look-gate.yml's look-approved check: approval_gate.py run on the event GitHub hands
# the job passes whatever the differences, listing the layout ones, and exits 1 only on an event
# it can't read (never a silent pass)
gate_on() { # expected-exit body-file: approval_gate.py on an event holding that body
  local want=$1 body=$2 got
  $jq -n --rawfile body "$body" '{pull_request: {body: $body, labels: []}}' > "$tmp/event.json"
  GITHUB_EVENT_PATH=$tmp/event.json python3 "$hooks/approval_gate.py" > "$tmp/gate.out" 2>&1; got=$?
  [ "$got" -eq "$want" ] || fail "approval_gate.py as the check: expected exit $want, got $got: $body"
}
for body in pr-differs.md pr-pasted.md pr-matches.md pr.md; do gate_on 0 "$repo/$body"; done
gate_on 0 "$repo/pr-differs.md"
grep -q "1 layout difference(s) from the approved picture, left for the UI reskin" "$tmp/gate.out" \
  || fail "approval_gate.py as the check: doesn't list the layout difference: $(cat "$tmp/gate.out")"
printf 'not json' > "$tmp/event.json"
if GITHUB_EVENT_PATH=$tmp/event.json python3 "$hooks/approval_gate.py" > /dev/null 2>&1; then
  fail "approval_gate.py as the check: passed an event it can't read"
fi
if env -u GITHUB_EVENT_PATH python3 "$hooks/approval_gate.py" > /dev/null 2>&1; then
  fail "approval_gate.py as the check: passed with no event"
fi
