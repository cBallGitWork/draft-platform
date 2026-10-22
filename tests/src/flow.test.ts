// docs/design/flow.md, the map of the screens, kept honest against the router: every route is in
// its Screens table and is its own box in the diagram with an arrow touching it, every path the
// table gives a route is a real one, every file it names exists, and a placeholder says so.

import { describe, expect, it } from "vitest";
import flow from "../../docs/design/flow.md?raw";
import { createShellRouter, type ShellContext } from "../../src/router";

/** Every source file in src/, as `src/...`, so the table's File column can be checked. */
const sourceFiles = Object.keys(import.meta.glob("../../src/**/*.{ts,tsx}")).map((path) =>
  path.replace(/^\.\.\/\.\.\/src\//, "src/"),
);

/** Every path the router matches, read from its route tree. Building it loads nothing. */
const routerPaths = Object.keys(createShellRouter({} as ShellContext).routesByPath);

type Row = { path: string | null; file: string; status: string };

/** The Screens table's rows: a path in backticks, or null for a screen with no route yet. */
function screensTable(markdown: string): Row[] {
  const section = markdown.split(/^## Screens$/m)[1]?.split(/^## /m)[0] ?? "";
  return section
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Screen |"))
    .map((line) => {
      const [, path = "", file = "", , status = ""] = line.split("|").slice(1).map((cell) => cell.trim());
      return { path: /^`(\/[^`]*)`$/.exec(path)?.[1] ?? null, file, status };
    });
}

/** The diagram's boxes that show a path, as path -> box id: `ID["Name<br/>/path<br/>who"]`. */
function diagramBoxes(diagram: string): Map<string, string> {
  return new Map(
    [...diagram.matchAll(/^\s*(\w+)\["[^"<]*<br\/>(\/[^<]*)<br\/>/gm)].map(([, id = "", path = ""]) => [path, id]),
  );
}

/** Every box id that an arrow starts or ends at, labels left out. */
function arrowEnds(diagram: string): Set<string> {
  const arrows = diagram.split("\n").filter((line) => /--|-\.->/.test(line) && !/^\s*\w+\[/.test(line));
  return new Set(arrows.flatMap((line) => line.replace(/"[^"]*"/g, "").match(/\b\w+\b/g) ?? []));
}

/** What's wrong between the router's paths and the map, one line each, naming the path. */
function mapProblems(routes: readonly string[], markdown: string): string[] {
  const mapped = screensTable(markdown).flatMap((row) => (row.path === null ? [] : [row.path]));
  const diagram = markdown.split("```mermaid")[1]?.split("```")[0] ?? "";
  const boxes = diagramBoxes(diagram);
  const ends = arrowEnds(diagram);
  return [
    ...routes.filter((path) => !mapped.includes(path)).map((path) => `${path} is a route but isn't in flow.md's table`),
    ...routes.filter((path) => !boxes.has(path)).map((path) => `${path} is a route but isn't drawn in flow.md's map`),
    ...routes
      .filter((path) => boxes.has(path) && !ends.has(boxes.get(path) ?? ""))
      .map((path) => `${path} is drawn in flow.md's map but no arrow touches it`),
    ...mapped.filter((path) => !routes.includes(path)).map((path) => `${path} is in flow.md's table but isn't a route`),
  ];
}

/** Rows whose Status disagrees with their File: PageNotBuilt is a placeholder, any other page is built. */
function statusProblems(rows: readonly Row[]): string[] {
  return rows
    .filter((row) => row.path !== null)
    .filter((row) =>
      row.file === "src/frame/PageNotBuilt.tsx" ? !row.status.includes("placeholder") : row.status !== "built",
    )
    .map((row) => `${row.path} is ${row.file} but its Status says "${row.status}"`);
}

describe("the screen map, docs/design/flow.md", () => {
  it("has every route the router has, and none it doesn't", () => {
    expect(routerPaths.length).toBeGreaterThan(0);
    expect(mapProblems(routerPaths, flow)).toEqual([]);
  });

  it("says placeholder exactly where the page isn't built", () => {
    expect(statusProblems(screensTable(flow))).toEqual([]);
    expect(statusProblems([{ path: "/x", file: "src/frame/PageNotBuilt.tsx", status: "built" }])).toEqual([
      '/x is src/frame/PageNotBuilt.tsx but its Status says "built"',
    ]);
  });

  it("names files that exist", () => {
    const files = screensTable(flow).flatMap((row) => (row.file === "none" ? [] : [row.file]));
    expect(sourceFiles).toContain("src/router.tsx");
    expect(files.filter((file) => !sourceFiles.includes(file))).toEqual([]);
  });

  it("names a route missing from the map, and a mapped path the router doesn't have", () => {
    expect(mapProblems([...routerPaths, "/fake"], flow)).toEqual([
      "/fake is a route but isn't in flow.md's table",
      "/fake is a route but isn't drawn in flow.md's map",
    ]);
    expect(mapProblems(routerPaths.filter((path) => path !== "/table"), flow)).toEqual([
      "/table is in flow.md's table but isn't a route",
    ]);
  });

  it("names a route whose box no arrow touches, and doesn't take a path in another box's words", () => {
    const unlinked = flow.replace(/^(?!\s*PL\[).*\bPL\b.*$/gm, "");
    expect(mapProblems(routerPaths, unlinked)).toEqual([
      "/premier-league is drawn in flow.md's map but no arrow touches it",
    ]);
    const moved = flow.replace(
      'PL["Premier League<br/>/premier-league<br/>manager"]',
      'PL["Premier League, see /premier-league"]',
    );
    expect(mapProblems(routerPaths, moved)).toContain("/premier-league is a route but isn't drawn in flow.md's map");
  });
});
