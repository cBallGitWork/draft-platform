import { expect, test } from "vitest";

// ARCHITECTURE.md "Where code lives", rule 4: a feature's words.ts never re-exports another
// feature's words; words two features say live in src/shared/words.ts (#1330, #1581). Beside
// importCycles.test.ts, which catches only a loop. A re-export not yet moved sits in
// STILL_REEXPORTED, which only shrinks.

const SOURCES = import.meta.glob("../../src/**/words.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const SOURCE_PREFIX = "../../";

/** `export … from "x"`, over as many lines as its names take. */
const EXPORT_FROM = /^export\s+(?:type\s+)?\{[^}]*\}\s*from\s*["']([^"']+)["']/gm;

/** Re-exports of another feature's words still to move to src/shared/words.ts: "from -> to". */
const STILL_REEXPORTED = ["src/matchup/words.ts -> src/playerCard/words"];

/** The feature a path under src/ belongs to: its first folder. */
const featureOf = (path: string) => path.split("/")[1];

function resolve(from: string, specifier: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

function crossFeatureReexports(): string[] {
  const found: string[] = [];
  for (const [key, source] of Object.entries(SOURCES)) {
    const path = key.slice(SOURCE_PREFIX.length);
    for (const [, specifier] of source.matchAll(EXPORT_FROM)) {
      if (!specifier.startsWith(".")) continue;
      const target = resolve(path, specifier);
      if (!target.startsWith("src/")) continue;
      if (featureOf(target) !== featureOf(path) && featureOf(target) !== "shared") found.push(`${path} -> ${target}`);
    }
  }
  return found.sort();
}

test("no feature's words.ts re-exports another feature's words but those still to move", () => {
  expect(crossFeatureReexports()).toEqual([...STILL_REEXPORTED].sort());
});

test("finds the re-exports it is there to catch", () => {
  expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
  expect(resolve("src/home/words.ts", "../table/words")).toBe("src/table/words");
});
