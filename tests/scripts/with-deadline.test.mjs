import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";
import { scratchDir } from "../support/scripts/scratchDir.mjs";

const WRAPPER = join(REPO_ROOT, "scripts/with-deadline.mjs");
const DEADLINE_MESSAGE = "sh ran past the 1s deadline: likely an endless loop";
// How often the polls below look again, and how long each waits before giving up.
const POLL_INTERVAL_MS = 50;
const DEATH_WAIT_MS = 2_500;
// Generous, so a slow runner still gets there; the signal test's own timeout below allows for it.
const PID_FILE_WAIT_MS = 10_000;
// Time allowed for the wrapper to exit once signalled, and for its output to close once it has
// exited. The signal test's timeout is twice every wait it can sit through (coverage about doubles
// test time), so each stuck step fails with its own message, not vitest's generic timeout (#2034).
const WRAPPER_EXIT_ALLOWANCE_MS = 2_500;
const WRAPPER_CLOSE_ALLOWANCE_MS = 2_500;
const SIGNAL_TEST_TIMEOUT_MS =
  2 * (PID_FILE_WAIT_MS + WRAPPER_EXIT_ALLOWANCE_MS + WRAPPER_CLOSE_ALLOWANCE_MS + DEATH_WAIT_MS);

// Runs the wrapper and resolves with how it ended, how long it took and what it printed. Its output
// closes only once everything the command started has let go of it, so that wait is bounded: a
// process outliving the wrapper fails saying so, rather than holding the test until it ends.
function run(args, { onSpawn } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const wrapper = spawn(process.execPath, [WRAPPER, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let stuck;
    wrapper.stdout.on("data", (chunk) => (output += chunk));
    wrapper.stderr.on("data", (chunk) => (output += chunk));
    onSpawn?.(wrapper);
    wrapper.on("exit", (code) => {
      stuck = setTimeout(
        () => reject(new Error(`the wrapper exited (code ${code}) but its output was still open ${WRAPPER_CLOSE_ALLOWANCE_MS}ms later: a process it started outlived it`)),
        WRAPPER_CLOSE_ALLOWANCE_MS,
      );
    });
    wrapper.on("close", (code) => {
      clearTimeout(stuck);
      resolve({ code, output, seconds: (Date.now() - started) / 1000 });
    });
  });
}

const running = (child) => child.exitCode === null && child.signalCode === null;

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const pause = () => new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

// A killed process can take a moment to be reaped once its parent is gone.
async function waitUntilDead(pid) {
  const giveUpAt = Date.now() + DEATH_WAIT_MS;
  while (Date.now() < giveUpAt && alive(pid)) await pause();
  return !alive(pid);
}

// The pid in a file, or 0 while the file is missing or not yet a whole positive number.
function readPid(pidFile) {
  if (!existsSync(pidFile)) return 0;
  const pid = Number(readFileSync(pidFile, "utf8"));
  return Number.isInteger(pid) && pid > 0 ? pid : 0;
}

// Resolves with the pid once the shell has written it, or fails saying it never came.
async function waitForPid(pidFile) {
  const giveUpAt = Date.now() + PID_FILE_WAIT_MS;
  while (Date.now() < giveUpAt) {
    const pid = readPid(pidFile);
    if (pid > 0) return pid;
    await pause();
  }
  throw new Error(`no pid in ${pidFile} after ${PID_FILE_WAIT_MS}ms`);
}

// A fresh scratch folder, removed after the test, and the file in it for a grandchild's pid.
function grandchildPidFile() {
  return join(scratchDir("with-deadline-"), "grandchild.pid");
}

// A shell that starts a grandchild sleeping for a minute, writes its pid, and waits on it.
function grandchildCommand(pidFile) {
  return ["sh", "-c", `sleep 60 & echo $! > '${pidFile}'; wait`];
}

test("a quick command's exit code passes through the wrapper", async () => {
  expect((await run(["5", "sh", "-c", "exit 0"])).code).toBe(0);
  expect((await run(["5", "sh", "-c", "exit 3"])).code).toBe(3);
});

test("a command that outlasts the deadline is killed near it, and the wrapper fails saying why", async () => {
  // It spins for at most a minute: if the suite itself is killed mid-test, this wrapper dies with
  // it and its detached command would otherwise spin on forever (#467).
  const { code, output, seconds } = await run(["1", "sh", "-c", 'end=$(($(date +%s) + 60)); while [ "$(date +%s)" -lt "$end" ]; do :; done']);
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
  let grandchildPid;
  let ignoredSignal = false;
  // Checked first, even when the run fails: a killed wrapper leaves its command's group holding the
  // output open, and the step that stuck is the signal, not the close.
  const signalHeard = () =>
    expect(ignoredSignal, `the wrapper was still running ${WRAPPER_EXIT_ALLOWANCE_MS}ms after SIGTERM`).toBe(false);
  const ended = run(["30", ...grandchildCommand(pidFile)], {
    // Signal once the grandchild's pid is written; signal anyway if it never is, so the run ends.
    // A wrapper still running after that would sit out its 30s deadline: end it, and fail below.
    onSpawn: (wrapper) => {
      grandchildPid = waitForPid(pidFile).finally(() => {
        wrapper.kill("SIGTERM");
        setTimeout(() => {
          if (!running(wrapper)) return;
          ignoredSignal = true;
          wrapper.kill("SIGKILL");
        }, WRAPPER_EXIT_ALLOWANCE_MS);
      });
      grandchildPid.catch(() => {}); // awaited below, once the wrapper has closed
    },
  });
  const { code, output } = await ended.catch((error) => {
    signalHeard();
    throw error;
  });
  signalHeard();
  const grandchild = await grandchildPid;
  expect(code).not.toBe(0);
  expect(output).not.toContain("deadline");
  expect(grandchild).toBeGreaterThan(0);
  expect(await waitUntilDead(grandchild)).toBe(true);
}, SIGNAL_TEST_TIMEOUT_MS);
