// How a merge goes live (spec/20, Every release): vercel.json's production build, its refusal to
// build anything else, and the after-release check's workflow reading the settings the check does.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { CHECK_ENV } from "../live/releaseCheck";

const REPO = join(import.meta.dirname, "../..");
const vercel = JSON.parse(readFileSync(join(REPO, "vercel.json"), "utf8"));
const workflow = readFileSync(join(REPO, ".github/workflows/release-check.yml"), "utf8");

/** vercel.json's ignore command's exit code in a build for `environment`: 0 skips the build. */
function ignoreExit(environment) {
  return spawnSync("sh", ["-c", vercel.ignoreCommand], { env: { ...process.env, VERCEL_ENV: environment } }).status;
}

test("a production build puts the server code live and builds the site with it", () => {
  expect(vercel.buildCommand).toBe("npx convex deploy --cmd 'npm run build'");
});

test("only production builds: a preview's is skipped before it can deploy Convex", () => {
  expect(ignoreExit("production")).toBe(1);
  expect(ignoreExit("preview")).toBe(0);
  expect(ignoreExit("development")).toBe(0);
});

test("only main deploys from git: every other branch is off", () => {
  expect(vercel.git.deploymentEnabled).toEqual({ "**": false, main: true });
});

test("the workflow passes the check every setting it reads, by the check's names", () => {
  for (const name of Object.values(CHECK_ENV)) expect(workflow).toContain(`${name}:`);
});
