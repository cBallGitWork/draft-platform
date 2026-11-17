// How a merge goes live (spec/20, Every release): vercel.json's production build, the release's
// refusal to deploy from anything else, and the after-release check's workflow reading the
// settings the check does.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { CHECK_ENV } from "../../scripts/live-site.mjs";
import { DEPLOY_ARGS, DEPLOY_KEY_SETTING, LIVE, STAGING, STAGING_BRANCH, TEST_ONLY_SETTINGS, VERCEL_BRANCH, VERCEL_ENV, VERCEL_PREVIEW, VERCEL_PRODUCTION, refusal, stagingRelease, targetOf, testSettingRefusal } from "../../scripts/release.mjs";
import { OUTSIDE_WORLD_SETTING } from "../../convex/outbound/deploymentSettings.ts";
import { BUILD, PREVIOUS_SHA, SKIP, decide } from "../../scripts/release-skip.mjs";
import { DEPLOY_KEY } from "../support/scripts/liveSetup.harness.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

const SCRIPT = join(REPO_ROOT, "scripts/release.mjs");
const KEY = { [DEPLOY_KEY_SETTING]: DEPLOY_KEY };
const PREVIEW = VERCEL_PREVIEW;
const DEV_KEY = { [DEPLOY_KEY_SETTING]: "dev:fake-dev-456|eyFakeDevKey0123456789abcdef" };
const STAGING_BUILD = { [VERCEL_ENV]: PREVIEW, [VERCEL_BRANCH]: STAGING_BRANCH };
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
  // Vercel's own names, outside facts the constants must keep.
  expect(VERCEL_ENV).toBe("VERCEL_ENV");
  expect(VERCEL_BRANCH).toBe("VERCEL_GIT_COMMIT_REF");
  expect(PREVIEW).toBe("preview");
  expect(refusal({ [VERCEL_ENV]: VERCEL_PRODUCTION, ...KEY })).toBeNull();
  expect(refusal(KEY)).toBeNull();
  expect(refusal({ [VERCEL_ENV]: PREVIEW, ...KEY })).toContain(`this is a ${PREVIEW} build (${VERCEL_ENV}=${PREVIEW})`);
  expect(refusal({ [VERCEL_ENV]: "development", ...KEY })).toContain(`only a ${VERCEL_PRODUCTION} build or ${STAGING_BRANCH}'s ${PREVIEW} (staging) deploys`);
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

test("only main (staging) and release (live) deploy from git: every other branch is off", () => {
  expect(vercel.git.deploymentEnabled).toEqual({ "**": false, main: true, release: true });
});

test("main's preview is staging, and deploys to development only with a development key (S20.19, S20.21)", () => {
  expect(STAGING_BRANCH).toBe("main");
  expect(targetOf({ ...STAGING_BUILD, ...DEV_KEY })).toBe(STAGING);
  expect(refusal({ ...STAGING_BUILD, ...DEV_KEY })).toBeNull();
  // a live key on staging, or a dev key on live, never deploys
  expect(refusal({ ...STAGING_BUILD, ...KEY })).toContain("needs a development deploy key");
  expect(targetOf({ [VERCEL_ENV]: VERCEL_PRODUCTION, ...DEV_KEY })).toBe(LIVE);
  expect(refusal({ [VERCEL_ENV]: VERCEL_PRODUCTION, ...DEV_KEY })).toContain("needs a live deploy key");
  expect(refusal(STAGING_BUILD)).toContain(`${DEPLOY_KEY_SETTING} isn't set, so this build can't reach the development deployment`);
  // another branch's preview is still refused, even with a key
  expect(refusal({ [VERCEL_ENV]: PREVIEW, [VERCEL_BRANCH]: "feat/x", ...DEV_KEY })).toContain("this is a preview build");
  // outside Vercel, the key's kind decides
  expect(targetOf(DEV_KEY)).toBe(STAGING);
  expect(targetOf(KEY)).toBe(LIVE);
});

test("staging only deploys: no backup, no recorded shape, no timed jobs", () => {
  const calls = [];
  const status = stagingRelease({ convex: (args) => (calls.push(args), { status: 0 }), log: () => {} });
  expect(status).toBe(0);
  expect(calls).toEqual([DEPLOY_ARGS]);
});

test("the workflow passes the check every setting it reads, by the check's names", () => {
  for (const name of Object.values(CHECK_ENV)) expect(workflow).toContain(`${name}:`);
});

// The live deployment carrying a setting only an e2e run's throwaway server may hold (S20.17; #2288).
/** A fake `npx convex env get`, each setting answered from `held`, one in `failing` unreadable. */
function liveHolding(held, failing = new Set()) {
  const asked = [];
  const convex = (args) => {
    asked.push(args[2]);
    if (failing.has(args[2])) return { status: 1, stdout: "", stderr: "no deploy key" };
    return { status: 0, stdout: `${held[args[2]] ?? ""}\n`, stderr: "" };
  };
  return { convex, asked };
}

test("S20.17: the outside-world setting is one the live deployment must never carry", () => {
  expect(TEST_ONLY_SETTINGS).toContain(OUTSIDE_WORLD_SETTING);
});

test("S20.17: a live deployment holding no test-only setting isn't refused, each looked for alone", () => {
  const { convex, asked } = liveHolding({});
  expect(testSettingRefusal(convex)).toBeNull();
  expect(asked).toEqual(TEST_ONLY_SETTINGS);
});

test("S20.17: a live deployment carrying one is refused, saying which and how to remove it", () => {
  const said = testSettingRefusal(liveHolding({ [OUTSIDE_WORLD_SETTING]: "http://127.0.0.1:3999" }).convex);
  expect(said).toContain("Release stopped, nothing went live");
  expect(said).toContain(`npx convex env remove ${OUTSIDE_WORLD_SETTING} --prod`);
});

test("S20.17: a test-only setting that can't be read refuses the release, saying why", () => {
  const said = testSettingRefusal(liveHolding({}, new Set([OUTSIDE_WORLD_SETTING])).convex);
  expect(said).toContain(`couldn't read ${OUTSIDE_WORLD_SETTING}`);
  expect(said).toContain("no deploy key");
});
