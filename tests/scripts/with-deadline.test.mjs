import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

const WRAPPER = join(import.meta.dirname, "../../scripts/with-deadline.mjs");
const DEADLINE_MESSAGE = "sh ran past the 1s deadline: likely an endless loop";

let scratch;
afterEach(() => scratch && rmSync(scratch, { recursive: true, force: true }));

// Runs the wrapper and resolves with how it ended, how long it took and what it printed.
function run(args, { onSpawn } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const wrapper = spawn(process.execPath, [WRAPPER, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    wrapper.stdout.on("data", (chunk) => (output += chunk));
    wrapper.stderr.on("data", (chunk) => (output += chunk));
    onSpawn?.(wrapper);
    wrapper.on("close", (code) => resolve({ code, output, seconds: (Date.now() - started) / 1000 }));
  });
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// A killed process can take a moment to be reaped once its parent is gone.
async function waitUntilDead(pid) {
  for (let tries = 0; tries < 50 && alive(pid); tries++) await new Promise((r) => setTimeout(r, 50));
  return !alive(pid);
}

// A fresh scratch folder, removed after the test, and the file in it for a grandchild's pid.
function grandchildPidFile() {
  scratch = mkdtempSync(join(tmpdir(), "with-deadline-"));
  return join(scratch, "grandchild.pid");
}

// A shell that starts a grandchild sleeping for a minute, writes its pid, and waits on it.
function grandchildCommand(pidFile) {
  return ["sh", "-c", `sleep 60 & echo $! > '${pidFile}'; wait`];
}

test("a quick command's exit code passes through the wrapper", async () => {
  expect((await run(["5", "sh", "-c", "exit 0"])).code).toBe(0);
  expect((await run(["5", "sh", "-c", "exit 3"])).code).toBe(3);
});

test("a command that never ends is killed near the deadline, and the wrapper fails saying why", async () => {
  const { code, output, seconds } = await run(["1", "sh", "-c", "while :; do :; done"]);
  expect(code).toBe(1);
  expect(output).toContain(DEADLINE_MESSAGE);
  expect(seconds).toBeGreaterThanOrEqual(1);
  expect(seconds).toBeLessThan(5);
});

test("at the deadline the command's own children die too, not just the command", async () => {
  const pidFile = grandchildPidFile();
  const { code } = await run(["1", ...grandchildCommand(pidFile)]);
  expect(code).toBe(1);
  const grandchild = Number(readFileSync(pidFile, "utf8"));
  expect(grandchild).toBeGreaterThan(0);
  expect(await waitUntilDead(grandchild)).toBe(true);
});

test("a signal to the wrapper reaches the command's group, which sits outside the terminal's", async () => {
  const pidFile = grandchildPidFile();
  const { code, output } = await run(["30", ...grandchildCommand(pidFile)], {
    onSpawn: (wrapper) => setTimeout(() => wrapper.kill("SIGTERM"), 500),
  });
  expect(code).not.toBe(0);
  expect(output).not.toContain("deadline");
  expect(await waitUntilDead(Number(readFileSync(pidFile, "utf8")))).toBe(true);
});
