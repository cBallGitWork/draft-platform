// `npm run smoke`: the app loaded in a real browser, with no Convex deployment. Two servers:
// `dev` is Vite's dev server, where `?preview=` sessions mount the screens; `bundle` is the
// production build, where they must not (src/preview.ts). VITE_CONVEX_URL is blanked for both, so
// a checkout's .env.local can't point either at a real deployment.
// The ports are this checkout's own (scripts/port.mjs), so worktrees can run it side by side; the
// bundle's sits one range above every checkout's dev port.

import { defineConfig } from "@playwright/test";
import { appPort } from "./scripts/port.mjs";

const DEV_PORT = appPort();
const BUNDLE_PORT = DEV_PORT + 700;
const NO_CONVEX = { VITE_CONVEX_URL: "" };

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    // The Mac's Chrome locally, as scripts/shoot.mjs uses; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "dev", testMatch: /smoke\.spec\.ts/, grep: /@dev/, use: { baseURL: `http://localhost:${DEV_PORT}` } },
    { name: "bundle", testMatch: /smoke\.spec\.ts/, grep: /@bundle/, use: { baseURL: `http://localhost:${BUNDLE_PORT}` } },
  ],
  webServer: [
    {
      command: `npx vite --strictPort --port ${DEV_PORT}`,
      url: `http://localhost:${DEV_PORT}`,
      env: NO_CONVEX,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite build && npx vite preview --strictPort --port ${BUNDLE_PORT}`,
      url: `http://localhost:${BUNDLE_PORT}`,
      env: NO_CONVEX,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
