#!/usr/bin/env node
// A feed or wire value with a named home is imported, never typed out again (#1808), so the two
// copies can't drift apart. The registry is rebuilt on every run: each `export const NAME = "value"`
// in SCREAMING_CASE whose value holds `_`, `:` or `-` (stat keys, locales, id prefixes; plain words
// and numbers matched unrelated values as often as real ones, so they are left out). Any string in
// convex/ or src/ (preview data left out) that equals a registered value in another file, or starts
// with a registered `*_PREFIX` value, is named with the constant to import. A trailing
// `// literal-ok: <reason>` on the string's line lets it stand.
// Run from the repo: `node scripts/named-literals.mjs`; `npm run verify` runs it, so CI does.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import ts from "typescript";
import { PREVIEW_FILE } from "./previewFile.mjs";
import { CHECKOUT, ranDirectly } from "./thisScript.mjs";

const FOLDERS = ["convex/", "src/"];
/** Written by `npx convex dev`, not by us. */
const GENERATED = "convex/_generated/";
const SCREAMING_CASE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
/** A value worth a home: a stat key, a locale, an id prefix; one token, so class lists aren't. */
const WIRE_VALUE = /^[^\s]*[_:-][^\s]*$/;
const PREFIX_NAME = /_PREFIX$/;
/** The escape, at the end of the string's line, with a reason. */
const ESCAPE = /\/\/\s*literal-ok:\s*\S/;

/** Whether `path` is one this check reads: a source file under FOLDERS, not generated, not preview data. */
const checked = (path) =>
  FOLDERS.some((folder) => path.startsWith(folder)) &&
  !path.startsWith(GENERATED) &&
  /\.tsx?$/.test(path) &&
  !PREVIEW_FILE.test(basename(path));

const parse = (path, text) =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

/** `expression` without `as const` or `satisfies`, when it's a plain string; else undefined. */
function stringValue(expression) {
  let node = expression;
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression;
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node : undefined;
}

/** Each registered constant a parsed file exports: { name, value, path }. */
function exportedConstants(path, source) {
  return source.statements.flatMap((statement) => {
    if (!ts.isVariableStatement(statement)) return [];
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return [];
    if (!(statement.declarationList.flags & ts.NodeFlags.Const)) return [];
    return statement.declarationList.declarations.flatMap((declaration) => {
      const literal = stringValue(declaration.initializer);
      if (!ts.isIdentifier(declaration.name) || !SCREAMING_CASE.test(declaration.name.text) || !literal) return [];
      if (!WIRE_VALUE.test(literal.text)) return [];
      return [{ name: declaration.name.text, value: literal.text, path }];
    });
  });
}

/** Every string in a parsed file, with the text it starts with: [node, text, whole]. A template's
 *  head counts as a start only, so `${OWN_STAT_PREFIX}stops` passes and `league:${key}` doesn't. */
function stringsIn(source) {
  const found = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isExternalModuleReference(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) found.push([node, node.text, true]);
    else if (ts.isTemplateExpression(node)) found.push([node, node.head.text, false]);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** The retyped values in `files` ([path, text] pairs): one line each, `path:line "value" is NAME
 *  (home); import it`. Only checked() files are read, for the registry and the strings alike. */
export function namedLiteralHits(files) {
  const parsed = files.filter(([path]) => checked(path)).map(([path, text]) => [path, text, parse(path, text)]);
  const registry = parsed.flatMap(([path, , source]) => exportedConstants(path, source));
  const prefixes = registry.filter((entry) => PREFIX_NAME.test(entry.name));
  return parsed.flatMap(([path, text, source]) => {
    const lines = text.split("\n");
    return stringsIn(source).flatMap(([node, start, whole]) => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      const endLine = source.getLineAndCharacterOfPosition(node.getEnd()).line;
      if (ESCAPE.test(lines[endLine])) return [];
      const elsewhere = (entry) => entry.path !== path;
      const equal = whole ? registry.filter((entry) => elsewhere(entry) && entry.value === start) : [];
      const matched = equal.length > 0 ? equal : prefixes.filter((entry) => elsewhere(entry) && start.startsWith(entry.value));
      if (matched.length === 0) return [];
      const names = matched.map((entry) => `${entry.name} (${entry.path})`).join(" or ");
      const how = equal.length > 0 ? "is" : "starts with";
      return [`${path}:${line + 1} "${start}" ${how} ${names}; import it, or end the line with // literal-ok: <reason>`];
    });
  });
}

/** The checked() files git tracks in the checkout at `root`, as [path, text] pairs. */
export function trackedSources(root) {
  const tracked = execFileSync("git", ["ls-files", "-z", ...FOLDERS], { cwd: root, encoding: "utf8" }).split("\0").filter(checked);
  return tracked.map((path) => [path, readFileSync(join(root, path), "utf8")]);
}

if (ranDirectly(import.meta.url)) {
  const hits = namedLiteralHits(trackedSources(CHECKOUT));
  for (const hit of hits) console.error(`named literals: ${hit}`);
  if (hits.length > 0) process.exit(1);
  console.log("named literals: no value with a named home is typed out again");
}
