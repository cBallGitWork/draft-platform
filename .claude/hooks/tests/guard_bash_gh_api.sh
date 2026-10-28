#!/bin/bash
# guard_bash.py's gh api checks (main_writes.py): a gh api write that lands on main skips git push,
# so it is refused on its own; the same call on a feature branch, and every read, go through.
. "$(dirname "$0")/helpers.sh"

gh_api_deny=(
  'gh api -X PUT repos/o/r/contents/a.md -f message=x -f content=eA== -f branch=main'
  'gh api --method PUT repos/o/r/contents/a.md -f branch=refs/heads/main' 'gh api -XPUT repos/o/r/contents/a -fbranch=main'
  'gh api -X put /repos/o/r/contents/a.md -F branch=main' 'gh api repos/o/r/contents/a.md -X PUT --raw-field=branch=main'
  'gh api -X PUT repos/o/r/contents/a.md -f message=x'  # no branch: the default branch, main
  'gh api -X PUT repos/o/r/contents/a.md --input body.json'  # its branch can't be seen
  'gh api -X DELETE repos/o/r/contents/a.md -f sha=1 -f branch=main'
  'gh api -X PATCH repos/o/r/git/refs/heads/main -f sha=1' 'gh api -X DELETE repos/o/r/git/refs/heads/main'
  'gh api repos/o/r/git/refs -f ref=refs/heads/main -f sha=1'  # a field with no -X is a POST
  'gh api repos/o/r/merges -f base=main -f head=chore/x' 'env gh api -X POST repos/o/r/merges -f base=main'
  'git status && gh api -X PUT repos/o/r/contents/a -f branch=main'
)
gh_api_allow=(
  'gh api -X PUT repos/o/r/contents/a.md -f message=x -f branch=chore/x'
  'gh api -X PUT repos/o/r/contents/a.md -f branch=chore/main-menu'
  'gh api -X PATCH repos/o/r/git/refs/heads/chore/x -f sha=1' 'gh api repos/o/r/git/refs -f ref=refs/heads/chore/x'
  'gh api repos/o/r/merges -f base=chore/x -f head=main'  # main merged into a branch
  'gh api repos/o/r/contents/a.md' 'gh api "repos/o/r/contents/a.md?ref=main"' 'gh api repos/o/r/git/refs/heads/main'
  'gh api -X GET repos/o/r/contents/a.md -f ref=main'  # -X GET sends its fields as a query
  'gh api repos/o/r/issues/3/comments -f body=clean' 'gh api graphql -f query=x'
)
for c in "${gh_api_deny[@]}"; do check deny guard_bash.py "$(bash_cmd "$c")"; done
for c in "${gh_api_allow[@]}"; do check allow guard_bash.py "$(bash_cmd "$c")"; done
