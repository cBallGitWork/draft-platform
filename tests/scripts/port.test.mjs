import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import {
  BROWSER_BLOCKED_PORTS,
  PORT_RANGES,
  PORT_RANGE_SIZE,
  appPort,
  portInRange,
  rangeStart,
  smokePorts,
} from "../../scripts/port.mjs";

const SCRIPT = join(import.meta.dirname, "../../scripts/port.mjs");

test("smoke's two ports sit at this checkout's app-port offset in their own ranges", () => {
  const offset = appPort() - rangeStart(PORT_RANGES.app);
  expect(smokePorts()).toEqual({
    dev: portInRange(PORT_RANGES.smokeDev, offset),
    bundle: portInRange(PORT_RANGES.smokeBundle, offset),
  });
});

const OFFSETS = Array.from({ length: PORT_RANGE_SIZE }, (_, offset) => offset);
const inRange = (port, nth) => port >= rangeStart(nth) && port < rangeStart(nth + 1);

test("no port any checkout can be given is one a browser blocks", () => {
  const blocked = Object.values(PORT_RANGES).flatMap((nth) =>
    OFFSETS.map((offset) => portInRange(nth, offset)).filter((port) => BROWSER_BLOCKED_PORTS.has(port)),
  );
  expect(blocked).toEqual([]);
});

// So a smoke server that steps past a blocked port never lands on any checkout's app port.
test("stepping past a blocked port keeps every server in its own range", () => {
  for (const nth of Object.values(PORT_RANGES)) {
    for (const offset of OFFSETS) expect(inRange(portInRange(nth, offset), nth)).toBe(true);
  }
});

test("a checkout whose bundle port lands on 6666 (#641) steps to 6670, past Chrome's 6665-6669", () => {
  const SEEN_IN_641 = 6666;
  const bundleOffset = SEEN_IN_641 - rangeStart(PORT_RANGES.smokeBundle);
  expect(portInRange(PORT_RANGES.smokeBundle, bundleOffset)).toBe(6670);
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
