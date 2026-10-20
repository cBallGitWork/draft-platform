import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Only convex/, src/ and scripts/ at the root are searched for tests, so one anywhere else never
// runs: an agent's worktree, inside the repo under .claude/worktrees/, runs its own.

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          // convex-test runs functions in Convex's own runtime, which this environment mimics.
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        plugins: [react()],
        test: { name: "app", include: ["src/**/*.test.{ts,tsx}"], environment: "jsdom" },
      },
      { test: { name: "scripts", include: ["scripts/**/*.test.mjs"], environment: "node" } },
    ],
  },
});
