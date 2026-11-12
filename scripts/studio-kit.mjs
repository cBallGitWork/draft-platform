#!/usr/bin/env node
// The studio kit check. The files .studio/kit.json lists were copied in from the studio repository
// at the commit it names (studio's bin/copy-kit.mjs): this fails when one is missing or no longer
// matches its recorded hash, so a kit file is changed in studio and copied again, never edited here.
// It reads only this checkout, so it runs in CI with no access to the studio repository.
// This file is itself a kit file.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const PIN_PATH = ".studio/kit.json";

/** What's wrong with the kit copies under root: one line each, none when they match the pin. */
export function kitProblems(root) {
  const pinFile = join(root, PIN_PATH);
  if (!existsSync(pinFile)) return [`${PIN_PATH} is missing: copy the kit in with studio's bin/copy-kit.mjs`];
  const pin = JSON.parse(readFileSync(pinFile, "utf8"));
  return Object.entries(pin.files).flatMap(([path, hash]) => {
    const file = join(root, path);
    if (!existsSync(file)) return [`${path} is missing`];
    const now = createHash(pin.hash).update(readFileSync(file)).digest("hex");
    return now === hash ? [] : [`${path} was changed here`];
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = kitProblems(process.cwd());
  if (problems.length) {
    console.error("studio kit: these copies no longer match the pinned kit. Change them in the studio repository and copy the kit in again:");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  const pin = JSON.parse(readFileSync(join(process.cwd(), PIN_PATH), "utf8"));
  console.log(`studio kit: ${Object.keys(pin.files).length} file(s) match studio ${pin.studio.slice(0, 7)}`);
}
