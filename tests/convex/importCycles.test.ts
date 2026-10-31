import { expect, test } from "vitest";

// No value-import cycle in convex/. A cycle works only while every use sits inside a function:
// a module-level constant built from a file in the loop is undefined at load (#198). #637 added
// one between lineups.ts and squads.ts and nothing noticed; this test notices the next one.
// Beside it: schema.ts and the browser's rules editor stay clear of the scorer's files (#756).

const SOURCES = import.meta.glob("../../convex/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;
const BROWSER_SOURCES = import.meta.glob("../../src/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;
/** The scorer's files, which schema.ts and the rules editor have no need to load (#756). */
const SCORER_FILES = ["convex/scoring/scoring.ts", "convex/scoring/scoringSet.ts", "convex/scoring/ownStats.ts"];
const SOURCE_PREFIX = "../../";
const GENERATED = "convex/_generated/";
const TS = ".ts";
const INDEX = "/index.ts";

/** `import … from "x"` and `export … from "x"`, the clause kept to tell type-only ones apart. */
const FROM_CLAUSE = /^\s*(import|export)\s+([^;=]*?)\s*from\s*["']([^"']+)["']/gm;
/** `import "x"`, run for its effects. */
const BARE_IMPORT = /^\s*import\s*["']([^"']+)["']/gm;

function files(sources: Record<string, string> = SOURCES): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, source] of Object.entries(sources)) {
    const path = key.slice(SOURCE_PREFIX.length);
    if (!path.startsWith(GENERATED)) out.set(path, source);
  }
  return out;
}

/** True when the clause brings in only types. */
function typeOnly(clause: string): boolean {
  if (/^type\s/.test(clause)) return true;
  const braces = clause.match(/^\{([\s\S]*)\}$/);
  if (!braces) return false;
  const names = braces[1].split(",").map((name) => name.trim()).filter(Boolean);
  return names.length > 0 && names.every((name) => /^type\s/.test(name));
}

/** The folder of a path, without the trailing slash. */
const folderOf = (path: string) => path.slice(0, path.lastIndexOf("/"));

function normalise(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== "." && part !== "") parts.push(part);
  }
  return parts.join("/");
}

/** The convex file a relative specifier names: `<path>.ts` first, then `<path>/index.ts`. */
function resolve(from: string, specifier: string, known: Map<string, string>): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = normalise(`${folderOf(from)}/${specifier}`);
  for (const candidate of [base.endsWith(TS) ? base : `${base}${TS}`, `${base}${INDEX}`]) {
    if (candidate.startsWith(GENERATED)) return undefined;
    if (known.has(candidate)) return candidate;
  }
  throw new Error(`${from} imports ${specifier}, which names no file under convex/`);
}

/** The files one file loads by value import, each once. */
function importsOf(path: string, known: Map<string, string>): string[] {
  const source = known.get(path)!;
  const specifiers: string[] = [];
  for (const [, , clause, specifier] of source.matchAll(FROM_CLAUSE)) {
    if (!typeOnly(clause)) specifiers.push(specifier);
  }
  for (const [, specifier] of source.matchAll(BARE_IMPORT)) specifiers.push(specifier);
  const targets = specifiers.map((specifier) => resolve(path, specifier, known)).filter((t) => t !== undefined);
  return [...new Set(targets)];
}

function edges(known: Map<string, string>): Map<string, string[]> {
  return new Map([...known.keys()].map((path) => [path, importsOf(path, known)]));
}

/** Every file that loading `entry` loads, itself among them. Walked from the entry only, so a
 *  browser file off its route that imports a .tsx or a stylesheet is never read. */
function loadedBy(entry: string, known: Map<string, string>): Set<string> {
  const loaded = new Set([entry]);
  const waiting = [entry];
  for (let path = waiting.pop(); path !== undefined; path = waiting.pop()) {
    for (const target of importsOf(path, known)) {
      if (!loaded.has(target)) {
        loaded.add(target);
        waiting.push(target);
      }
    }
  }
  return loaded;
}

/** Tarjan's strongly connected components, keeping only groups of two or more files. */
function cycles(graph: Map<string, string[]>): string[][] {
  let next = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const groups: string[][] = [];

  const visit = (node: string) => {
    index.set(node, next);
    low.set(node, next);
    next += 1;
    stack.push(node);
    onStack.add(node);
    for (const target of graph.get(node) ?? []) {
      if (!index.has(target)) {
        visit(target);
        low.set(node, Math.min(low.get(node)!, low.get(target)!));
      } else if (onStack.has(target)) {
        low.set(node, Math.min(low.get(node)!, index.get(target)!));
      }
    }
    if (low.get(node) !== index.get(node)) return;
    const group: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      group.push(member);
    } while (member !== node);
    if (group.length > 1) groups.push(group.sort());
  };

  for (const node of graph.keys()) if (!index.has(node)) visit(node);
  return groups;
}

test("the walk sees convex/'s files and their imports", () => {
  const known = files();
  const graph = edges(known);
  // values.ts is the scoring trio's leaf: it imports nothing, so the trio can't loop through it (#198).
  expect(graph.get("convex/scoring/values.ts")).toEqual([]);
  // schema.ts, not the schema/ folder, is what "../../schema" names from two folders down.
  expect(resolve("convex/football/premierLeague/plTeamStats.ts", "../../schema", known)).toBe("convex/schema.ts");
  expect(graph.get("convex/scoring/scoring.ts")).toContain("convex/scoring/scoringSet.ts");
  // The walk reaches every one of the scorer's files from a file that loads them, so a misspelt
  // name can't leave the check at the end passing on a file that doesn't exist.
  const loaded = loadedBy("convex/scoring/teamPoints.ts", known);
  expect(SCORER_FILES.filter((file) => !loaded.has(file))).toEqual([]);
});

test("the walk finds a cycle and skips type-only imports", () => {
  const known = new Map([
    ["convex/a.ts", 'import { b } from "./b";\nimport type { C } from "./c";'],
    ["convex/b.ts", 'export { a } from "./a";'],
    ["convex/c.ts", 'import { type A } from "./a";'],
  ]);
  expect(cycles(edges(known))).toEqual([["convex/a.ts", "convex/b.ts"]]);
});

test("no value-import cycle in convex/", () => {
  const found = cycles(edges(files()));
  expect(found, `import cycles: ${found.map((g) => g.join(" <-> ")).join("; ")}`).toEqual([]);
});

test("schema.ts and the rules editor load none of the scorer's files (#756)", () => {
  const known = new Map([...files(), ...files(BROWSER_SOURCES)]);
  for (const entry of ["convex/schema.ts", "src/scoring/editing.ts"]) {
    const loaded = loadedBy(entry, known);
    expect(SCORER_FILES.filter((file) => loaded.has(file)), `${entry} loads`).toEqual([]);
  }
});
