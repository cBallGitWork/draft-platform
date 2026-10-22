import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import { appPort, smokePorts } from "../../scripts/port.mjs";

const SCRIPT = join(import.meta.dirname, "../../scripts/port.mjs");
const FIRST = 5200;
const HOW_MANY = 700;

test("smoke's two ports sit one and two ranges above this checkout's app port", () => {
  expect(smokePorts()).toEqual({ dev: appPort() + HOW_MANY, bundle: appPort() + 2 * HOW_MANY });
});

// Every checkout's app port is in [FIRST, FIRST + HOW_MANY), so each server keeping to its own
// range means no checkout's smoke server can land on any checkout's app port, or on another's.
test("the app, smoke dev and smoke bundle ports each keep to their own range", () => {
  const inRange = (port, nth) => port >= FIRST + nth * HOW_MANY && port < FIRST + (nth + 1) * HOW_MANY;
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
