import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import { CHECKOUT, ranDirectly } from "../../scripts/thisScript.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";
import { scratchDir } from "../support/scripts/scratchDir.mjs";

test("the checkout is the folder above scripts/", () => {
  expect(CHECKOUT).toBe(resolve(REPO_ROOT));
});

test("a script imported by another, here by Vitest, was not run directly", () => {
  expect(ranDirectly(pathToFileURL(resolve(REPO_ROOT, "scripts/port.mjs")).href)).toBe(false);
});

test("a script node was run with was run directly", () => {
  const script = join(scratchDir("ran-directly-"), "script.mjs");
  const helper = pathToFileURL(resolve(REPO_ROOT, "scripts/thisScript.mjs")).href;
  writeFileSync(script, `import { ranDirectly } from ${JSON.stringify(helper)};\nconsole.log(ranDirectly(import.meta.url));\n`);
  expect(execFileSync(process.execPath, [script], { encoding: "utf8" }).trim()).toBe("true");
});
