import ts from "typescript";

// What tests/convex/oneHome.test.ts reads (#1813): the code written in several convex/ files, and
// the harness exports a test writes out again. Its lists of what is still to move are in the test.

export type Sources = Record<string, string>;
export type Place = { file: string; line: number };
export type Copies = { name: string; places: Place[] };
export type Restated = { name: string; place: Place };

/** The fewest files one piece of code sits in before it counts: PHILOSOPHY.md's "same pattern 3
 *  times". */
export const MOST_COPIES = 3;
/** The fewest lines a function body spans, its braces included, before a copy of it counts. */
const FEWEST_BODY_LINES = 3;
/** A copy's name is its code cut to this many characters. */
const LABEL_LENGTH = 100;

/** A glob key, relative to tests/convex/, as a path from the repo's root. */
export function repoPath(key: string): string {
  const parts = ["tests", "convex"];
  for (const part of key.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

export const at = ({ file, line }: Place) => `${file}:${line}`;
const sameSpacing = (code: string) => code.replace(/\s+/g, " ").trim();
const parse = (path: string, source: string) =>
  ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const lineOf = (file: ts.SourceFile, node: ts.Node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
const label = (code: string) => (code.length > LABEL_LENGTH ? `${code.slice(0, LABEL_LENGTH)}…` : code);

/** An alias that only picks from another type, such as `Foo["k"][number]` or `Extract<…>`. */
function picksFromAnother(type: ts.TypeNode): boolean {
  return ts.isIndexedAccessTypeNode(type) || (ts.isTypeReferenceNode(type) && type.typeName.getText() === "Extract");
}

function literalOnly(node: ts.Node): boolean {
  if (ts.isObjectLiteralExpression(node))
    return node.properties.every((property) => ts.isPropertyAssignment(property) && literalOnly(property.initializer));
  if (ts.isArrayLiteralExpression(node)) return node.elements.every(literalOnly);
  if (ts.isPrefixUnaryExpression(node)) return ts.isNumericLiteral(node.operand);
  return (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)
  );
}

/** Each type alias, long function body and literal-only object in a file, by its code. */
function codeIn(path: string, source: string, into: Map<string, Place[]>) {
  const file = parse(path, source);
  const add = (code: string, node: ts.Node) => into.set(code, [...(into.get(code) ?? []), { file: path, line: lineOf(file, node) }]);
  const visit = (node: ts.Node) => {
    if (ts.isTypeAliasDeclaration(node) && !picksFromAnother(node.type))
      add(`type ${node.name.text} = ${sameSpacing(node.type.getText(file))}`, node);
    if (ts.isFunctionLike(node) && "body" in node && node.body && ts.isBlock(node.body)) {
      const body = node.body;
      const lines = file.getLineAndCharacterOfPosition(body.end).line - file.getLineAndCharacterOfPosition(body.getStart(file)).line + 1;
      if (lines >= FEWEST_BODY_LINES) add(sameSpacing(body.getText(file)), node);
    }
    if (ts.isObjectLiteralExpression(node) && node.properties.length > 0 && literalOnly(node)) add(sameSpacing(node.getText(file)), node);
    ts.forEachChild(node, visit);
  };
  visit(file);
}

/** Every piece of code written in MOST_COPIES or more of the files, but those `allowed` names. */
export function copiesIn(sources: Sources, allowed: Record<string, string> = {}): Copies[] {
  const code = new Map<string, Place[]>();
  for (const [key, source] of Object.entries(sources)) codeIn(repoPath(key), source, code);
  return [...code]
    .map(([written, places]) => ({ name: label(written), places }))
    .filter(({ name, places }) => new Set(places.map(({ file }) => file)).size >= MOST_COPIES && !(name in allowed))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type Declared = { name: string; value: string; node: ts.Node };

/** A file's top-level constants, functions and type aliases, each with its value's code. */
function topLevel(file: ts.SourceFile, exportedOnly: boolean): Declared[] {
  return file.statements.flatMap((statement): Declared[] => {
    const exported = ts.canHaveModifiers(statement) && (ts.getModifiers(statement) ?? []).some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword);
    if (exportedOnly && !exported) return [];
    if (ts.isVariableStatement(statement))
      return statement.declarationList.declarations.flatMap((declaration) =>
        ts.isIdentifier(declaration.name) && declaration.initializer
          ? [{ name: declaration.name.text, value: sameSpacing(declaration.initializer.getText(file)), node: declaration }]
          : [],
      );
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      const code = statement.getText(file);
      return [{ name: statement.name.text, value: sameSpacing(code.slice(code.indexOf("function"))), node: statement }];
    }
    if (ts.isTypeAliasDeclaration(statement))
      return [{ name: statement.name.text, value: sameSpacing(statement.type.getText(file)), node: statement }];
    return [];
  });
}

/** True when `node` is inside a matcher's arguments, such as `expect(x).toBe(node)`. */
function inMatcher(node: ts.Node): boolean {
  for (let inner = node; inner.parent; inner = inner.parent) {
    const call = inner.parent;
    if (!ts.isCallExpression(call) || !call.arguments.includes(inner as ts.Expression) || !ts.isPropertyAccessExpression(call.expression)) continue;
    let root: ts.Expression = call.expression.expression;
    while (ts.isPropertyAccessExpression(root) || (ts.isCallExpression(root) && !ts.isIdentifier(root.expression))) root = root.expression;
    if (ts.isCallExpression(root) && ts.isIdentifier(root.expression) && root.expression.text === "expect") return true;
  }
  return false;
}

/** True when a test restates a value on purpose: it reads the name only as an expected value. */
function onlyExpected(file: ts.SourceFile, declared: Declared): boolean {
  const uses: ts.Identifier[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === declared.name && node.parent !== declared.node) uses.push(node);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return uses.length > 0 && uses.every(inMatcher);
}

/** Every top-level name a test declares that a harness exports with the same value, named
 *  "test name -> harness". */
export function restatedIn(tests: Sources, harnesses: Sources): Restated[] {
  const exported = new Map<string, string>();
  for (const [key, source] of Object.entries(harnesses)) {
    const path = repoPath(key);
    for (const { name, value } of topLevel(parse(path, source), true)) exported.set(`${name} = ${value}`, path);
  }
  return Object.entries(tests)
    .flatMap(([key, source]) => {
      const path = repoPath(key);
      const file = parse(path, source);
      return topLevel(file, false).flatMap((declared) => {
        const harness = exported.get(`${declared.name} = ${declared.value}`);
        return harness && !onlyExpected(file, declared)
          ? [{ name: `${path} ${declared.name} -> ${harness}`, place: { file: path, line: lineOf(file, declared.node) } }]
          : [];
      });
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
