// How a merge goes live (spec/20, Every release): vercel.json's production build, the release's
// refusal to deploy from anything else, and the after-release check's workflow reading the
// settings the check does.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { CHECK_ENV } from "../../scripts/live-site.mjs";
import { DEPLOY_ARGS, DEPLOY_KEY_SETTING, VERCEL_ENV, VERCEL_PRODUCTION, refusal } from "../../scripts/release.mjs";
import { BUILD, PREVIOUS_SHA, SKIP, decide } from "../../scripts/release-skip.mjs";
import { DEPLOY_KEY } from "../support/scripts/liveSetup.harness.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

const SCRIPT = join(REPO_ROOT, "scripts/release.mjs");
const KEY = { [DEPLOY_KEY_SETTING]: DEPLOY_KEY };
const PREVIEW = "preview";
const vercel = JSON.parse(readFileSync(join(REPO_ROOT, "vercel.json"), "utf8"));
const workflow = readFileSync(join(REPO_ROOT, ".github/workflows/release-check.yml"), "utf8");

/** The release script run with only `env`: how it ended and what it said. With no PATH there's no
 *  `npx` to find, so a release that got past its refusal couldn't reach a real Convex. */
function releaseIn(env) {
  const { status, stdout } = spawnSync(process.execPath, [SCRIPT], { env, encoding: "utf8" });
  return { status, said: stdout };
}

test("a production build runs the release, which puts the server code live and builds the site with it", () => {
  expect(vercel.buildCommand).toBe("node scripts/release.mjs");
  expect(DEPLOY_ARGS).toEqual(["deploy", "--cmd", "npm run build"]);
});

test("Vercel skips only a merge that ships nothing: #512's ignore command skipped production's too", () => {
  expect(vercel.ignoreCommand).toBe("node scripts/release-skip.mjs");
  // Vercel's own name and exits, outside facts the constants must keep.
  expect(PREVIOUS_SHA).toBe("VERCEL_GIT_PREVIOUS_SHA");
  expect([SKIP, BUILD]).toEqual([0, 1]);
  const since = { [PREVIOUS_SHA]: "abc123" };
  const only = (files) => () => files;
  const notShipped = ["docs/setup.md", "spec/20-going-live.md", ".github/workflows/lead.yml", "tests/a.test.ts", "README.md"];
  expect(decide(since, only(notShipped)).exit).toBe(SKIP);
  for (const shipped of ["src/app.tsx", "convex/schema.ts", "scripts/release.mjs", "vercel.json", "package-lock.json"]) {
    expect(decide(since, only([...notShipped, shipped])).exit).toBe(BUILD);
  }
  // any doubt builds: no earlier release, git unable to compare, or nothing listed
  expect(decide({}, only(notShipped)).exit).toBe(BUILD);
  expect(decide(since, () => null).exit).toBe(BUILD);
  expect(decide(since, only([])).exit).toBe(BUILD);
});

test("only a production build with the deploy key may release", () => {
  // Vercel's own name for the variable, an outside fact the constant must keep.
  expect(VERCEL_ENV).toBe("VERCEL_ENV");
  expect(refusal({ [VERCEL_ENV]: VERCEL_PRODUCTION, ...KEY })).toBeNull();
  expect(refusal(KEY)).toBeNull();
  expect(refusal({ [VERCEL_ENV]: PREVIEW, ...KEY })).toContain(`this is a ${PREVIEW} build (${VERCEL_ENV}=${PREVIEW})`);
  expect(refusal({ [VERCEL_ENV]: "development", ...KEY })).toContain(`only a ${VERCEL_PRODUCTION} build deploys`);
  expect(refusal({ [VERCEL_ENV]: VERCEL_PRODUCTION })).toContain(`${DEPLOY_KEY_SETTING} isn't set`);
  expect(refusal({ [VERCEL_ENV]: VERCEL_PRODUCTION, [DEPLOY_KEY_SETTING]: "" })).toContain(`${DEPLOY_KEY_SETTING} isn't set`);
});

test("a preview build, even one with the key, fails before it reaches Convex, saying why in the log", () => {
  const preview = releaseIn({ [VERCEL_ENV]: PREVIEW, ...KEY });
  expect(preview.status).toBe(1);
  expect(preview.said).toBe(`${refusal({ [VERCEL_ENV]: PREVIEW })}\n`);
});

test("a production build with no deploy key fails, saying why in the log", () => {
  const keyless = releaseIn({ [VERCEL_ENV]: VERCEL_PRODUCTION });
  expect(keyless.status).toBe(1);
  expect(keyless.said).toContain(`${DEPLOY_KEY_SETTING} isn't set, so this build can't reach the live deployment`);
});

test("only main deploys from git: every other branch is off", () => {
  expect(vercel.git.deploymentEnabled).toEqual({ "**": false, main: true });
});

test("the workflow passes the check every setting it reads, by the check's names", () => {
  for (const name of Object.values(CHECK_ENV)) expect(workflow).toContain(`${name}:`);
});
