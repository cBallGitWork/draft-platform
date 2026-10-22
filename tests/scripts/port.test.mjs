import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import { PORT_RANGE_SIZE, PORT_RANGE_START, appPort, smokePorts } from "../../scripts/port.mjs";

const SCRIPT = join(import.meta.dirname, "../../scripts/port.mjs");

test("smoke's two ports sit one and two ranges above this checkout's app port", () => {
  const app = appPort();
  expect(smokePorts()).toEqual({ dev: app + PORT_RANGE_SIZE, bundle: app + 2 * PORT_RANGE_SIZE });
});

// Every checkout's app port is in the first range, so each server keeping to its own range means
// no checkout's smoke server can land on any checkout's app port, or on another's.
test("the app, smoke dev and smoke bundle ports each keep to their own range", () => {
  const rangeStart = (nth) => PORT_RANGE_START + nth * PORT_RANGE_SIZE;
  const inRange = (port, nth) => port >= rangeStart(nth) && port < rangeStart(nth + 1);
  const { dev, bundle } = smokePorts();
  expect(inRange(appPort(), 0)).toBe(true);
  expect(inRange(dev, 1)).toBe(true);
  expect(inRange(bundle, 2)).toBe(true);
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
