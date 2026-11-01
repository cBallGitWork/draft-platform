#!/bin/bash
# approval_gate.py's and pr_body.py's screen checks (#947), through guard_bash.py and guard_github.py:
# gh pr create on a branch that changes a file rendering a route with an approved picture needs
# ui-verifier's signature and an Approved vs built section that matches or numbers each difference;
# gh pr merge is refused while that section numbers one, unless the pull request has the
# craig-approved label; and adding that label, by gh or a GitHub tool, is refused.
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

# the bodies: the whole template signed by pr-reviewer, then ui-verifier's block three ways
template_body | signed > "$repo/pr.md"
verifier="*Verifier: ui-verifier (sonnet), 2026-11-01, abc..def*"
filled() { # name lines...: pr.md with these lines under its Approved vs built heading
  local name=$1; shift
  printf '%s\n' "$@" > "$tmp/lines"
  sed "/^## Approved vs built/r $tmp/lines" "$repo/pr.md" > "$repo/$name"
}
filled pr-matches.md '/team: matches the approved picture' "$verifier"
filled pr-differs.md '1. Density: rows 20px, the picture 28px' '2. Columns: Form missing' "$verifier"
filled pr-unsigned.md '/team: matches the approved picture'
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
# a branch git can't diff against origin/main is refused too
git -C "$repo" update-ref -d refs/remotes/origin/main
says "Can't tell whether this branch changes a screen" guard_bash.py "$(bash_in "$repo" "$(create pr-matches.md)")"
git -C "$repo" update-ref refs/remotes/origin/main main

# the merge: a stand-in gh pr view gives $FAKE_BODY's file and $FAKE_LABELS, or fails when
# FAKE_BODY is unset (one commit on main, so the drift gate lets every merge through)
mkdir "$tmp/bin" && cat > "$tmp/bin/gh" <<'EOF'
#!/bin/bash
[ -n "${FAKE_BODY:-}" ] || { echo "no pull requests found" >&2; exit 1; }
/usr/bin/jq -nc --rawfile b "$FAKE_BODY" --argjson l "${FAKE_LABELS:-[]}" '{body:$b,labels:$l}'
EOF
chmod +x "$tmp/bin/gh" && export PATH="$tmp/bin:$PATH"
git -C "$repo" switch -q main
merge="gh pr merge 5 --squash"
export FAKE_BODY=$repo/pr-differs.md
check deny guard_bash.py "$(bash_in "$repo" "$merge")"
says "lists 2 difference(s) from the approved picture (1. Density" guard_bash.py "$(bash_in "$repo" "$merge")"
export FAKE_LABELS='[{"name":"bug"}]'
check deny guard_bash.py "$(bash_in "$repo" "$merge")"
FAKE_BODY=$repo/pr-pasted.md check deny guard_bash.py "$(bash_in "$repo" "$merge")"
export FAKE_LABELS='[{"name":"bug"},{"name":"craig-approved"}]'
check allow guard_bash.py "$(bash_in "$repo" "$merge")"  # Craig said yes
unset FAKE_LABELS
for body in pr-matches.md pr.md; do  # nothing to wait for
  export FAKE_BODY=$repo/$body
  check allow guard_bash.py "$(bash_in "$repo" "$merge")"
done
# a difference only inside a comment, or numbered under another heading, isn't listed
printf '%s\n' '## Approved vs built' '<!--' '1. an example in a comment' '-->' 'matches the approved picture' \
  '## Left for later' '1. a parked finding' > "$repo/pr-elsewhere.md"
export FAKE_BODY=$repo/pr-elsewhere.md
check allow guard_bash.py "$(bash_in "$repo" "$merge")"
unset FAKE_BODY
says "Can't read this pull request's body and labels" guard_bash.py "$(bash_in "$repo" "$merge")"

# only Craig adds the label
for c in 'gh pr edit 5 --add-label craig-approved' 'gh pr edit 5 --add-label bug,craig-approved' \
  'gh pr create --title x --body-file pr.md --label craig-approved' 'gh issue edit 5 -l craig-approved' \
  'gh api repos/o/r/issues/5/labels -f "labels[]=craig-approved"' 'git status && gh pr edit 5 --add-label=craig-approved' \
  'gh pr edit 5 --add-label Craig-Approved' 'gh api repos/o/r/issues/5/labels -f "labels[]=CRAIG-APPROVED"'; do
  check deny guard_bash.py "$(bash_in "$repo" "$c")"
done
says "Only Craig adds the craig-approved label" guard_bash.py "$(bash_in "$repo" 'gh pr edit 5 --add-label craig-approved')"
for c in 'gh pr edit 5 --add-label bug' 'gh pr list --label craig-approved' 'gh pr edit 5 --remove-label craig-approved' \
  'gh pr edit 5 --title craig-approved'; do
  check allow guard_bash.py "$(bash_in "$repo" "$c")"
done
export DRAFT_PRIVATE_WORDS_LIST=acmecorp
check deny guard_github.py "$(gh_call issue_write '{"method":"update","issue_number":5,"labels":["craig-approved"]}')"
check deny guard_github.py "$(gh_call add_labels '{"issue_number":5,"labels":"craig-approved"}')"
check deny guard_github.py "$(gh_call issue_write '{"method":"update","issue_number":5,"labels":["Craig-Approved"]}')"
check allow guard_github.py "$(gh_call issue_write '{"method":"update","issue_number":5,"labels":["bug"]}')"

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
