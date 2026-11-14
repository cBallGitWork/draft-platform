#!/usr/bin/env node
// `npm run mutation -- <file> [test files or globs...]`: Stryker on one source file
// (stryker.config.mjs, #2173), run against its own folder's tests: convex/scoring/values.ts
// against tests/convex/scoring/. Every test that reaches the file would be most of the suite (468
// files for values.ts, 14 Nov 2026), over ten minutes before the first planted change, so a change
// only a far-off test catches is listed as surviving: its own tests miss it.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { SECOND_MS } from "../convex/shared/time.ts";

const [file, ...tests] = process.argv.slice(2);
if (!file || !existsSync(file)) {
  console.error("usage: npm run mutation -- <one source file, such as convex/scoring/values.ts> [test files or globs...]");
  process.exit(2);
}
const testFiles = tests.length > 0 ? tests : [`tests/${dirname(file)}/**/*.test.*`];

const started = Date.now();
const run = spawnSync("npx", ["stryker", "run", "--mutate", file, "--testFiles", testFiles.join(",")], { stdio: "inherit" });
console.log(`mutation run on ${file} against ${testFiles.join(", ")} took ${Math.round((Date.now() - started) / SECOND_MS)}s`);
process.exit(run.status ?? 1);
