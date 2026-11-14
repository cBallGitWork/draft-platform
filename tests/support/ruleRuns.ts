// How long the rule tests' random runs are (#2126). fast-check tries `numRuns` random inputs a
// property: a short run on every pull request, and `npm run test:rules-long` sets
// RULE_TEST_RUNS for a long one, run by hand until a nightly job calls it (#2139). A failure prints its seed and path and shrinks to
// its smallest case; RULE_TEST_SEED (with RULE_TEST_PATH) runs that case again.

import type { Parameters } from "fast-check";

const SHORT_RUNS = 100;

const runs = Number(process.env.RULE_TEST_RUNS ?? SHORT_RUNS);
const seed = process.env.RULE_TEST_SEED;
const path = process.env.RULE_TEST_PATH;

/** fast-check's settings for every rule test: the run's length, and a failure's seed to replay. */
export const RULE_RUNS: Parameters<unknown> = {
  numRuns: runs,
  ...(seed === undefined ? {} : { seed: Number(seed) }),
  ...(path === undefined ? {} : { path }),
};

/** A model-based run's settings: a tenth as many command lists, as each plays many steps. */
export const MODEL_RUNS: Parameters<unknown> = { ...RULE_RUNS, numRuns: Math.max(10, Math.floor(runs / 10)) };
