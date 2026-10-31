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

// Which range each server's port is in: every checkout's app port is in the first, so `npm run
// smoke`'s two servers, in the others, are clear of all of them (the ui-verifier's among them).
export const PORT_RANGES = { app: 0, smokeDev: 1, smokeBundle: 2 };

export const rangeStart = (nth) => PORT_RANGE_START + nth * PORT_RANGE_SIZE;

/**
 * The port `offset` into the `nth` range, stepped up past any port a browser blocks. No blocked
 * port ends a range, so a stepped port stays in its own (port.test.mjs). A step can land on another
 * checkout's port in the same range, as two checkouts whose paths hash alike already do.
 */
export function portInRange(nth, offset) {
  let port = rangeStart(nth) + offset;
  while (BROWSER_BLOCKED_PORTS.has(port)) port += 1;
  return port;
}

export function appPort() {
  return portInRange(PORT_RANGES.app, checkoutOffset());
}

export function smokePorts() {
  const offset = checkoutOffset();
  return {
    dev: portInRange(PORT_RANGES.smokeDev, offset),
    bundle: portInRange(PORT_RANGES.smokeBundle, offset),
  };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(appPort());
}
