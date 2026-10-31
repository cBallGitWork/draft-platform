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
    // Vitest 5 turns this on by default: it keeps each transformed file in
    // node_modules/.vitest-cache and reuses it while the file's own source is unchanged. It skips a
    // file holding the text `import.meta.glob(`, but not `import.meta.glob<string>(`, so
    // tests/convex/generatedApi.test.ts kept its list of convex/ from before a module was added, and
    // the local gate disagreed with CI, which starts with no cache (#766). A full `npm test` took
    // 24-26s with it and 25-26s without (31 Oct 2026). The option: `fsModuleCache` in
    // node_modules/vitest/dist/chunks/plugin.d.*.d.ts; the skip: generateCachePath in
    // node_modules/vitest/dist/chunks/cli-api.*.js.
    fsModuleCache: false,
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
          // Vitest empties every CSS import, `?raw` included. Only the raw reads of styles.css and the
          // controls' controls.css are let through, for the tests that check their colours
          // (tests/src/product.test.ts, tests/src/ui/confirm.test.tsx); plain CSS imports stay empty.
          css: { include: [/\/src\/(styles|ui\/controls)\.css\?raw$/] },
        },
      },
      { test: { name: "scripts", include: ["tests/scripts/**/*.test.mjs"], environment: "node", ...RESTORED } },
    ],
  },
});
