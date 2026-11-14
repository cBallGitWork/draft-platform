#!/usr/bin/env node
// `npm run mutation -- <file>`: Stryker on one source file (stryker.config.mjs, #2173). One file
// at a time keeps a run to minutes.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { SECOND_MS } from "../convex/shared/time.ts";

const files = process.argv.slice(2);
if (files.length !== 1 || !existsSync(files[0])) {
  console.error("usage: npm run mutation -- <one source file, such as convex/scoring/values.ts>");
  process.exit(2);
}

const started = Date.now();
const run = spawnSync("npx", ["stryker", "run", "--mutate", files[0]], { stdio: "inherit" });
console.log(`mutation run on ${files[0]} took ${Math.round((Date.now() - started) / SECOND_MS)}s`);
process.exit(run.status ?? 1);
