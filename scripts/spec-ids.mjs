#!/usr/bin/env node
// Ties Craig's answers to the tests (#454). An answer in spec/NN-*.md ends its line with its ID in
// backticks, such as `S07.2`: opaque and stable, never renumbered or reused, and a dropped answer
// keeps its ID marked `S07.2 withdrawn`. A test cites an answer by writing its ID anywhere in the
// file. Fails on an ID given twice, an ID in the wrong spec file, and a mention of an ID no answer
// has or one withdrawn; then lists the answers no test cites. "Uncited", never "covered": whether
// a citing test really asserts the answer is pr-reviewer's call.
// Run from the repo: `node scripts/spec-ids.mjs`; `npm run verify` runs it, so CI does.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const ID = /\bS(\d{2})\.\d+\b/g;
/** An answer's own ID, at the end of its line; any other mention of an ID is a reference. */
const GIVEN = /`(S(\d{2})\.\d+)( withdrawn)?`\s*$/;
const SPEC_FILE = /^(\d{2})-.*\.md$/;
const TEST_FILE = /\.(ts|tsx|mjs)$/;
/** This checker's own test, whose made-up IDs are its fixtures, not citations. */
const OWN_TEST = "tests/scripts/spec-ids.test.mjs";

/** What the spec files give and mention, and what's wrong in them. `specs` maps a file's name to its text. */
export function readSpecs(specs) {
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

function filesUnder(root, dir, keep) {
  return readdirSync(join(root, dir), { recursive: true })
    .map((path) => join(dir, String(path)).split("\\").join("/"))
    .filter(keep)
    .map((path) => [path, readFileSync(join(root, path), "utf8")]);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd();
  const specs = filesUnder(root, "spec", (path) => SPEC_FILE.test(path.slice("spec/".length))).map(([path, text]) => [
    relative("spec", path),
    text,
  ]);
  const tests = filesUnder(root, "tests", (path) => TEST_FILE.test(path) && path !== OWN_TEST);
  const { answers, problems, uncited } = checkIds(specs, tests);
  for (const problem of problems) console.error(`spec IDs: ${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log(`spec IDs: ${answers} answers have IDs; uncited by any test: ${uncited.length === 0 ? "none" : uncited.join(", ")}`);
}
