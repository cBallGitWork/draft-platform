import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { PIN_PATH, kitProblems } from "../../scripts/studio-kit.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";
import { scratchDir } from "../support/scripts/scratchDir.mjs";

const HASH = "sha256";

/** A checkout holding `files` ({path: text}), pinned to those texts. */
function pinnedCheckout(files) {
  const root = scratchDir("studio-kit-");
  const pinned = {};
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
    pinned[path] = createHash(HASH).update(text).digest("hex");
  }
  mkdirSync(dirname(join(root, PIN_PATH)), { recursive: true });
  writeFileSync(join(root, PIN_PATH), JSON.stringify({ studio: "abc1234", hash: HASH, files: pinned }));
  return root;
}

test("copies that match the pin pass", () => {
  expect(kitProblems(pinnedCheckout({ "a.py": "one\n", "tests/b.sh": "two\n" }))).toEqual([]);
});

test("a copy edited here and a copy deleted are each named", () => {
  const root = pinnedCheckout({ "a.py": "one\n", "tests/b.sh": "two\n" });
  writeFileSync(join(root, "a.py"), "one, edited\n");
  rmSync(join(root, "tests/b.sh"));
  expect(kitProblems(root)).toEqual(["a.py was changed here", "tests/b.sh is missing"]);
});

test("a checkout with no pin says how to get one", () => {
  expect(kitProblems(scratchDir("studio-kit-"))).toEqual([`${PIN_PATH} is missing: copy the kit in with studio's bin/copy-kit.mjs`]);
});

test("this repository's kit copies match their pin", () => {
  expect(kitProblems(REPO_ROOT)).toEqual([]);
});
