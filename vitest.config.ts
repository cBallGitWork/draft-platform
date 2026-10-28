import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { LONDON_ZONE } from "./convex/shared/moments.ts";

// So no test depends on the host's zone.
process.env.TZ = LONDON_ZONE;

// Where tests go and what tests/support/ holds: tests/README.md. Only the roots below are
// searched, never the whole repo: an agent's worktree, inside it under .claude/worktrees/, runs
// its own.
// Each project puts back every stubbed global, stubbed env and spy before each test (the app
// project resets its fakes too), so no test file needs its own afterEach for them; what each
// setup file does is in tests/README.md.

const RESTORED = {
  unstubGlobals: true,
  unstubEnvs: true,
  restoreMocks: true,
  setupFiles: ["./tests/support/test.setup.ts"],
};

const CONSOLE_SETUP = "./tests/support/console.setup.ts";

export default defineConfig({
  test: {
    // Only `npm run coverage` turns it on: four totals to read (statements, branches, functions,
    // lines), never a gate, so no thresholds and they print even when a test fails
    // (ARCHITECTURE.md, Coverage). They count every source file below, and one no test loads
    // counts as 0%; `npm run coverage -- --coverage.reporter=text` lists each file. That script
    // gives each test 30s, not 5s: counting about doubles a test's time, and a slow one timed out
    // under it (#155).
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
          // The screens' tests fake Convex with vi.fn()s. Each test gets them back as declared, with
          // no calls, so no file resets them by hand and none inherits the test before's answers.
          mockReset: true,
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
