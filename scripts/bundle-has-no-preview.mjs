#!/usr/bin/env node
// The production bundle holds none of the preview's made-up data (#218): main.tsx loads the
// preview modules with a dynamic import() behind import.meta.env.DEV, which `vite build` drops.
// Fails when a file in dist/ holds a string only a preview module has. Each src/**/preview.ts
// names one string in NEEDLES, and the check fails first if a preview module names none, its
// string is no longer in it, or another source file holds it too, so a renamed string or a new
// preview module can't leave it blind and a shared one can't fail it for nothing.
// Run from the repo after `vite build`: `npm run build` runs both, so CI does. An argument names
// another built folder than dist/ (its tests do).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const DIST = process.argv[2] ?? "dist";
const SOURCES = ["src", "convex"];
const PREVIEW_FILE = "preview.ts";

/** A string only that preview module holds, by its path; null for one that holds no data of its
 *  own (its words are the app's, its rules row src/rules/preview.ts's). */
const NEEDLES = {
  "src/preview.ts": "preview-pro-league",
  "src/admin/preview.ts": "Nick Woltemade",
  "src/feedback/preview.ts": "preview-feedback-",
  "src/gameweeks/preview.ts": "no gameweek was changed",
  "src/joining/preview.ts": "dan@example.com",
  "src/leagueSettings/preview.ts": null,
  "src/mail/preview.ts": "Draft night is Friday at eight",
  "src/patches/preview.ts": "preview-patch-",
  "src/playerCard/preview.ts": "Hamstring injury - 75% chance of playing",
  "src/rules/preview.ts": "preview-rules",
  "src/scoring/preview.ts": null,
  "src/scouting/preview.ts": "Virgil van Dijk",
  "src/squads/preview.ts": "preview-team-1",
  "src/table/preview.ts": "Ctrl Alt Defeat",
};

function fail(message) {
  console.error(`preview bundle check: ${message}`);
  process.exit(1);
}

/** Every file under `dir`, as a path from the repo. */
function filesUnder(dir) {
  return readdirSync(dir, { recursive: true })
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile());
}

const sources = new Map(SOURCES.flatMap(filesUnder).map((path) => [path, readFileSync(path, "utf8")]));
const previewFiles = [...sources.keys()].filter((path) => basename(path) === PREVIEW_FILE);
const unnamed = previewFiles.filter((path) => !Object.hasOwn(NEEDLES, path));
if (unnamed.length > 0) fail(`${unnamed.join(", ")} has no entry in NEEDLES; name a string only it holds.`);
for (const path of Object.keys(NEEDLES)) {
  if (!previewFiles.includes(path)) fail(`${path} is in NEEDLES but isn't there; take it out.`);
}
const named = Object.entries(NEEDLES).filter(([, needle]) => needle !== null);
for (const [path, needle] of named) {
  if (!sources.get(path).includes(needle)) fail(`${path} no longer holds "${needle}"; name a string it does hold.`);
  const shared = [...sources].filter(([file, text]) => file !== path && text.includes(needle)).map(([file]) => file);
  if (shared.length > 0) fail(`"${needle}" (${path}) is in ${shared.join(", ")} too; name a string only ${path} holds.`);
}

let built;
try {
  built = filesUnder(DIST);
} catch (error) {
  fail(`can't read ${DIST}/ (${error.code ?? error.message}); run vite build first.`);
}
const leaks = built.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  return named.filter(([, needle]) => text.includes(needle)).map(([path, needle]) => `${file} holds "${needle}" (${path})`);
});
if (leaks.length > 0) fail(`the bundle ships preview data:\n  ${leaks.join("\n  ")}`);
console.log(`preview bundle check: none of the ${built.length} files in ${DIST}/ holds a preview module's string.`);
