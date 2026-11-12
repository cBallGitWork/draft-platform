#!/usr/bin/env node
// Exports nobody uses (#1811). knip, with knip.json, lists every export the app, Convex and the
// scripts never read (`--production`: the tests' import.meta.glob would otherwise mark every Convex
// export as read). This drops Convex's registrations, which Convex itself reads, and the ones a
// test reads, unless that one is a re-export: a constant or function exported for a test stays
// allowed, a re-export only tests read doesn't. What's left fails, whether nothing imports it or
// only its own file reads it, unless scripts/unused-exports.baseline.txt pins it. The baseline only
// shrinks: a line no longer found fails too, so it's cut when its export goes. The weekly drift
// pass clears it.
// Run from the repo: `node scripts/unused-exports.mjs`. `npm run verify` and CI's verify workflow
// run it once both name it, in one pipeline change (#1811).

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import ts from "typescript";
import { TESTS_ROOT } from "./branchCheck.mjs";
import { CHECKOUT, ranDirectly } from "./thisScript.mjs";

export const BASELINE_PATH = "scripts/unused-exports.baseline.txt";
const KNIP = join(CHECKOUT, "node_modules/knip/bin/knip.js");
const KNIP_ARGS = ["--production", "--include", "exports,types", "--reporter", "json", "--no-exit-code"];

/** The calls whose result Convex registers as a function, so an export holding one is read. */
const REGISTRATIONS = new Set([
  "query", "mutation", "action", "internalQuery", "internalMutation", "internalAction", "httpAction",
]);
/** Files Convex reads by their default export, and auth.ts, whose every export Convex Auth reads. */
const CONVEX_DEFAULTS = new Set(["convex/crons.ts", "convex/http.ts", "convex/schema.ts", "convex/auth.config.ts"]);
const CONVEX_AUTH = "convex/auth.ts";

const SOURCE = /\.(ts|tsx|mjs|js)$/;
const RESOLVED = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];
/** Every export of a file, when a test reads it whole (`import * as`, `import()`). */
const WHOLE = "*";

/** One finding's line, as the baseline holds it. */
export const lineOf = ({ file, name }) => `${file}: ${name}`;

const parse = (path, text) => ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
const isExported = (node) => ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export;

/** The names `text` exports that are read from another module: `export { a } from`, or an
 *  imported binding exported again. */
export function reexportedNames(path, text) {
  const source = parse(path, text);
  const imported = new Set();
  for (const node of source.statements) {
    const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
    if (clause?.name) imported.add(clause.name.text);
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) imported.add(item.name.text);
    if (bindings && ts.isNamespaceImport(bindings)) imported.add(bindings.name.text);
  }
  const names = new Set();
  for (const node of source.statements) {
    if (!ts.isExportDeclaration(node) || !node.exportClause || !ts.isNamedExports(node.exportClause)) continue;
    for (const item of node.exportClause.elements) {
      const local = (item.propertyName ?? item.name).text;
      if (node.moduleSpecifier || imported.has(local)) names.add(item.name.text);
    }
  }
  return names;
}

/** The names `text` exports as a Convex registration, such as `export const x = query(...)`. */
export function registeredNames(path, text) {
  const names = new Set();
  for (const node of parse(path, text).statements) {
    if (!ts.isVariableStatement(node) || !isExported(node)) continue;
    for (const declaration of node.declarationList.declarations) {
      const value = declaration.initializer;
      if (ts.isIdentifier(declaration.name) && value && ts.isCallExpression(value) && ts.isIdentifier(value.expression)
        && REGISTRATIONS.has(value.expression.text)) names.add(declaration.name.text);
    }
  }
  return names;
}

/** The file a relative `specifier` in `from` names, as a path from the repo's top, if it's there. */
function resolve(root, from, specifier) {
  if (!specifier.startsWith(".")) return undefined;
  const base = join(dirname(join(root, from)), specifier).replace(/\.js$/, "");
  const file = RESOLVED.map((end) => base + end).find((path) => existsSync(path) && SOURCE.test(path));
  return file && relative(root, file);
}

/** What each file under `files` reads of the modules it imports: a map from the module's path to
 *  the names read, WHOLE when it reads them all. `files` are paths from `root` with their text. */
export function readsOf(root, files) {
  const reads = new Map();
  const read = (from, specifier, name) => {
    const file = resolve(root, from, specifier);
    if (!file) return;
    if (!reads.has(file)) reads.set(file, new Set());
    reads.get(file).add(name);
  };
  for (const [path, text] of files) {
    const visit = (node) => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
        && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
        const named = ts.isImportDeclaration(node) ? clause?.namedBindings : node.exportClause;
        if (clause?.name) read(path, specifier, "default");
        if (named && (ts.isNamedImports(named) || ts.isNamedExports(named))) {
          for (const item of named.elements) read(path, specifier, (item.propertyName ?? item.name).text);
        } else if (named || (ts.isExportDeclaration(node) && !node.exportClause)) read(path, specifier, WHOLE);
      } else if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteralLike(node.arguments[0])
        && (node.expression.kind === ts.SyntaxKind.ImportKeyword || /^vi\.(mock|importActual)$/.test(node.expression.getText()))) {
        read(path, node.arguments[0].text, WHOLE);
      }
      ts.forEachChild(node, visit);
    };
    visit(parse(path, text));
  }
  return reads;
}

/** knip's unused exports and types, each as { file, name }. */
export const knipFindings = (report) =>
  report.issues.flatMap(({ file, exports = [], types = [] }) => [...exports, ...types].map(({ name }) => ({ file, name })));

/** The findings that fail: not a Convex registration, and not a test's read of what isn't a
 *  re-export. `textOf` gives a file's text; `testReads` is readsOf the tests. */
export function unusedExports(findings, textOf, testReads) {
  return findings.filter(({ file, name }) => {
    if (file === CONVEX_AUTH || (name === "default" && CONVEX_DEFAULTS.has(file))) return false;
    if (file.startsWith("convex/") && registeredNames(file, textOf(file)).has(name)) return false;
    const read = testReads.get(file);
    const testRead = read !== undefined && (read.has(name) || read.has(WHOLE));
    return !testRead || reexportedNames(file, textOf(file)).has(name);
  });
}

/** What's wrong against the baseline's lines: findings it doesn't pin, and lines no longer found. */
export function baselineProblems(found, baseline) {
  const now = new Set(found.map(lineOf));
  const pinned = new Set(baseline);
  return {
    unpinned: [...now].filter((line) => !pinned.has(line)),
    stale: [...pinned].filter((line) => !now.has(line)),
  };
}

const lines = (text) => text.split("\n").map((line) => line.trim()).filter(Boolean);

function filesUnder(root, folder) {
  const path = join(root, folder);
  if (!existsSync(path)) return [];
  return readdirSync(path, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && SOURCE.test(entry.name))
    .map((entry) => relative(root, join(entry.parentPath, entry.name)));
}

function main() {
  const root = process.cwd();
  const report = JSON.parse(execFileSync(process.execPath, [KNIP, ...KNIP_ARGS], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }));
  const textOf = (file) => readFileSync(join(root, file), "utf8");
  const tests = filesUnder(root, TESTS_ROOT).map((file) => [file, textOf(file)]);
  const found = unusedExports(knipFindings(report), textOf, readsOf(root, tests));
  const baselineFile = join(root, BASELINE_PATH);
  const baseline = existsSync(baselineFile) ? lines(readFileSync(baselineFile, "utf8")) : [];
  const { unpinned, stale } = baselineProblems(found, baseline);
  if (unpinned.length === 0 && stale.length === 0) return;
  if (unpinned.length > 0) {
    console.error(
      `unused exports: nothing outside its own file reads ${unpinned.length === 1 ? "this export" : `these ${unpinned.length} exports`}, ` +
        `or only tests read it through a re-export. Stop exporting it, or delete it:\n${unpinned.map((line) => `  ${line}`).join("\n")}`,
    );
  }
  if (stale.length > 0) {
    console.error(
      `unused exports: ${BASELINE_PATH} pins ${stale.length === 1 ? "a line" : `${stale.length} lines`} no longer found. ` +
        `Cut ${stale.length === 1 ? "it" : "them"}, since the baseline only shrinks:\n${stale.map((line) => `  ${line}`).join("\n")}`,
    );
  }
  process.exit(1);
}

if (ranDirectly(import.meta.url)) main();
