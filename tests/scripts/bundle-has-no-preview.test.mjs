// scripts/bundle-has-no-preview.mjs (#218), run on the repo's own sources against a made-up built
// folder.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";

const REPO = join(import.meta.dirname, "../..");
const CHECK = join(REPO, "scripts/bundle-has-no-preview.mjs");
/** squads' preview string, from the check's NEEDLES. */
const SQUADS_NEEDLE = "preview-team-1";

let built;
afterEach(() => built && rmSync(built, { recursive: true, force: true }));

/** A built folder holding `files` (path in it to text). */
function builtFolder(files) {
  built = mkdtempSync(join(tmpdir(), "bundle-check-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(built, path)), { recursive: true });
    writeFileSync(join(built, path), text);
  }
  return built;
}

/** The check on `folder`: its exit code and everything it printed. */
function check(folder) {
  const { status, stdout, stderr } = spawnSync(process.execPath, [CHECK, folder], { cwd: REPO, encoding: "utf8" });
  return { code: status, output: stdout + stderr };
}

test("a bundle holding no preview string passes", () => {
  const { code, output } = check(builtFolder({ "index.html": "<div id=root>", "assets/index.js": "mount()" }));
  expect(output).toContain("none of the 2 files");
  expect(code).toBe(0);
});

test("a bundle holding a preview module's string fails, naming the file, the string and the module", () => {
  const { code, output } = check(builtFolder({ "assets/index.js": `const team = "${SQUADS_NEEDLE}";` }));
  expect(code).toBe(1);
  expect(output).toContain(`assets/index.js holds "${SQUADS_NEEDLE}" (src/squads/preview.ts)`);
});

test("with no built folder, the check fails saying to build first", () => {
  const { code, output } = check(join(tmpdir(), "bundle-check-no-such-folder"));
  expect(code).toBe(1);
  expect(output).toContain("run vite build first");
});
