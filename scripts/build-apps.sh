#!/bin/bash
# The apps the ui-verifier shoots in a build (claude-build.yml, the "before" command in .studio/project.json): this
# checkout's on its own port (scripts/port.mjs), which follows the builder's branch as it edits, and origin/main's in
# ../main-app, on that folder's port, for the agent's unchanged-from-main check. Started before the build because the
# headless build can't start a background server (#2162: every row came back UNVERIFIED). Vite's dev server alone,
# never Convex, as .claude/agents/ui-verifier.md says. A server that won't start costs the build nothing: the verifier
# says UNVERIFIED. Each server's pid goes in $RUNNER_TEMP, where the build's last steps stop it.
set -u
MAIN_APP="${GITHUB_WORKSPACE:-$PWD}/../main-app"
PID_DIR="${RUNNER_TEMP:-/tmp}"
export VITE_CONVEX_URL=""  # no deployment, as the smoke run (playwright.config.ts)
git worktree add --detach "$MAIN_APP" origin/main
cp -al node_modules "$MAIN_APP/node_modules"  # hard links: main's lock is the one npm ci just installed
serve() {  # serve <folder> <name>: Vite on the folder's own port, its pid and log in PID_DIR
  local port
  port=$(cd "$1" && node scripts/port.mjs)
  (cd "$1" && nohup npx vite --port "$port" --strictPort > "$PID_DIR/$2.log" 2>&1 & echo $! > "$PID_DIR/$2.pid")
  for _ in $(seq 60); do curl -sf -o /dev/null "http://localhost:$port/" && { echo "$2 app on $port"; return 0; }; sleep 1; done
  echo "::warning::The $2 app didn't answer on $port; the ui-verifier will say UNVERIFIED."; cat "$PID_DIR/$2.log"
}
serve . branch
serve "$MAIN_APP" main
