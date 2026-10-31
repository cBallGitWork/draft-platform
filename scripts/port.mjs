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

// The ports browsers refuse to open (`net::ERR_UNSAFE_PORT` in Chrome), kept to the three ranges
// this script hands out (5200-7299). From Chromium's kRestrictedPorts in net/base/port_util.cc
// (main, 31 Oct 2026), plus 6679, which the Fetch standard's "bad port" list also has (#641).
export const BROWSER_BLOCKED_PORTS = new Set([6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697]);

/** The address of a server this machine runs on `port`. */
export const localUrl = (port) => `http://localhost:${port}`;

const checkoutOffset = () =>
  createHash("sha256").update(CHECKOUT).digest().readUInt32BE(0) % PORT_RANGE_SIZE;

/**
 * The port `offset` into the `nth` range from PORT_RANGE_START, stepped up past any port a browser
 * blocks. No blocked port ends a range, so a stepped port stays in its own range (port.test.mjs).
 */
export function portInRange(nth, offset) {
  let port = PORT_RANGE_START + nth * PORT_RANGE_SIZE + offset;
  while (BROWSER_BLOCKED_PORTS.has(port)) port += 1;
  return port;
}

export function appPort() {
  return portInRange(0, checkoutOffset());
}

// `npm run smoke`'s two servers, in the second and third ranges at the app port's offset: clear of
// every checkout's app port (the ui-verifier's server among them), which are all in the first, and
// of every other checkout's smoke ports unless a blocked port is stepped past onto one.
export function smokePorts() {
  const offset = checkoutOffset();
  return { dev: portInRange(1, offset), bundle: portInRange(2, offset) };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(appPort());
}
