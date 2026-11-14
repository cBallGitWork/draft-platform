// `npm run clicker`: the random clicker (tests/clicker/, #2138) on the dev server's preview, no
// Convex, as the smoke run's dev project (playwright.config.ts). Its seed is CLICKER_SEED, or a new
// one printed here once; `CLICKER_SEED=<seed> npm run clicker` replays a run, and `-g "<screen>"`
// one screen of it. CLICKER_STEPS sets how many steps each screen takes.

import { defineConfig } from "@playwright/test";
import smoke, { DEV_PROJECT, DEV_SERVER } from "./playwright.config";
import { CLICKER_SEED_KEY } from "./tests/support/smoke/clicker";

// Workers inherit this process's env, so every one reads the seed set here. Said on stderr: knip
// loads this file too (scripts/unused-exports.mjs), and reads its stdout as JSON.
if (!process.env[CLICKER_SEED_KEY]) {
  const seed = Date.now().toString(36);
  process.env[CLICKER_SEED_KEY] = seed;
  console.error(`Random clicker seed: ${seed} (replay with ${CLICKER_SEED_KEY}=${seed} npm run clicker)`);
}

export default defineConfig({
  ...smoke,
  testDir: "tests/clicker",
  // Each screen is its own run, so they spread over the workers.
  fullyParallel: true,
  // Each screen's steps, a slow save's wait among them, take longer than a smoke test.
  timeout: 5 * 60_000,
  projects: [DEV_PROJECT],
  webServer: [DEV_SERVER],
});
