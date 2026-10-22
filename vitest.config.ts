import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Every test sits in tests/, mirroring the code it tests. Only tests/convex/, tests/src/ and
// tests/scripts/ at the root are searched, so one anywhere else never runs: an agent's worktree,
// inside the repo under .claude/worktrees/, runs its own. tests/support/ holds the harnesses and
// setup files; tests/smoke/ is Playwright's, run by `npm run smoke` (playwright.config.ts), never
// by Vitest.
// Each project puts back every stubbed global, stubbed env and spy before each test, and
// tests/support/test.setup.ts puts the real timers back after each, so no test file needs its own
// afterEach for them.

const RESTORED = {
  unstubGlobals: true,
  unstubEnvs: true,
  restoreMocks: true,
  setupFiles: ["./tests/support/test.setup.ts"],
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "convex",
          ...RESTORED,
          // A test fails if it logs with console.error and didn't call silenceConsoleError().
          setupFiles: [...RESTORED.setupFiles, "./tests/support/console.setup.ts"],
          include: ["tests/convex/**/*.test.ts"],
          // convex-test runs functions in Convex's own runtime, which this environment mimics.
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        plugins: [react()],
        test: { name: "app", include: ["tests/src/**/*.test.{ts,tsx}"], environment: "jsdom", ...RESTORED },
      },
      { test: { name: "scripts", include: ["tests/scripts/**/*.test.mjs"], environment: "node", ...RESTORED } },
    ],
  },
});
