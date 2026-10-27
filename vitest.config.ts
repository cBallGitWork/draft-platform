import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { LONDON_ZONE } from "./convex/shared/moments.ts";

// So no test depends on the host's zone.
process.env.TZ = LONDON_ZONE;

// Where tests go and what tests/support/ holds: tests/README.md. Only the roots below are
// searched, never the whole repo: an agent's worktree, inside it under .claude/worktrees/, runs
// its own.
// Each project puts back every stubbed global, stubbed env and spy before each test, so no test
// file needs its own afterEach for them; what each setup file does is in tests/README.md.

const RESTORED = {
  unstubGlobals: true,
  unstubEnvs: true,
  restoreMocks: true,
  setupFiles: ["./tests/support/test.setup.ts"],
};

const CONSOLE_SETUP = "./tests/support/console.setup.ts";

export default defineConfig({
  test: {
    // Only `npm run coverage` turns it on: a summary to read, never a gate, so no thresholds and
    // it prints even when a test fails (ARCHITECTURE.md, Coverage). Every source file counts, so
    // one no test loads shows uncovered. That script gives each test 30s, not 5s: counting about
    // doubles a test's time, and a slow one timed out under it (#155).
    coverage: {
      reporter: ["text-summary"],
      reportOnFailure: true,
      include: ["convex/**/*.ts", "src/**/*.{ts,tsx}", "scripts/**/*.mjs"],
      exclude: ["convex/_generated/**", "**/*.d.ts"],
    },
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
