// This folder's own port for the app, so each worktree's screenshots are of its own code: a
// server another worktree started on a shared port would be shot as this branch's. The same
// folder always gets the same port, from 5200 to 5899, clear of Vite's 5173 (`npm run dev`).
//
// Usage: npx vite --port "$(node scripts/port.mjs)" --strictPort

import { createHash } from "node:crypto";

const FIRST = 5200;
const HOW_MANY = 700;

export function folderPort(folder) {
  return FIRST + (createHash("sha256").update(folder).digest().readUInt32BE(0) % HOW_MANY);
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(folderPort(process.cwd()));
