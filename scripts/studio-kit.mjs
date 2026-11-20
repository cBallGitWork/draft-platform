#!/usr/bin/env node
// The studio kit check. The files .studio/kit.json lists were copied in from the Forge repository
// at the commit it names (Forge's bin/copy-kit.mjs): this fails when one is missing or no longer
// matches its recorded hash, so a kit file is changed in Forge and copied again, never edited here.
// It reads only this checkout, so it runs in CI with no access to the Forge repository.
// Hashes ignore line endings (CRLF reads as LF), so a Windows checkout with core.autocrlf passes.
// This file is itself a kit file.
import { createHash, getHashes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

export const PIN_PATH = ".studio/kit.json";
// Forge's one deny list (a kit file) and where each project must hold it (forge#85)
export const DENY_PATH = ".studio/deny.json";
export const SETTINGS_PATH = ".claude/settings.json";
const RECOPY = "change it in Forge (cBallGitWork/forge) and copy the kit in again with its bin/copy-kit.mjs";

/** A file's hash with CRLF read as LF, so Windows and Mac checkouts hash alike. */
export function hashOf(path, algorithm) {
  const text = readFileSync(path).toString("latin1").replace(/\r\n/g, "\n");
  return createHash(algorithm).update(text, "latin1").digest("hex");
}

/** Whether a pinned path stays inside the project: relative, forward slashes, no "..". */
export const isSafePath = (path) =>
  typeof path === "string" && path !== "" && !isAbsolute(path) && !path.includes("\\") && !path.split("/").includes("..");

/** The pin, or a problem line saying why it can't be read. */
export function readPin(root) {
  const pinFile = join(root, PIN_PATH);
  if (!existsSync(pinFile)) return { problem: `${PIN_PATH} is missing: copy the kit in with Forge's bin/copy-kit.mjs` };
  let pin;
  try {
    pin = JSON.parse(readFileSync(pinFile, "utf8"));
  } catch (error) {
    return { problem: `${PIN_PATH} is not valid JSON (${error.message}): copy the kit in again` };
  }
  if (typeof pin?.files !== "object" || pin.files === null || Array.isArray(pin.files)) return { problem: `${PIN_PATH} has no "files" list: copy the kit in again` };
  if (!getHashes().includes(pin.hash)) return { problem: `${PIN_PATH} names an unknown hash "${pin.hash}": copy the kit in again` };
  const unsafe = Object.keys(pin.files).filter((path) => !isSafePath(path));
  if (unsafe.length) return { problem: `${PIN_PATH} lists paths outside the project (${unsafe.join(", ")}): copy the kit in again` };
  return { pin };
}

/** What's wrong with the kit copies under root: one line each, none when they match the pin. */
export function kitProblems(root) {
  const { pin, problem } = readPin(root);
  if (problem) return [problem];
  const copies = Object.entries(pin.files).flatMap(([path, hash]) => {
    const file = join(root, path);
    if (!existsSync(file)) return [`${path} is missing: restore it with git checkout -- ${path}, or ${RECOPY}`];
    return hashOf(file, pin.hash) === hash ? [] : [`${path} was changed here: undo it with git checkout -- ${path}, or ${RECOPY}`];
  });
  return copies.length || !(DENY_PATH in pin.files) ? copies : denyProblems(root);
}

/** The kit's deny entries missing from the project's settings: one line each. */
export function denyProblems(root) {
  const { deny } = JSON.parse(readFileSync(join(root, DENY_PATH), "utf8"));
  const settingsFile = join(root, SETTINGS_PATH);
  if (!existsSync(settingsFile)) return [`${SETTINGS_PATH} is missing: it must deny everything ${DENY_PATH} lists`];
  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsFile, "utf8"));
  } catch (error) {
    return [`${SETTINGS_PATH} is not valid JSON (${error.message})`];
  }
  const held = new Set(settings?.permissions?.deny ?? []);
  return deny.filter((rule) => !held.has(rule)).map((rule) => `${SETTINGS_PATH} doesn't deny ${rule}: add it to permissions.deny (${DENY_PATH})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = kitProblems(process.cwd());
  if (problems.length) {
    console.error("studio kit: these copies no longer match the pinned kit, or the settings miss its deny list:");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  const { pin } = readPin(process.cwd());
  console.log(`studio kit: ${Object.keys(pin.files).length} file(s) match Forge ${String(pin.studio).slice(0, 7)}`);
}
