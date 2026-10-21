import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Only convex/, src/ and scripts/ at the root are searched for tests, so one anywhere else never
// runs: an agent's worktree, inside the repo under .claude/worktrees/, runs its own.
// Each project puts back every stubbed global, stubbed env and spy before each test, and
// test.setup.ts puts the real timers back after each, so no test file needs its own afterEach for
// them. The setup file sits outside convex/, so Convex never loads it as one of its modules.

const RESTORED = { unstubGlobals: true, unstubEnvs: true, restoreMocks: true, setupFiles: ["./test.setup.ts"] };

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "convex",
          ...RESTORED,
          include: ["convex/**/*.test.ts"],
          // convex-test runs functions in Convex's own runtime, which this environment mimics.
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        plugins: [react()],
        test: { name: "app", include: ["src/**/*.test.{ts,tsx}"], environment: "jsdom", ...RESTORED },
      },
      { test: { name: "scripts", include: ["scripts/**/*.test.mjs"], environment: "node", ...RESTORED } },
    ],
  },
});
