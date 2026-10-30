// How a merge goes live (spec/20, Every release): vercel.json's production build, the release's
// refusal to deploy from anything else, and the after-release check's workflow reading the
// settings the check does.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { CHECK_ENV } from "../live/releaseCheck";
import { DEPLOY_ARGS, DEPLOY_KEY_SETTING, VERCEL_PRODUCTION, refusal } from "../../scripts/release.mjs";
import { DEPLOY_KEY } from "../support/scripts/liveSetup.harness.mjs";

const REPO = join(import.meta.dirname, "../..");
const SCRIPT = join(REPO, "scripts/release.mjs");
const KEY = { [DEPLOY_KEY_SETTING]: DEPLOY_KEY };
const vercel = JSON.parse(readFileSync(join(REPO, "vercel.json"), "utf8"));
const workflow = readFileSync(join(REPO, ".github/workflows/release-check.yml"), "utf8");

/** The release script run with `env` in place of the build's: how it ended and what it said. */
function releaseIn(env) {
  const { PATH, HOME } = process.env;
  const { status, stdout } = spawnSync(process.execPath, [SCRIPT], { env: { PATH, HOME, ...env }, encoding: "utf8" });
  return { status, said: stdout };
}

test("a production build runs the release, which puts the server code live and builds the site with it", () => {
  expect(vercel.buildCommand).toBe("node scripts/release.mjs");
  expect(DEPLOY_ARGS).toEqual(["deploy", "--cmd", "npm run build"]);
});

test("Vercel skips no build itself: an ignore command once skipped production's too (#512)", () => {
  expect(vercel).not.toHaveProperty("ignoreCommand");
});

test("only a production build with the deploy key may release", () => {
  expect(refusal({ VERCEL_ENV: VERCEL_PRODUCTION, ...KEY })).toBeNull();
  // Outside Vercel there's no VERCEL_ENV, and the key alone decides.
  expect(refusal(KEY)).toBeNull();
  expect(refusal({ VERCEL_ENV: "preview", ...KEY })).toContain("this is a preview build (VERCEL_ENV=preview)");
  expect(refusal({ VERCEL_ENV: "development", ...KEY })).toContain("only a production build deploys");
  expect(refusal({ VERCEL_ENV: VERCEL_PRODUCTION })).toContain(`${DEPLOY_KEY_SETTING} isn't set`);
  expect(refusal({ VERCEL_ENV: VERCEL_PRODUCTION, [DEPLOY_KEY_SETTING]: "" })).toContain(`${DEPLOY_KEY_SETTING} isn't set`);
});

test("a preview build, even one with the key, fails before it reaches Convex, saying why in the log", () => {
  const preview = releaseIn({ VERCEL_ENV: "preview", ...KEY });
  expect(preview.status).toBe(1);
  expect(preview.said).toBe(`${refusal({ VERCEL_ENV: "preview" })}\n`);
});

test("a production build with no deploy key fails, saying why in the log", () => {
  const keyless = releaseIn({ VERCEL_ENV: VERCEL_PRODUCTION });
  expect(keyless.status).toBe(1);
  expect(keyless.said).toContain(`${DEPLOY_KEY_SETTING} isn't set, so this build can't reach the live deployment`);
});

test("only main deploys from git: every other branch is off", () => {
  expect(vercel.git.deploymentEnabled).toEqual({ "**": false, main: true });
});

test("the workflow passes the check every setting it reads, by the check's names", () => {
  for (const name of Object.values(CHECK_ENV)) expect(workflow).toContain(`${name}:`);
});
