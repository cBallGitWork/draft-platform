// A scratch git repo for a script check that compares the branch with origin/main
// (scripts/recorded-add-only.mjs, scripts/tests-kept.mjs): the check is run in it as verify runs
// it, from the repo's top.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const ORIGIN_MAIN = "refs/remotes/origin/main";
const TESTER = ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false"];

/** A repo of its own on branch `main`. Git sees no settings but TESTER's: none of the machine's,
 *  and no GIT_* variable (a git hook running the tests would point git at the real checkout). */
export function scratchRepo(prefix) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));
  Object.assign(env, { HOME: path, GIT_CONFIG_NOSYSTEM: "1" });

  /** git in the repo; a failure throws, so a broken setup never reads as the check's answer. */
  function git(...args) {
    const run = spawnSync("git", [...TESTER, ...args], { cwd: path, env, encoding: "utf8" });
    if (run.status !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr}`);
  }

  const repo = {
    path,
    git,
    write(file, text) {
      mkdirSync(join(path, dirname(file)), { recursive: true });
      writeFileSync(join(path, file), text);
    },
    /** Commits every change in the repo. */
    commitAll(message) {
      git("add", "-A");
      git("commit", "-q", "-m", message);
    },
    /** An empty commit with `trailer` in its body, where git reads trailers. */
    commitWithTrailer: (trailer) => git("commit", "-q", "--allow-empty", "-m", "why", "-m", trailer),
    /** An empty commit with `trailer` in a paragraph above a blank line and a Co-Authored-By
     *  line, where git doesn't read it as a trailer (#930). */
    commitWithTrailerAboveBlankLine: (trailer) =>
      git("commit", "-q", "--allow-empty", "-m", "why", "-m", trailer, "-m", "Co-Authored-By: t <t@t>"),
    /** What's committed so far becomes origin/main, and work goes on on a branch off it. */
    branchOffOriginMain() {
      git("update-ref", ORIGIN_MAIN, "HEAD");
      git("checkout", "-q", "-b", "work");
    },
    dropOriginMain: () => git("update-ref", "-d", ORIGIN_MAIN),
    /** The script at `script` run in the repo: how it ended and what it said on stderr. */
    run(script) {
      const { status, stderr } = spawnSync(process.execPath, [script], { cwd: path, env, encoding: "utf8" });
      return { status, said: stderr };
    },
    remove: () => rmSync(path, { recursive: true, force: true }),
  };
  git("init", "-q", "-b", "main");
  return repo;
}
