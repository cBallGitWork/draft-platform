import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { PIN_PATH, hashOf, isSafePath, kitProblems, readPin } from "../../scripts/studio-kit.mjs";
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
  const [edited, missing] = kitProblems(root);
  expect(edited).toMatch(/^a\.py was changed here: undo it with git checkout -- a\.py/);
  expect(missing).toMatch(/^tests\/b\.sh is missing: restore it/);
});

test("a CRLF checkout (Windows) still matches the pin", () => {
  const root = pinnedCheckout({ "a.py": "one\ntwo\n" });
  writeFileSync(join(root, "a.py"), "one\r\ntwo\r\n");
  expect(kitProblems(root)).toEqual([]);
});

test("a checkout with no pin says how to get one", () => {
  expect(kitProblems(scratchDir("studio-kit-"))).toEqual([`${PIN_PATH} is missing: copy the kit in with Forge's bin/copy-kit.mjs`]);
});

test("this repository's kit copies match their pin", () => {
  expect(kitProblems(REPO_ROOT)).toEqual([]);
});

test("the helpers Forge's copy-kit shares: line-ending-blind hash, safe paths, a pin read without throwing", () => {
  const root = pinnedCheckout({ "a.py": "one\n" });
  expect(hashOf(join(root, "a.py"), HASH)).toBe(createHash(HASH).update("one\n").digest("hex"));
  expect([isSafePath("a/b.py"), isSafePath("../x"), isSafePath("/etc/x"), isSafePath("a\\b")]).toEqual([true, false, false, false]);
  expect(readPin(root).pin.studio).toBe("abc1234");
  writeFileSync(join(root, PIN_PATH), "{ broken");
  expect(readPin(root).problem).toMatch(/not valid JSON/);
});
