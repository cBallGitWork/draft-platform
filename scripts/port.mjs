// This checkout's own port for the app, so each worktree's screenshots are of its own code: a
// server another worktree started on a shared port would be shot as this branch's. The same
// checkout always gets the same port, one of PORT_RANGE_SIZE from PORT_RANGE_START, clear of
// Vite's 5173 (`npm run dev`), whichever folder inside it this runs from.
//
// Usage: npx vite --port "$(node scripts/port.mjs)" --strictPort

import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PORT_RANGE_START = 5200;
export const PORT_RANGE_SIZE = 700;
const CHECKOUT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The address of a server this machine runs on `port`. */
export const localUrl = (port) => `http://localhost:${port}`;

export function appPort() {
  const checkoutHash = createHash("sha256").update(CHECKOUT).digest().readUInt32BE(0);
  return PORT_RANGE_START + (checkoutHash % PORT_RANGE_SIZE);
}

// `npm run smoke`'s two servers, one and two ranges above appPort(): clear of every checkout's app
// port (the ui-verifier's server among them) and of every other checkout's smoke ports.
export function smokePorts() {
  const app = appPort();
  return { dev: app + PORT_RANGE_SIZE, bundle: app + 2 * PORT_RANGE_SIZE };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(appPort());
}
