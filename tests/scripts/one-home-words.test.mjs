import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { BASELINE, baselineOf, literalsOf, newHits, oneHomeHits, phraseMatcher } from "../../scripts/one-home-words.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

// The one-home words check (#1812): a phrase written in two words files, or retyped in a test, is a
// hit; an import, the words function's own line, the allow comment and the baseline let one through.

const DRAFT = ["src/draft/words.ts", `export const addWords = "Add to queue";\nexport const head = (n: number) => \`Pick \${n} of the round\`;\n`];
const SHORTLIST = ["src/scouting/shortlist/words.ts", `export const queueWords = "Add to queue";\n`];
const LINEUP = ["convex/lineup/lineupWords.ts", `export const startsWords = (n: number) => \`A lineup starts 11 players; this one starts \${n}.\`;\nexport const fullWords = "A lineup starts 11 players; this one starts 5.";\n`];

const hitsOf = (homes, tests = []) => oneHomeHits(homes, tests).map(({ file, line, phrase, home }) => `${file}:${line} ${phrase} <- ${home}`);

test("a phrase in two words files is a hit on the second, naming the first as its home", () => {
  expect(hitsOf([DRAFT, SHORTLIST])).toEqual(["src/scouting/shortlist/words.ts:1 Add to queue <- src/draft/words.ts"]);
});

test("a shared words file is the home whatever its path sorts as", () => {
  const shared = ["src/shared/words.ts", `export const addToQueueWords = "Add to queue";\n`];
  expect(hitsOf([DRAFT, shared])).toEqual(["src/draft/words.ts:1 Add to queue <- src/shared/words.ts"]);
});

test("one file importing the other passes", () => {
  const importing = ["src/scouting/shortlist/words.ts", `import { addWords } from "../../draft/words";\nexport const queueWords = "Add to queue";\n`];
  expect(hitsOf([DRAFT, importing])).toEqual([]);
});

test("a short template fragment and a short preview string aren't phrases", () => {
  const fragment = ["src/home/words.ts", `export const ofWords = (n: number) => \`\${n} of the round\`;\n`];
  const preview = ["src/draft/preview.ts", `const NAME = "Add to queue";\n`];
  expect(hitsOf([DRAFT, fragment, preview])).toEqual([]);
});

test("a test retyping a phrase, whole or inside a longer string, is a hit", () => {
  const retyped = ["tests/src/myTeam/tactics/liveTactics.test.tsx", `it("refuses", () => {\n  expect(screen.getByRole("alert")).toHaveTextContent("A lineup starts 11 players; this one starts 5.");\n  screen.getByText("Saved. A lineup starts 11 players; this one starts 4.");\n});\n`];
  expect(hitsOf([LINEUP], [retyped])).toEqual([
    "tests/src/myTeam/tactics/liveTactics.test.tsx:2 A lineup starts 11 players; this one starts 5. <- convex/lineup/lineupWords.ts",
    "tests/src/myTeam/tactics/liveTactics.test.tsx:3 A lineup starts 11 players; this one starts <- convex/lineup/lineupWords.ts",
  ]);
});

test("a test importing the phrase passes, and so does the line checking the words function itself", () => {
  const imported = ["tests/src/draft/queue.test.tsx", `import { addWords } from "../../../src/draft/words";\nscreen.getByRole("button", { name: addWords });\n`];
  const wordsLine = ["tests/convex/lineup/lineupWords.test.ts", `import { startsWords } from "../../../convex/lineup/lineupWords";\nexpect(startsWords(5)).toBe("A lineup starts 11 players; this one starts 5.");\n`];
  expect(hitsOf([DRAFT, LINEUP], [imported, wordsLine])).toEqual([]);
});

test("the allow comment lets a line through, in a words file or a test", () => {
  const allowed = ["src/scouting/shortlist/words.ts", `export const queueWords = "Add to queue"; // one-home-ok: the shortlist's button reads alone\n`];
  const allowedTest = ["tests/src/draft/queue.test.tsx", `screen.getByText("Add to queue"); // one-home-ok: the label is the point\n`];
  const noReason = ["tests/src/draft/other.test.tsx", `screen.getByText("Add to queue"); // one-home-ok:\n`];
  expect(hitsOf([DRAFT, allowed], [allowedTest, noReason])).toEqual(["tests/src/draft/other.test.tsx:1 Add to queue <- src/draft/words.ts"]);
});

test("a baselined hit passes and a new one fails", () => {
  const hits = oneHomeHits([DRAFT, SHORTLIST], [["tests/src/a.test.tsx", `screen.getByText("Add to queue");\n`]]);
  const baseline = baselineOf(hits.slice(0, 1));
  expect(baseline).toEqual({ "src/scouting/shortlist/words.ts": ["Add to queue"] });
  expect(newHits(hits, baseline).map(({ file }) => file)).toEqual(["tests/src/a.test.tsx"]);
});

test("strings are read as TypeScript reads them: comments skipped, escapes undone, templates split", () => {
  const source = `// "not this"\nconst a = 'don\\'t'; /* "nor this" */\nconst b = \`one \${x} two\`;\nconst c = <p>Don't</p>;\n`;
  expect(literalsOf(source, "x.tsx")).toEqual([
    { value: "don't", line: 2, fragment: false },
    { value: "one ", line: 3, fragment: true },
    { value: " two", line: 3, fragment: true },
  ]);
});

test("the matcher finds a phrase only as whole words, preferring the longest", () => {
  const matcher = phraseMatcher(["Add to queue", "Add to queue first", "a (b) c?"]);
  expect("Then Add to queue first.".match(matcher)?.[0]).toBe("Add to queue first");
  expect("Add to queues".match(matcher)).toBeNull();
  expect("x a (b) c? y".match(matcher)?.[0]).toBe("a (b) c?");
});

// verify's steps each need a twin in .github/workflows/verify.yml (lint-wiring.test.mjs), so the
// check runs on the repo here, inside `npm test`, rather than as a step of its own.
test("the repo's own words and tests pass", () => {
  const output = execFileSync(process.execPath, ["scripts/one-home-words.mjs"], { cwd: REPO_ROOT, encoding: "utf8" });
  expect(output).toMatch(/^one-home words: nothing written twice beyond the \d+ hits the baseline holds/);
});

test("the baseline on file is sorted and holds each phrase once, as --write-baseline writes it", () => {
  const baseline = JSON.parse(readFileSync(join(REPO_ROOT, BASELINE), "utf8"));
  const hits = Object.entries(baseline).flatMap(([file, phrases]) => phrases.map((phrase) => ({ file, phrase })));
  expect(baselineOf(hits)).toEqual(baseline);
  expect(Object.keys(baseline)).toEqual(Object.keys(baselineOf(hits)));
});
