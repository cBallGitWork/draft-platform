import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // convex-test runs functions in Convex's own runtime, which this environment mimics.
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    // Agents' worktrees live inside the repo; each runs its own tests.
    exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
  },
});
