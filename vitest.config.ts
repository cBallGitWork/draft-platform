import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The league's zone, as convex/shared/londonTime.ts uses, so no test depends on the host's zone.
process.env.TZ = "Europe/London";

// Where tests go and what tests/support/ holds: tests/README.md. Only the roots below are
// searched, never the whole repo: an agent's worktree, inside it under .claude/worktrees/, runs
// its own.
// Each project puts back every stubbed global, stubbed env and spy before each test, and
// tests/support/test.setup.ts puts the real timers back after each, so no test file needs its own
// afterEach for them. In the convex and app projects, tests/support/console.setup.ts fails a test
// that logs with console.error and didn't call silenceConsoleError(); the app project's
// tests/support/app.setup.ts unmounts whatever a test rendered.

const RESTORED = {
  unstubGlobals: true,
  unstubEnvs: true,
  restoreMocks: true,
  setupFiles: ["./tests/support/test.setup.ts"],
};

const CONSOLE_SETUP = "./tests/support/console.setup.ts";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "convex",
          ...RESTORED,
          setupFiles: [...RESTORED.setupFiles, CONSOLE_SETUP],
          include: ["tests/convex/**/*.test.ts"],
          // convex-test runs functions in Convex's own runtime, which this environment mimics.
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        plugins: [react()],
        test: {
          name: "app",
          include: ["tests/src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          ...RESTORED,
          setupFiles: [...RESTORED.setupFiles, CONSOLE_SETUP, "./tests/support/app.setup.ts"],
          // Vitest empties every CSS import, `?raw` included. Only the raw read of styles.css is let
          // through, for the theme-color test in tests/src/product.test.ts; plain CSS imports stay empty.
          css: { include: [/\/src\/styles\.css\?raw$/] },
        },
      },
      { test: { name: "scripts", include: ["tests/scripts/**/*.test.mjs"], environment: "node", ...RESTORED } },
    ],
  },
});
