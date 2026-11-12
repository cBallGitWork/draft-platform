import { expect, test } from "vitest";
import { namedLiteralHits, trackedSources } from "../../scripts/named-literals.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

const HOME = ["convex/scoring/statKeys.ts", 'export const BLOCKS = "outfielder_block";\nexport const OWN_STAT_PREFIX = "league:";\n'];
const FIX = "; import it, or end the line with // literal-ok: <reason>";

test("a file that retypes another's exported key is named, with the constant to import", () => {
  expect(namedLiteralHits([HOME, ["src/a.ts", 'const key = "outfielder_block";\n']])).toEqual([
    `src/a.ts:1 "outfielder_block" is BLOCKS (convex/scoring/statKeys.ts)${FIX}`,
  ]);
});

test("the same retyping with a trailing // literal-ok: and a reason passes", () => {
  expect(namedLiteralHits([HOME, ["src/a.ts", 'const key = "outfielder_block"; // literal-ok: Opta\'s own name\n']])).toEqual([]);
});

test("a string starting with a *_PREFIX value is named; one built from the constant passes", () => {
  expect(
    namedLiteralHits([
      HOME,
      ["src/typed.ts", 'const a = "league:stops";\nconst b = `league:${name}`;\n'],
      ["src/built.ts", "const a = `${OWN_STAT_PREFIX}stops`;\n"],
    ]),
  ).toEqual([
    `src/typed.ts:1 "league:stops" starts with OWN_STAT_PREFIX (convex/scoring/statKeys.ts)${FIX}`,
    `src/typed.ts:2 "league:" starts with OWN_STAT_PREFIX (convex/scoring/statKeys.ts)${FIX}`,
  ]);
});

test("plain words, class lists, lower-case names, preview data and files outside convex/ and src/ are left out", () => {
  const home = [
    "src/ui/home.ts",
    'export const WORD = "goals";\nexport const ROW = "flex gap-2";\nexport const lower_key = "own_goals";\nexport const KEY = "own_goals";\n',
  ];
  expect(
    namedLiteralHits([
      home,
      ["src/a.ts", 'const a = ["goals", "flex gap-2"];\nimport x from "own_goals";\n'],
      ["src/scouting/preview.ts", 'const a = "own_goals";\n'],
      ["tests/a.test.ts", 'const a = "own_goals";\n'],
    ]),
  ).toEqual([]);
});

test("this repository's convex/ and src/ retype no value with a named home", () => {
  expect(namedLiteralHits(trackedSources(REPO_ROOT))).toEqual([]);
});

test("the file that holds the constant may use its own value", () => {
  expect(namedLiteralHits([["src/k.ts", 'export const KEY = "own_goals";\nconst again = "own_goals";\n']])).toEqual([]);
});
