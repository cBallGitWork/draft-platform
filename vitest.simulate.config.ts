import { defineConfig } from "vitest/config";
import { LONDON_ZONE } from "./convex/shared/moments.ts";

// The season simulation (#2132, tests/convex/simulation/): `npm run simulate`, which the nightly
// job calls. Never part of `npm test` (vitest.config.ts), being minutes long. It runs as the convex
// project does, its setup files included, so a console.error fails it and the timed jobs are on.

process.env.TZ = LONDON_ZONE;

/** A whole season at 80 teams takes minutes, not vitest's default 5 seconds. */
const SEASON_MS = 60 * 60 * 1000;

export default defineConfig({
  test: {
    name: "simulate",
    include: ["tests/convex/simulation/**/*.sim.ts"],
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    unstubGlobals: true,
    unstubEnvs: true,
    restoreMocks: true,
    setupFiles: ["./tests/support/test.setup.ts", "./tests/support/console.setup.ts", "./tests/support/convex.setup.ts"],
    testTimeout: SEASON_MS,
    fsModuleCache: false,
  },
});
