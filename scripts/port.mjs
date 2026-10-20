// This checkout's own port for the app, so each worktree's screenshots are of its own code: a
// server another worktree started on a shared port would be shot as this branch's. The same
// checkout always gets the same port, one of HOW_MANY from FIRST, clear of Vite's 5173
// (`npm run dev`), whichever folder inside it this runs from.
//
// Usage: npx vite --port "$(node scripts/port.mjs)" --strictPort

import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FIRST = 5200;
const HOW_MANY = 700;
const CHECKOUT = dirname(dirname(fileURLToPath(import.meta.url)));

export function appPort() {
  return FIRST + (createHash("sha256").update(CHECKOUT).digest().readUInt32BE(0) % HOW_MANY);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(appPort());
