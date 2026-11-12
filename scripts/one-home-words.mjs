#!/usr/bin/env node
// One home for every sentence on screen (#1812): a phrase is written once, in one words file, and
// everything else imports it. Fails when
//   (a) a phrase of MIN_WORDS+ words appears in two of the home files (`src/**/words.ts`,
//       `src/**/preview.ts`, `convex/**/*Words.ts`), unless one of the two imports the other;
//       a template's fragment counts only at LONG_WORDS+ words, and preview.ts gives only those;
//   (b) a test's literal equals a phrase, or holds one of CONTAINED_WORDS+ words. A line calling a
//       words function the test imports (`expect(xWords(..)).toBe(..)`) is skipped.
// `// one-home-ok: <why>` on a line lets its literal through. The hits main held when this landed
// sit in one-home-words.baseline.json, so only new ones fail; the weekly drift pass shrinks it.
// Run from the repo: `node scripts/one-home-words.mjs` (`--write-baseline` rewrites the baseline);
// tests/scripts/one-home-words.test.mjs runs it on the repo, so `npm test`, verify and CI do.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { posix } from "node:path";
import ts from "typescript";
import { CHECKOUT, ranDirectly } from "./thisScript.mjs";

export const MIN_WORDS = 2;
export const CONTAINED_WORDS = 3;
export const LONG_WORDS = 4;
export const BASELINE = "scripts/one-home-words.baseline.json";
export const ALLOW = /\/\/ one-home-ok:\s*\S/;

const WORDS_FILE = /^src\/.*\/words\.ts$|^convex\/.*Words\.ts$/;
const PREVIEW_FILE = /^src\/.*\/preview\.ts$/;
const TEST_FILE = /^tests\/.*\.(test|spec)\.(ts|tsx|mjs)$/;
// This check's own test writes phrases twice on purpose, as fixtures, so it is never read as a test.
const OWN_TEST = "tests/scripts/one-home-words.test.mjs";

export const isHomeFile = (path) => WORDS_FILE.test(path) || PREVIEW_FILE.test(path);
export const isTestFile = (path) => TEST_FILE.test(path) && path !== OWN_TEST;

const wordCount = (text) => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

/**
 * Every string a source holds, with the line it starts on: `{ value, line, fragment }`. A template
 * with no `${}` is a plain string; one with them gives each piece between them as a fragment.
 */
export function literalsOf(source, path = "x.ts") {
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false, kind);
  const found = [];
  const add = (node, fragment) => found.push({ value: node.text, line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, fragment });
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node, false);
    else if (ts.isTemplateExpression(node)) {
      add(node.head, true);
      for (const span of node.templateSpans) add(span.literal, true);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** The relative modules a source imports, resolved against its own path to the files in `known`. */
export function importsOf(path, source, known) {
  const imported = new Set();
  for (const [, spec] of source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["'](\.[^"']*)["']/g)) {
    const base = posix.join(posix.dirname(path), spec);
    const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}/index.ts`].find((candidate) => known.has(candidate));
    if (target !== undefined) imported.add(target);
  }
  return imported;
}

/** Shared homes first, then words files before previews, then by path: the first is where to import from. */
function byHome(a, b) {
  const rank = (path) => (/\/shared\//.test(path) ? 0 : 2) + (PREVIEW_FILE.test(path) ? 1 : 0);
  return rank(a) - rank(b) || a.localeCompare(b);
}

/** The phrases the home files hold: a Map from phrase to `{ file, line, allowed }[]`. */
export function phrasesOf(homes) {
  const phrases = new Map();
  for (const [file, source] of homes) {
    const lines = source.split("\n");
    for (const { value, line, fragment } of literalsOf(source, file)) {
      const phrase = value.trim();
      const least = fragment || PREVIEW_FILE.test(file) ? LONG_WORDS : MIN_WORDS;
      if (wordCount(phrase) < least) continue;
      if (!phrases.has(phrase)) phrases.set(phrase, []);
      phrases.get(phrase).push({ file, line, allowed: ALLOW.test(lines[line - 1] ?? "") });
    }
  }
  return phrases;
}

/** One regular expression matching any of `phrases` as whole words, built as a trie so it runs in one pass. */
export function phraseMatcher(phrases) {
  const root = new Map();
  const END = "";
  for (const phrase of phrases) {
    let node = root;
    for (const ch of phrase) {
      if (!node.has(ch)) node.set(ch, new Map());
      node = node.get(ch);
    }
    node.set(END, null);
  }
  const escape = (ch) => ch.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");
  const emit = (node) => {
    const ends = node.has(END);
    const branches = [...node].filter(([ch]) => ch !== END).map(([ch, child]) => escape(ch) + emit(child));
    if (branches.length === 0) return "";
    if (branches.length === 1 && !ends) return branches[0];
    return `(?:${branches.join("|")})${ends ? "?" : ""}`;
  };
  if (root.size === 0) return /(?!)/u;
  return new RegExp(`(?<![\\p{L}\\p{N}])${emit(root)}(?![\\p{L}\\p{N}])`, "u");
}

/** A test line that hands a words function's own answer to `expect`, for the names it imports from a home. */
function wordsCallsOf(file, source, homePaths) {
  const names = [];
  for (const [, clause, spec] of source.matchAll(/import\s+(?:type\s+)?([\w$\s{},*]+?)\s+from\s*["'](\.[^"']*)["']/g)) {
    if (importsOf(file, `from "${spec}"`, homePaths).size === 0) continue;
    for (const name of clause.replace(/[{}*]/g, " ").split(/[\s,]+/)) if (/^[\w$]+$/.test(name) && name !== "as" && name !== "type") names.push(name);
  }
  if (names.length === 0) return null;
  return new RegExp(`expect\\(\\s*(?:await\\s+)?(?:${names.map((name) => name.replace(/\$/g, "\\$")).join("|")})\\s*[.(]`);
}

/**
 * Every hit, `{ file, line, phrase, home }`, sorted by file and line: a phrase written again
 * outside its home. `homes` and `tests` are [path, source] pairs.
 */
export function oneHomeHits(homes, tests) {
  const homePaths = new Set(homes.map(([path]) => path));
  const links = new Map(homes.map(([path, source]) => [path, importsOf(path, source, homePaths)]));
  const linked = (a, b) => links.get(a)?.has(b) || links.get(b)?.has(a);
  const phrases = phrasesOf(homes);
  const filesOf = (phrase) => [...new Set(phrases.get(phrase).map(({ file }) => file))].sort(byHome);
  const hits = [];

  for (const [phrase, places] of phrases) {
    const [home, ...others] = filesOf(phrase);
    for (const file of others) {
      if ([home, ...others].some((other) => other !== file && linked(file, other))) continue;
      for (const place of places) if (place.file === file && !place.allowed) hits.push({ file, line: place.line, phrase, home });
    }
  }

  const matcher = phraseMatcher([...phrases.keys()].filter((phrase) => wordCount(phrase) >= CONTAINED_WORDS));
  for (const [file, source] of tests) {
    const lines = source.split("\n");
    const wordsCalls = wordsCallsOf(file, source, homePaths);
    for (const { value, line } of literalsOf(source, file)) {
      const text = lines[line - 1] ?? "";
      if (ALLOW.test(text) || wordsCalls?.test(text)) continue;
      const phrase = phrases.has(value.trim()) ? value.trim() : value.match(matcher)?.[0];
      if (phrase !== undefined) hits.push({ file, line, phrase, home: filesOf(phrase)[0] });
    }
  }
  return hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/** The hits `baseline` ({ file: phrases[] }) doesn't hold. */
export const newHits = (hits, baseline) => hits.filter(({ file, phrase }) => !(baseline[file] ?? []).includes(phrase));

/** The baseline that holds exactly `hits`: each file's phrases once, sorted. */
export function baselineOf(hits) {
  const baseline = {};
  for (const { file, phrase } of hits) (baseline[file] ??= new Set()).add(phrase);
  return Object.fromEntries(Object.keys(baseline).sort().map((file) => [file, [...baseline[file]].sort()]));
}

if (ranDirectly(import.meta.url)) {
  const tracked = execFileSync("git", ["ls-files", "-z", "src", "convex", "tests"], { cwd: CHECKOUT, encoding: "utf8" }).split("\0").filter(Boolean);
  const read = (paths) => paths.map((path) => [path, readFileSync(posix.join(CHECKOUT, path), "utf8")]);
  const hits = oneHomeHits(read(tracked.filter(isHomeFile)), read(tracked.filter(isTestFile)));
  const baselinePath = posix.join(CHECKOUT, BASELINE);
  if (process.argv.includes("--write-baseline")) {
    writeFileSync(baselinePath, `${JSON.stringify(baselineOf(hits), null, 2)}\n`);
    console.log(`one-home words: wrote ${hits.length} hits to ${BASELINE}`);
    process.exit(0);
  }
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
  const fresh = newHits(hits, baseline);
  for (const { file, line, phrase, home } of fresh) {
    console.error(`one-home words: ${file}:${line} writes "${phrase}" again: import it from ${home} (or end the line with // one-home-ok: <why>)`);
  }
  if (fresh.length > 0) process.exit(1);
  console.log(`one-home words: nothing written twice beyond the ${hits.length} hits the baseline holds`);
}
