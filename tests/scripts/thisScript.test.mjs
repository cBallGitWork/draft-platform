import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import { CHECKOUT, ranDirectly } from "../../scripts/thisScript.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

test("the checkout is the folder above scripts/", () => {
  expect(CHECKOUT).toBe(resolve(REPO_ROOT));
});

test("a script imported by another, here by Vitest, was not run directly", () => {
  expect(ranDirectly(pathToFileURL(resolve(REPO_ROOT, "scripts/port.mjs")).href)).toBe(false);
});
