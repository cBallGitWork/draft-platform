// scripts/function-inputs.mjs, the check that a call queued against main still fits the branch's
// inputs (#2172): the record it compares matches the code, this branch passes it, and in a scratch
// repo whose origin/main holds a record, a lost function, a new required argument, a dropped one or
// a narrowed type fails unless a branch commit carries "Inputs-changed: <function>: <how>" for it.

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { v } from "convex/values";
import { beforeEach, describe, expect, test } from "vitest";
import { TRAILER_PLACE } from "../../scripts/branchCheck.mjs";
import { INPUTS_RECORD, recordText } from "../../scripts/function-inputs.mjs";
import { registeredFunctions } from "../support/convex/test.harness";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";
import { scratchRepo } from "../support/scripts/gitRepo.harness.mjs";
import { scratchDir } from "../support/scripts/scratchDir.mjs";

const SCRIPT = join(REPO_ROOT, "scripts/function-inputs.mjs");
/** CI's unit job checks out one commit, with no origin/main: fetching main's history and this
 *  commit's takes a few seconds on a fast link. */
const FETCHES = { timeout: 120_000 };

/** A function a browser or the scheduler can call: every public one, and every internal mutation
 *  and action (a query can't be scheduled). */
const callable = (fn) => fn.isPublic === true || fn.isMutation === true || fn.isAction === true;

/** git in the checkout at `dir`; what it printed and how it ended. */
const gitIn = (dir, ...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });

/** origin/main and the history back to where this commit left it, fetched when the checkout at
 *  `dir` lacks them. */
function withOriginMain(dir) {
  const shallow = gitIn(dir, "rev-parse", "--is-shallow-repository").stdout.trim() === "true";
  if (!shallow && gitIn(dir, "rev-parse", "--verify", "-q", "refs/remotes/origin/main").status === 0) return;
  const head = gitIn(dir, "rev-parse", "HEAD").stdout.trim();
  const fetched = gitIn(dir, "fetch", "-q", ...(shallow ? ["--unshallow"] : []), "origin", "+refs/heads/main:refs/remotes/origin/main", head);
  if (fetched.status !== 0) throw new Error(`fetching origin/main failed: ${fetched.stderr}`);
}

test("a one-commit checkout, as CI's unit job has, gets origin/main and the branch's history", () => {
  const upstream = scratchRepo("function-inputs-upstream-");
  upstream.write("a.txt", "1\n");
  upstream.commitAll("base");
  upstream.git("checkout", "-q", "-b", "work");
  upstream.write("a.txt", "2\n");
  upstream.commitAll("on the branch");
  const clone = join(scratchDir("function-inputs-clone-"), "repo");
  const cloned = spawnSync("git", ["clone", "-q", "--depth", "1", "--branch", "work", `file://${upstream.path}`, clone], { encoding: "utf8" });
  if (cloned.status !== 0) throw new Error(`git clone: ${cloned.stderr}`);
  withOriginMain(clone);
  expect(gitIn(clone, "merge-base", "origin/main", "HEAD").stdout).toBe(upstream.git("rev-parse", "main"));
});

describe("this checkout", () => {
  test(`${INPUTS_RECORD} holds every callable function's inputs (rewrite it with -u)`, async () => {
    const record = {};
    for (const [fn, registered] of await registeredFunctions(callable)) record[fn] = JSON.parse(registered.exportArgs());
    await expect(recordText(record)).toMatchFileSnapshot(join(REPO_ROOT, INPUTS_RECORD));
  });

  test("keeps every call queued against main working, or says how they survive", FETCHES, () => {
    withOriginMain(REPO_ROOT);
    const { status, stderr } = spawnSync(process.execPath, [SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
    expect({ status, said: stderr }).toEqual({ status: 0, said: "" });
  });
});

const MAKE_PICK = "draft/draftPicks:makePick";
const AUTO_PICK = "draft/draftPicks:autoPick";
const MAIN = {
  [MAKE_PICK]: v.object({ leagueId: v.id("leagues"), playerCode: v.number() }),
  [AUTO_PICK]: v.object({ leagueId: v.id("leagues"), status: v.union(v.literal("due"), v.literal("late")) }),
};

/** What the check says of a function whose new inputs a call made against main may not fit. */
const MAY_NOT_FIT = "takes inputs a queued call may not fit";

let repo;

/** The branch's record: main's, with `changes` over it (an undefined one removes the function), committed. */
function branchRecord(changes) {
  const record = Object.fromEntries(Object.entries({ ...MAIN, ...changes }).filter(([, args]) => args).map(([fn, args]) => [fn, args.json]));
  repo.write(INPUTS_RECORD, recordText(record));
  repo.commitAll("change inputs");
}

const check = () => repo.run(SCRIPT);
const passes = () => expect(check()).toEqual({ status: 0, said: "" });

/** The check fails, naming `fn` and why; what it said. */
function refuses(fn, why) {
  const { status, said } = check();
  expect(status).toBe(1);
  expect(said).toContain(`${fn} ${why}`);
  return said;
}

describe("against an origin/main holding a record", () => {
  beforeEach(() => {
    repo = scratchRepo("function-inputs-");
    repo.write(INPUTS_RECORD, recordText(Object.fromEntries(Object.entries(MAIN).map(([fn, args]) => [fn, args.json]))));
    repo.commitAll("base");
    repo.branchOffOriginMain();
  });

  test("nothing changed passes", () => {
    passes();
  });

  test.each([
    ["a new function", { "draft/draftPicks:undo": v.object({ leagueId: v.id("leagues") }) }],
    ["a new optional argument", { [MAKE_PICK]: v.object({ leagueId: v.id("leagues"), playerCode: v.number(), note: v.optional(v.string()) }) }],
    ["a widened type", { [MAKE_PICK]: v.object({ leagueId: v.id("leagues"), playerCode: v.union(v.number(), v.null()) }) }],
    ["a union given a branch", { [AUTO_PICK]: v.object({ leagueId: v.id("leagues"), status: v.union(v.literal("due"), v.literal("late"), v.literal("held")) }) }],
  ])("%s passes", (_, changes) => {
    branchRecord(changes);
    passes();
  });

  test.each([
    ["a lost function", { [MAKE_PICK]: undefined }, "is gone"],
    ["a new required argument", { [MAKE_PICK]: v.object({ leagueId: v.id("leagues"), playerCode: v.number(), teamId: v.id("teams") }) }, `${MAY_NOT_FIT}, at teamId`],
    ["a dropped argument", { [MAKE_PICK]: v.object({ leagueId: v.id("leagues") }) }, `${MAY_NOT_FIT}, at playerCode`],
    ["a narrowed type", { [AUTO_PICK]: v.object({ leagueId: v.id("leagues"), status: v.literal("due") }) }, `${MAY_NOT_FIT}, at status`],
    ["an id of another table", { [MAKE_PICK]: v.object({ leagueId: v.id("teams"), playerCode: v.number() }) }, `${MAY_NOT_FIT}, at leagueId`],
  ])("%s fails, saying where", (_, changes, why) => {
    branchRecord(changes);
    refuses(Object.keys(changes)[0], why);
  });

  test("a trailer naming the function, with how queued calls survive, lets the change through", () => {
    branchRecord({ [MAKE_PICK]: undefined });
    repo.commitWithTrailer(`Inputs-changed: ${MAKE_PICK}: drain, no draft is under way`);
    passes();
  });

  test("a trailer naming another function, or with no how, doesn't", () => {
    branchRecord({ [MAKE_PICK]: undefined });
    repo.commitWithTrailer(`Inputs-changed: ${AUTO_PICK}: re-export`);
    repo.commitWithTrailer(`Inputs-changed: ${MAKE_PICK}:`);
    refuses(MAKE_PICK, "is gone");
  });

  test("a trailer above a blank line is refused, saying where it goes", () => {
    branchRecord({ [MAKE_PICK]: undefined });
    repo.commitWithTrailerAboveBlankLine(`Inputs-changed: ${MAKE_PICK}: drain`);
    expect(refuses(MAKE_PICK, "is gone")).toContain(TRAILER_PLACE);
  });

  test("a branch with no record fails, saying how to write it", () => {
    repo.git("rm", "-q", INPUTS_RECORD);
    repo.commitAll("drop the record");
    expect(check().said).toContain("function-inputs.test.mjs -u");
  });

  test("with no origin/main to compare with, it fails, saying to fetch", () => {
    repo.dropOriginMain();
    const { status, said } = check();
    expect(status).toBe(1);
    expect(said).toContain("Run git fetch origin");
  });
});

test("an origin/main with no record yet passes: nothing was queued against one", () => {
  repo = scratchRepo("function-inputs-");
  repo.write("README.md", "x\n");
  repo.commitAll("base");
  repo.branchOffOriginMain();
  branchRecord({});
  passes();
});
