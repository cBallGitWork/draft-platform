import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import {
  BROWSER_BLOCKED_PORTS,
  PORT_RANGE_SIZE,
  PORT_RANGE_START,
  appPort,
  portInRange,
  smokePorts,
} from "../../scripts/port.mjs";

const SCRIPT = join(import.meta.dirname, "../../scripts/port.mjs");

test("smoke's two ports sit at this checkout's app-port offset in the second and third ranges", () => {
  const offset = appPort() - PORT_RANGE_START;
  expect(smokePorts()).toEqual({ dev: portInRange(1, offset), bundle: portInRange(2, offset) });
});

const RANGES = { app: 0, dev: 1, bundle: 2 };
const OFFSETS = Array.from({ length: PORT_RANGE_SIZE }, (_, offset) => offset);
const rangeStart = (nth) => PORT_RANGE_START + nth * PORT_RANGE_SIZE;
const inRange = (port, nth) => port >= rangeStart(nth) && port < rangeStart(nth + 1);

test("no port any checkout can be given is one a browser blocks", () => {
  const blocked = Object.values(RANGES).flatMap((nth) =>
    OFFSETS.map((offset) => portInRange(nth, offset)).filter((port) => BROWSER_BLOCKED_PORTS.has(port)),
  );
  expect(blocked).toEqual([]);
});

// Every checkout's app port is in the first range, so a smoke server that steps past a blocked
// port and still keeps to its own range can never land on any checkout's app port.
test("stepping past a blocked port keeps every server in its own range", () => {
  for (const nth of Object.values(RANGES)) {
    for (const offset of OFFSETS) expect(inRange(portInRange(nth, offset), nth)).toBe(true);
  }
});

test("a checkout whose bundle port lands on 6666 (#641) steps to 6670, past Chrome's 6665-6669", () => {
  expect(portInRange(RANGES.bundle, 6666 - rangeStart(RANGES.bundle))).toBe(6670);
});

test("this checkout's app, smoke dev and smoke bundle ports each keep to their own range", () => {
  const { dev, bundle } = smokePorts();
  expect(inRange(appPort(), RANGES.app)).toBe(true);
  expect(inRange(dev, RANGES.dev)).toBe(true);
  expect(inRange(bundle, RANGES.bundle)).toBe(true);
});

test("run directly, it prints this checkout's app port", () => {
  const run = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  expect(run.status).toBe(0);
  expect(run.stdout.trim()).toBe(String(appPort()));
});

test("imported from `node -e`, where there is no script path, it loads without throwing", () => {
  const run = spawnSync(
    process.execPath,
    ["-e", `import(${JSON.stringify(pathToFileURL(SCRIPT).href)}).then((m) => console.log(m.appPort()))`],
    { encoding: "utf8" },
  );
  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(run.stdout.trim()).toBe(String(appPort()));
});
