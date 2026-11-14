// Mutation testing, a trial (#2173): `npm run mutation -- <file>` plants small changes in one
// source file at a time, runs the tests that reach each one, and lists every change no test
// caught. Read, never gated: the score is never a target (docs/PHILOSOPHY.md), and neither
// `npm run verify` nor CI runs it.
/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  // Vitest's own default pool, not Stryker's `threads`: a test that sets process.env.TZ part-way
  // (tests/src/myTeam/claims.zone.test.tsx) only moves the clock's zone in a process of its own.
  vitest: { configFile: "vitest.config.ts", related: true, pool: "forks" },
  // Each mutant runs only the tests that covered it, not the whole suite.
  coverageAnalysis: "perTest",
  reporters: ["clear-text", "progress"],
  clearTextReporter: { allowEmojis: false, logTests: false },
  tempDirName: ".stryker-tmp",
  cleanTempDir: "always",
};
