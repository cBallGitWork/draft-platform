#!/usr/bin/env node
// Runs a command with a deadline: `node scripts/with-deadline.mjs <seconds> <cmd...>`.
// A test that loops forever would otherwise hang whoever ran it. The command gets its own process
// group, so at the deadline the whole group dies (vitest's workers too), not just the command.

import { spawn } from "node:child_process";

const [seconds, command, ...args] = process.argv.slice(2);
const limit = Number(seconds);
if (!command || !(limit > 0)) {
  console.error("usage: node scripts/with-deadline.mjs <seconds> <cmd...>");
  process.exit(2);
}

const child = spawn(command, args, { detached: true, stdio: "inherit" });

function killGroup(signal) {
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    // ESRCH: the group is already gone. Anything else is worth seeing.
    if (error.code !== "ESRCH") console.error(error);
  }
}

const timer = setTimeout(() => {
  killGroup("SIGKILL");
  console.error(`${command} ran past the ${seconds}s deadline: likely an endless loop`);
  process.exit(1);
}, limit * 1000);

child.on("error", (error) => {
  clearTimeout(timer);
  console.error(`could not run ${command}: ${error.message}`);
  process.exit(1);
});

// The group is detached from the terminal's, so a Ctrl-C reaches only this process: pass it on.
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => killGroup(signal));

child.on("exit", (code) => {
  clearTimeout(timer);
  process.exit(code ?? 1); // no code means a signal ended it, which is not a pass
});
