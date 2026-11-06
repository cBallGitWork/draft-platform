#!/usr/bin/env node
// Ties Craig's answers to the tests (#454). An answer in spec/NN-*.md ends its line with its ID in
// backticks, such as `S07.2`: opaque and stable, never renumbered or reused, and a dropped answer
// keeps its ID marked `S07.2 withdrawn`. A test cites an answer by writing its ID anywhere in the
// file. Fails on an ID given twice, an ID in the wrong spec file, and a mention of an ID no answer
// has or one withdrawn; then lists the answers no test cites. "Uncited", never "covered": whether
// a citing test really asserts the answer is pr-reviewer's call.
// Against origin/main where the branch left it (Craig, 6 Nov 2026: every new answer gets an ID,
// every new check names the answer it tests, and a changed answer's checks are flagged, never
// blocked): fails on a new or reworded answer with no ID and on an ID main has that the branch
// drops; lists the tests citing an answer the branch changes, and each new test file citing none.
// Run from the repo: `node scripts/spec-ids.mjs`; `npm run verify` runs it, so CI does.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { branchCheck } from "./branchCheck.mjs";

const ID = /\bS(\d{2})\.\d+\b/g;
/** An answer's own ID, at the end of its line; any other mention of an ID is a reference. */
const GIVEN = /`(S(\d{2})\.\d+)( withdrawn)?`\s*$/;
const SPEC_FILE = /^(\d{2})-.*\.md$/;
const TEST_FILE = /\.(ts|tsx|mjs)$/;
/** A check of its own, as tests-kept counts one; files in tests/support/ only help. */
const CHECK_FILE = /\.(test|spec)\.(ts|tsx|mjs)$/;
/** This checker's own test, whose made-up IDs are its fixtures, not citations. */
const OWN_TEST = "tests/scripts/spec-ids.test.mjs";

/** What the spec files give and mention, and what's wrong in them. `specs` maps a file's name to its text. */
function readSpecs(specs) {
  const answers = new Map();
  const mentions = [];
  const problems = [];
  for (const [file, text] of specs) {
    const fileNumber = SPEC_FILE.exec(file)?.[1];
    for (const line of text.split("\n")) {
      const given = GIVEN.exec(line);
      if (given !== null) {
        const [, id, number, withdrawn] = given;
        if (answers.has(id)) problems.push(`${id} is given twice: in ${answers.get(id).file} and ${file}`);
        else answers.set(id, { file, withdrawn: withdrawn !== undefined });
        if (number !== fileNumber) problems.push(`${id} is given in ${file}, but its number says spec/${number}`);
      }
      const rest = given === null ? line : line.slice(0, given.index);
      for (const [id] of rest.matchAll(ID)) mentions.push({ id, where: file });
    }
  }
  return { answers, mentions, problems };
}

/** Every problem with the answers and their mentions, and the live answers no test cites.
 *  `tests` maps a test file's path to its text. */
export function checkIds(specs, tests) {
  const { answers, mentions, problems } = readSpecs(specs);
  const cited = new Set();
  for (const [path, text] of tests) {
    for (const [id] of text.matchAll(ID)) {
      mentions.push({ id, where: path });
      cited.add(id);
    }
  }
  for (const { id, where } of mentions) {
    const answer = answers.get(id);
    if (answer === undefined) problems.push(`${where} mentions ${id}, which no answer in spec/ has`);
    else if (answer.withdrawn) problems.push(`${where} mentions ${id}, which is withdrawn`);
  }
  const uncited = [...answers].filter(([id, answer]) => !answer.withdrawn && !cited.has(id)).map(([id]) => id);
  return { answers: answers.size, problems: [...new Set(problems)], uncited };
}

/** Each answer in a spec file's text: a bullet at a line's start with the indented lines under it,
 *  as its words with the spacing evened out and its own ID cut off, and that ID, if it has one. */
function answersOf(file, text) {
  const bullets = [];
  let current;
  for (const line of text.split("\n")) {
    if (line.startsWith("- ")) bullets.push((current = [line]));
    else if (current !== undefined && line.startsWith("  ") && line.trim() !== "") current.push(line);
    else current = undefined;
  }
  return bullets.map((lines) => {
    const given = GIVEN.exec(lines.at(-1));
    const words = lines.join(" ").slice("- ".length).replace(GIVEN, "").replace(/\s+/g, " ").trim();
    return { file, words, id: given?.[1], withdrawn: given?.[3] !== undefined };
  });
}

/** What the branch does to origin/main's answers and checks. `before` (origin/main) and `after`
 *  (the branch) each hold `specs`, spec file names and texts, and `tests`, test file paths and
 *  texts. Problems fail; `changed` (each changed answer's ID and the tests citing it) and
 *  `newUncited` (new test files citing no answer) are only listed. */
export function checkBranch(before, after) {
  const was = before.specs.flatMap(([file, text]) => answersOf(file, text));
  const now = after.specs.flatMap(([file, text]) => answersOf(file, text));
  const wasWords = new Set(was.map((answer) => answer.words));
  const wasById = new Map(was.filter((answer) => answer.id !== undefined).map((answer) => [answer.id, answer]));
  const nowIds = new Set(now.map((answer) => answer.id));
  const problems = [];
  const changedIds = [];
  for (const answer of now) {
    const old = answer.id === undefined ? undefined : wasById.get(answer.id);
    if (answer.id === undefined && !wasWords.has(answer.words))
      problems.push(`${answer.file} has a new or reworded answer with no ID: "${answer.words.slice(0, 60)}…"`);
    else if (old !== undefined && (old.words !== answer.words || old.withdrawn !== answer.withdrawn))
      changedIds.push(answer.id);
  }
  for (const id of wasById.keys()) {
    if (!nowIds.has(id)) problems.push(`${id} is on origin/main but gone here: keep its answer, marked \`${id} withdrawn\``);
  }
  const cites = (text, id) => [...text.matchAll(ID)].some(([cited]) => cited === id);
  const changed = changedIds.map((id) => ({
    id,
    tests: after.tests.filter(([, text]) => cites(text, id)).map(([path]) => path),
  }));
  const oldPaths = new Set(before.tests.map(([path]) => path));
  const newUncited = after.tests
    .filter(([path, text]) => CHECK_FILE.test(path) && !oldPaths.has(path) && text.match(ID) === null)
    .map(([path]) => path);
  return { problems, changed, newUncited };
}

function filesUnder(root, dir, keep) {
  return readdirSync(join(root, dir), { recursive: true })
    .map((path) => join(dir, String(path)).split("\\").join("/"))
    .filter(keep)
    .map((path) => [path, readFileSync(join(root, path), "utf8")]);
}

/** origin/main's spec files, where the branch left it, and its test paths (their texts unread). */
function onBase() {
  const { git, base: baseOf } = branchCheck("spec IDs");
  const base = baseOf();
  const paths = (dir) => git("ls-tree", "-r", "--name-only", base, "--", dir).split("\n").filter(Boolean);
  const specs = paths("spec/")
    .filter((path) => SPEC_FILE.test(path.slice("spec/".length)))
    .map((path) => [relative("spec", path), git("show", `${base}:${path}`)]);
  return { specs, tests: paths("tests/").map((path) => [path, ""]) };
}

/** The repo's spec files and tests under `root`, as `checkIds` and `checkBranch` take them. */
export function repoFiles(root) {
  const specs = filesUnder(root, "spec", (path) => SPEC_FILE.test(path.slice("spec/".length))).map(([path, text]) => [
    relative("spec", path),
    text,
  ]);
  const tests = filesUnder(root, "tests", (path) => TEST_FILE.test(path) && path !== OWN_TEST);
  return { specs, tests };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { specs, tests } = repoFiles(process.cwd());
  const { answers, problems, uncited } = checkIds(specs, tests);
  const branch = checkBranch(onBase(), { specs, tests });
  const failures = [...problems, ...branch.problems];
  for (const problem of failures) console.error(`spec IDs: ${problem}`);
  if (failures.length > 0) process.exit(1);
  console.log(`spec IDs: ${answers} answers have IDs; uncited by any test: ${uncited.length === 0 ? "none" : uncited.join(", ")}`);
  for (const { id, tests: citing } of branch.changed)
    console.log(`spec IDs: this branch changes ${id}; look again at ${citing.length === 0 ? "no test (none cites it)" : citing.join(", ")}`);
  if (branch.newUncited.length > 0)
    console.log(`spec IDs: new test files citing no answer: ${branch.newUncited.join(", ")}`);
}
