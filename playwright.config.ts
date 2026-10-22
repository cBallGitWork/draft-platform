// `npm run smoke`: the app loaded in a real browser, with no Convex deployment. Two servers:
// `dev` is Vite's dev server, where `?preview=` sessions mount the screens; `bundle` is the
// production build, where they must not (src/preview.ts). Each project runs the tests tagged with
// its name. VITE_CONVEX_URL is blanked for both, so a checkout's .env.local can't point either at
// a real deployment.
// The ports are this checkout's own (smokePorts in scripts/port.mjs), so worktrees can run it side
// by side, clear of every checkout's app server.

import { defineConfig } from "@playwright/test";
import { localUrl, smokePorts } from "./scripts/port.mjs";

const { dev: DEV_PORT, bundle: BUNDLE_PORT } = smokePorts();
const DEV_URL = localUrl(DEV_PORT);
const BUNDLE_URL = localUrl(BUNDLE_PORT);
const NO_CONVEX = { VITE_CONVEX_URL: "" };

export default defineConfig({
  testDir: "tests/smoke",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    // The Mac's Chrome locally, as scripts/shoot.mjs uses; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "dev", grep: /@dev/, use: { baseURL: DEV_URL } },
    { name: "bundle", grep: /@bundle/, use: { baseURL: BUNDLE_URL } },
  ],
  webServer: [
    { command: `npx vite --strictPort --port ${DEV_PORT}`, url: DEV_URL, env: NO_CONVEX, timeout: 60_000 },
    {
      command: `npx vite build && npx vite preview --strictPort --port ${BUNDLE_PORT}`,
      url: BUNDLE_URL,
      env: NO_CONVEX,
      timeout: 120_000,
    },
  ],
});
