#!/usr/bin/env node
// Never cut a test (docs/PHILOSOPHY.md, #156). Fails when the branch, with the working tree,
// committed or not, holds fewer of some test than origin/main did where the branch left it. A test
// is a test() or it() call, its .only, .skip, .todo, .each and kin included, named by the
// describe() titles around it and its own title, as written in the source: a test moved to
// another file, or a file renamed, keeps its name and passes; a test renamed, moved to another
// describe(), or deleted with its file counts as removed. Removing one on purpose takes the trailer
//     Test-removed: <the test's name, as this check prints it>: <why>
// on a commit on the branch, or one naming a file the test was in on origin/main, for every test
// that file loses. The titles are read from the source, never run: a test made in a loop counts
// once, by its title as the source writes it.
// Run from the repo: `node scripts/tests-kept.mjs`; `npm run verify` runs it, so CI does.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const TESTS_ROOT = "tests/";
/** Every Vitest and Playwright test file's name (tests/README.md, The five roots). */
const TEST_FILE = /\.(test|spec)\.(ts|tsx|mjs)$/;
const BASE = "origin/main";
const TRAILER = "Test-removed";
/** Between the describe() titles and the test's own in a test's name. */
export const NAME_JOIN = " > ";

const TEST_CALLS = new Set(["test", "it"]);
const SUITE_CALL = "describe";
/** What may follow test, it or describe in a call that still declares one (Vitest's and
 *  Playwright's); anything else, such as test.step or test.beforeEach, declares none. */
const MODIFIERS = new Set([
  "only", "skip", "todo", "fails", "concurrent", "sequential", "shuffle", "each", "for",
  "skipIf", "runIf", "fixme", "slow", "serial", "parallel", SUITE_CALL,
]);
/** A test with no body is still one only as a todo; Playwright's test.skip(condition, why) inside a
 *  test, also bodiless, is none. */
const BODILESS = "todo";

/** "suite", "test", "todo" or undefined for a call's callee: test.each(rows)(...) and test.skipIf(x)(...)
 *  are read through the inner call. */
function declares(callee) {
  const chain = [];
  let node = callee;
  while (!ts.isIdentifier(node)) {
    if (ts.isPropertyAccessExpression(node)) {
      chain.push(node.name.text);
      node = node.expression;
    } else if (ts.isCallExpression(node)) node = node.expression;
    else return undefined;
  }
  const root = node.text;
  if (!(TEST_CALLS.has(root) || root === SUITE_CALL) || !chain.every((name) => MODIFIERS.has(name))) return undefined;
  if (root === SUITE_CALL || chain.includes(SUITE_CALL)) return "suite";
  return chain.includes(BODILESS) ? BODILESS : "test";
}

const isFunction = (node) => ts.isArrowFunction(node) || ts.isFunctionExpression(node);

/** A title as the source writes it: a string's text, or any other expression's code. */
function titleOf(node, source) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return node.getText(source);
}

/** The name of every test `text` declares, once per declaration, describe() titles first. */
export function testNames(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const names = [];
  const suites = [];
  const visit = (node) => {
    const kind = ts.isCallExpression(node) && node.arguments.length > 0 ? declares(node.expression) : undefined;
    const title = kind === undefined ? undefined : titleOf(node.arguments[0], source);
    if (kind === "suite") {
      suites.push(title);
      ts.forEachChild(node, visit);
      suites.pop();
      return;
    }
    if (kind !== undefined && (kind === BODILESS || node.arguments.some(isFunction))) names.push([...suites, title].join(NAME_JOIN));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

/** Each test `before` has more of than `after`, with how many fewer and the files it was in.
 *  Both map a test file's path to its text. */
export function removedTests(before, after) {
  const count = (files) => {
    const tests = new Map();
    for (const [path, text] of files) {
      for (const name of testNames(path, text)) {
        const test = tests.get(name) ?? { count: 0, files: new Set() };
        test.count += 1;
        test.files.add(path);
        tests.set(name, test);
      }
    }
    return tests;
  };
  const kept = count(after);
  return [...count(before)]
    .map(([name, { count: was, files }]) => ({ name, fewer: was - (kept.get(name)?.count ?? 0), files: [...files] }))
    .filter(({ fewer }) => fewer > 0);
}

/** Whether a trailer value names `subject` and gives a reason after it. */
const gives = (value, subject) => value.startsWith(`${subject}:`) && value.slice(subject.length + 1).trim() !== "";

/** The removed tests no trailer value lets through, by the test's name or a file it was in. */
export function unexcused(removed, trailerValues) {
  const excused = (subject) => trailerValues.some((value) => gives(value, subject));
  return removed.filter(({ name, files }) => !excused(name) && !files.some(excused));
}

function fail(message) {
  console.error(`tests-kept check: ${message}`);
  process.exit(1);
}

/** git's output; a git failure ends the check with what it said, not a stack trace. */
function git(...args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });
  } catch (error) {
    const said = String(error.stderr ?? "").trim() || error.message;
    fail(`git ${args[0]} failed (${said}). Run git fetch origin, then try again.`);
  }
}

const lines = (text) => text.split("\n").filter(Boolean);
const isTestFile = (path) => path.startsWith(TESTS_ROOT) && TEST_FILE.test(path);

function main() {
  const base = git("merge-base", BASE, "HEAD").trim();
  const before = lines(git("ls-tree", "-r", "--name-only", base, "--", TESTS_ROOT))
    .filter(isTestFile)
    .map((path) => [path, git("show", `${base}:${path}`)]);
  // The working tree's files, tracked or new, but not ones deleted from it and not yet committed.
  const after = lines(git("ls-files", "--cached", "--others", "--exclude-standard", "--", TESTS_ROOT))
    .filter((path) => isTestFile(path) && existsSync(path))
    .map((path) => [path, readFileSync(path, "utf8")]);
  const trailerValues = lines(
    git("log", `--format=%(trailers:key=${TRAILER},valueonly,separator=%x0A)`, `${base}..HEAD`),
  ).map((value) => value.trim());
  const refused = unexcused(removedTests(before, after), trailerValues);
  if (refused.length > 0) {
    const listed = refused.map(({ name, fewer, files }) =>
      `  ${name}${fewer > 1 ? ` (${fewer} fewer)` : ""}, in ${files.join(", ")} on ${BASE}`,
    );
    fail(
      `this branch removes ${refused.length === 1 ? "a test" : `${refused.length} tests`} ${BASE} has:\n` +
        `${listed.join("\n")}\n` +
        `Put it back, or, if it goes on purpose, add a trailer to a commit on this branch: ` +
        `"${TRAILER}: <the test's name above, or its file>: <why>".`,
    );
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main();
