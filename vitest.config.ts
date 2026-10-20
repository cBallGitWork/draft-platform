import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

// Agents' worktrees live inside the repo; each runs its own tests. Only convex/ and src/ are
// searched for tests: one anywhere else is never run.
const exclude = [...configDefaults.exclude, ".claude/worktrees/**"];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          exclude,
          // convex-test runs functions in Convex's own runtime, which this environment mimics.
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        plugins: [react()],
        test: { name: "app", include: ["src/**/*.test.{ts,tsx}"], exclude, environment: "jsdom" },
      },
    ],
  },
});
