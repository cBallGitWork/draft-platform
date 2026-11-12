import { expect, test } from "vitest";
import {
  STILL_IMPORTING_SCHEMA,
  STILL_REACHING_IN,
  STILL_USED_BY_THREE,
} from "../support/convex/featureImports.breaches";
import { FROM_CLAUSE, SOURCE_PREFIX, typeOnly } from "../support/importLines";

// ARCHITECTURE.md "Where code lives", rule 4, with tests/convex/importCycles.test.ts, which catches
// only a loop (#1330, #1581). A feature imports another only through what that one offers others: its
// Link component, its seam's types, its paths.ts, its live<Feature>.ts (into a live file) and its
// preview.ts (into a preview). And a feature's words.ts never re-exports another feature's words;
// words two features say live in src/shared/words.ts. Two more scans (#1815): only
// convex/schema.ts imports a convex/schema/ file, whose files build on one another; and by rule 5,
// a file three other features use, in src/ or convex/, moves to shared/ or ui/. Each scan's
// breaches on main when it began sit on a list in featureImports.breaches.ts that only shrinks.

const SOURCES = import.meta.glob("../../src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const CONVEX_SOURCES = import.meta.glob(
  ["../../convex/**/*.ts", "!../../convex/_generated/**"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

/** Folders that join every feature (the app's start and the routes), so they import any of them,
 *  as does src/'s top level (main.tsx). */
const JOINERS = new Set(["app", "routes"]);
/** convex/'s joiner: convex/schema/, whose tables take each feature's shapes. */
const CONVEX_JOINERS = new Set(["schema"]);
/** Folders under src/ every feature may import: no feature owns them. src/rules/ is the editing
 *  kit the two rules screens share, by ARCHITECTURE.md's own line. */
const OPEN = new Set(["shared", "ui", "rules"]);
/** convex/'s folders every feature may import: shared code and Convex's generated code. */
const CONVEX_OPEN = new Set(["shared", "_generated"]);
/** The one file that imports convex/schema/, and the folder whose files build on one another. */
const SCHEMA_FILE = "convex/schema.ts";
const SCHEMA_FOLDER = "convex/schema/";
/** One feature's files ARCHITECTURE.md names as offered to others: the menu's section paths,
 *  which every feature's paths.ts builds on, and Mail's date block. */
const OFFERED_FILES = new Set(["src/frame/menu", "src/mail/DateBlock"]);

/** The feature a path under src/ or convex/ belongs to: its first folder. */
const featureOf = (path: string) => path.split("/")[1];
const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const withoutExtension = (path: string) => path.replace(/\.tsx?$/, "");
/** True for a file at src/'s or convex/'s top level, which no feature owns. */
const topLevel = (path: string) => path.split("/").length === 2;

function resolve(from: string, specifier: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

/** True when `target` is one of the files a feature offers others, by rule 4. */
const offeredFile = (target: string) =>
  OFFERED_FILES.has(target) ||
  /^(paths|seam|preview|live[A-Z]\w*|\w*Links?)$/.test(nameOf(target));

/** True when `target` is something its feature offers the importer, by rule 4. */
function offered(
  importer: string,
  target: string,
  clause: string,
  kind: string,
): boolean {
  if (!offeredFile(target)) return false;
  const name = nameOf(target);
  const from = nameOf(withoutExtension(importer));
  if (name === "seam") return kind === "import" && typeOnly(clause);
  if (name === "preview") return from === "preview";
  if (/^live[A-Z]/.test(name)) return /^live[A-Z]/.test(from);
  return true;
}

type RelativeImport = {
  path: string;
  kind: string;
  clause: string;
  target: string;
};

/** Every relative import of code in `sources`, its target resolved and without the extension. */
function relativeImports(sources: Record<string, string>): RelativeImport[] {
  return Object.entries(sources).flatMap(([key, source]) => {
    const path = key.slice(SOURCE_PREFIX.length);
    return [...source.matchAll(FROM_CLAUSE)]
      .filter(
        ([, , , specifier]) =>
          specifier.startsWith(".") && !/\.css$/.test(specifier),
      )
      .map(([, kind, clause, specifier]) => ({
        path,
        kind,
        clause,
        target: withoutExtension(resolve(path, specifier)),
      }));
  });
}

type CrossImport = { line: string; wordsReexport: boolean };

/** Every import into another feature that isn't something it offers, and every words.ts
 *  re-export from another feature, offered or not, as "importer -> target". */
function crossImports(sources: Record<string, string>): CrossImport[] {
  const found = new Map<string, CrossImport>();
  for (const { path, kind, clause, target } of relativeImports(sources)) {
    if (JOINERS.has(featureOf(path)) || topLevel(path)) continue;
    if (
      !target.startsWith("src/") ||
      featureOf(target) === featureOf(path) ||
      OPEN.has(featureOf(target))
    )
      continue;
    const wordsReexport = kind === "export" && nameOf(path) === "words.ts";
    const line = `${withoutExtension(path)} -> ${target}`;
    if (wordsReexport || !offered(path, target, clause, kind))
      found.set(line, {
        line,
        wordsReexport: wordsReexport || found.get(line)?.wordsReexport === true,
      });
  }
  return [...found.keys()].sort().map((line) => found.get(line)!);
}

/** Every import of a convex/schema/ file but schema.ts's and the folder's own, as
 *  "importer -> target". */
function schemaImports(sources: Record<string, string>): string[] {
  const found = relativeImports(sources)
    .filter(
      ({ path, target }) =>
        target.startsWith(SCHEMA_FOLDER) &&
        path !== SCHEMA_FILE &&
        !path.startsWith(SCHEMA_FOLDER),
    )
    .map(({ path, target }) => `${withoutExtension(path)} -> ${target}`);
  return [...new Set(found)].sort();
}

/** Every feature file that three or more other features import, within src/ or within convex/,
 *  rule 5's third use. Joiners don't count as users; open folders and, in src/, what rule 4 has a
 *  feature offer are no feature's insides. */
function usedByThree(sources: Record<string, string>): string[] {
  const users = new Map<string, Set<string>>();
  for (const { path, target } of relativeImports(sources)) {
    const root = path.split("/")[0];
    const inSrc = root === "src";
    if (
      topLevel(path) ||
      (inSrc ? JOINERS : CONVEX_JOINERS).has(featureOf(path)) ||
      !target.startsWith(`${root}/`) ||
      topLevel(target) ||
      featureOf(target) === featureOf(path) ||
      (inSrc ? OPEN : CONVEX_OPEN).has(featureOf(target)) ||
      (inSrc && offeredFile(target))
    )
      continue;
    users.set(target, (users.get(target) ?? new Set()).add(featureOf(path)));
  }
  return [...users]
    .filter(([, features]) => features.size >= 3)
    .map(([target]) => target)
    .sort();
}

const reachingIn = (sources: Record<string, string> = SOURCES) =>
  crossImports(sources).map(({ line }) => line);
const crossFeatureReexports = (sources: Record<string, string> = SOURCES) =>
  crossImports(sources)
    .filter(({ wordsReexport }) => wordsReexport)
    .map(({ line }) => line);

test("no feature's words.ts re-exports another feature's words but those still to move", () => {
  // None is left to move (#1581), so none may come back, even of words a feature offers.
  expect(crossFeatureReexports()).toEqual([]);
});

test("no feature reaches into another's insides but those still to move", () => {
  expect(reachingIn()).toEqual([...STILL_REACHING_IN].sort());
});

test("finds the re-exports it is there to catch", () => {
  expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
  expect(resolve("src/home/words.ts", "../table/words")).toBe(
    "src/table/words",
  );
  const sources = {
    "../../src/home/words.ts":
      'export { TABLE_TITLE } from "../table/words";\nimport { columns } from "../table/words";',
    "../../src/home/HomePage.tsx": [
      'import { FormChips } from "../myTeam/header/FormChips";',
      'import { MatchupLink } from "../matchup/MatchupLink";',
      'import { tablePath } from "../table/paths";',
      'import type { TableSeam } from "../table/seam";',
      'import { tableSeam } from "../table/seam";',
      'import { previewTable } from "../table/preview";',
      'import { Panel } from "../ui/Panel";',
      'import { HOME_PATH } from "../frame/menu";',
    ].join("\n"),
    "../../src/home/preview.ts":
      'import { previewTable } from "../table/preview";',
    "../../src/home/liveHome.ts":
      'import { liveTable } from "../table/liveTable";',
    "../../src/routes/router.tsx":
      'import { TablePage } from "../table/TablePage";',
    "../../src/main.tsx": 'import { liveApp } from "./app/liveApp";',
  };
  expect(reachingIn(sources)).toEqual([
    "src/home/HomePage -> src/myTeam/header/FormChips",
    "src/home/HomePage -> src/table/preview",
    "src/home/HomePage -> src/table/seam",
    "src/home/words -> src/table/words",
  ]);
  expect(crossFeatureReexports(sources)).toEqual([
    "src/home/words -> src/table/words",
  ]);
});

const EVERY_SOURCE = { ...SOURCES, ...CONVEX_SOURCES };

test("only schema.ts imports a convex/schema/ file but those still to move", () => {
  expect(schemaImports(EVERY_SOURCE)).toEqual(
    [...STILL_IMPORTING_SCHEMA].sort(),
  );
});

test("no feature's file has three other features using it but those still to move", () => {
  expect(usedByThree(EVERY_SOURCE)).toEqual([...STILL_USED_BY_THREE].sort());
});

test("finds the schema imports it is there to catch", () => {
  expect(Object.keys(CONVEX_SOURCES).length).toBeGreaterThan(100);
  const sources = {
    "../../convex/schema.ts": 'import { tradeTables } from "./schema/trades";',
    "../../convex/schema/draft.ts": 'import { tradePick } from "./trades";',
    "../../convex/trades/tradeReviewers.ts":
      'import type { tradeReviewer } from "../schema/trades";',
    "../../src/trades/TradesPage.tsx":
      'import { tradeTables } from "../../convex/schema/trades";',
  };
  expect(schemaImports(sources)).toEqual([
    "convex/trades/tradeReviewers -> convex/schema/trades",
    "src/trades/TradesPage -> convex/schema/trades",
  ]);
});

test("finds the third feature's use it is there to catch", () => {
  // Each row: a target, then the feature folders importing it.
  const rows = [
    // Three other features use lineup's file: the third use.
    "lineup/autoTeamSwitch convex/trades convex/table convex/matchup",
    // Two others, or a third that is its owner or the schema, stay with the owner.
    "scoring/values convex/home convex/rules convex/scoring convex/schema",
    // Shared code and generated code belong to no feature.
    "shared/time convex/a convex/b convex/c",
    "_generated/server convex/a convex/b convex/c",
    // In src/, the same, and what a feature offers others may have any number of users.
    "myTeam/claims/words src/draft src/scouting src/table",
    "table/paths src/draft src/scouting src/home",
    "ui/Panel src/draft src/scouting src/home",
    "leagues/access src/mail src/matchup src/routes",
    // A src/ file's convex/ use counts in neither tree.
    "../convex/stats/seasonStats src/draft src/scouting src/table",
  ];
  const sources = Object.fromEntries(
    rows.flatMap((row) => {
      const [target, ...features] = row.split(" ");
      return features.map((feature) => [
        `../../${feature}/${target.replace(/\W/g, "_")}.ts`,
        `import { y } from "../${target}";`,
      ]);
    }),
  );
  expect(usedByThree(sources)).toEqual([
    "convex/lineup/autoTeamSwitch",
    "src/myTeam/claims/words",
  ]);
});
