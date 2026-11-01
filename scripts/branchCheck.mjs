// What verify's checks that compare the branch with origin/main share (scripts/recorded-add-only.mjs,
// scripts/tests-kept.mjs): the base they compare with, git run with a failure said plainly, and the
// trailers a branch's commits carry to let a change through on purpose.

import { execFileSync } from "node:child_process";

export const BASE = "origin/main";

/** Where a refusal says its trailer goes: git reads trailers only from a commit message's last
 *  paragraph, so one above a blank line, such as one above Co-Authored-By, goes unread (#930). */
export const TRAILER_PLACE =
  "in the commit message's last paragraph, with any other trailers such as Co-Authored-By and no blank line between";

/** A check's `fail` and `git`, each saying the check's `name` on a failure, which ends the run. */
export function branchCheck(name) {
  function fail(message) {
    console.error(`${name}: ${message}`);
    process.exit(1);
  }

  /** git's output; a git failure ends the check with what it said, not a stack trace. */
  function git(...args) {
    try {
      return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });
    } catch (error) {
      const said = String(error.stderr ?? "").trim() || error.message;
      fail(`git ${args[0]} failed (${said}). Run git fetch origin, then try again.`);
    }
  }

  return {
    fail,
    git,
    /** Where the branch left origin/main. */
    base: () => git("merge-base", BASE, "HEAD").trim(),
    /** Each value of the `key` trailer on the branch's commits since `base`, one a line. */
    trailerValues: (key, base) =>
      git("log", `--format=%(trailers:key=${key},valueonly,separator=%x0A)`, `${base}..HEAD`).split("\n").filter(Boolean),
  };
}
