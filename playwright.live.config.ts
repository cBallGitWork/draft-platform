// The after-release check (spec/20, Every release): tests/live/ opened against the live site, no
// local server. `npx playwright test -c playwright.live.config.ts`; .github/workflows/release-check.yml
// runs it after each production deployment. What it points at: tests/live/releaseCheck.ts.

import { defineConfig } from "@playwright/test";
import { checkSite } from "./tests/live/releaseCheck";

export default defineConfig({
  testDir: "tests/live",
  testMatch: "*.live.spec.ts",
  forbidOnly: !!process.env.CI,
  // One sign-in, which waits up to two minutes for its email: no retry, since a second ask could
  // run into the hour's limit on links for the address.
  retries: 0,
  timeout: 4 * 60_000,
  reporter: "list",
  use: {
    baseURL: checkSite(),
    // The Mac's Chrome locally, as playwright.config.ts; CI's container has Chromium.
    channel: process.env.CI ? undefined : "chrome",
    // A screenshot, never a trace: a trace keeps the sign-in link, and this repository's runs are public.
    screenshot: "only-on-failure",
    trace: "off",
  },
});
