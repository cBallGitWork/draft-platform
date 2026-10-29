// docs/design/flow.md, the map of the screens, kept honest against the router: every route is in
// its Screens table and is its own box in the diagram with an arrow touching it, every path the
// table gives a route is a real one, every file it names exists, and its Status is the route's state.

import { describe, expect, it } from "vitest";
import flow from "../../docs/design/flow.md?raw";
import { createShellRouter, type ShellContext } from "../../src/routes/router";

/** Every source file in src/, as `src/...`, so the table's File column can be checked. */
const sourceFiles = Object.keys(import.meta.glob("../../src/**/*.{ts,tsx}")).map((path) =>
  path.replace(/^\.\.\/\.\.\/src\//, "src/"),
);

/** Every path the router matches, read from its route tree. Building it loads nothing. */
const routerPaths = Object.keys(createShellRouter({} as ShellContext).routesByPath);

type Row = { screen: string; path: string | null; file: string; status: string };

/** The Screens table's rows: a path in backticks, or null for a screen with no route yet. */
function screensTable(markdown: string): Row[] {
  const section = markdown.split(/^## Screens$/m)[1]?.split(/^## /m)[0] ?? "";
  return section
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Screen |"))
    .map((line) => {
      const [screen = "", path = "", file = "", , status = ""] = line.split("|").slice(1).map((cell) => cell.trim());
      return { screen, path: /^`(\/[^`]*)`$/.exec(path)?.[1] ?? null, file, status };
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

/** The route's state, the only thing Status says: whether a screen is spec'd or to grill lives in SPEC.md. */
function routeState(row: Row): string {
  if (row.path === null) return "no route";
  return row.file === "src/frame/PageNotBuilt.tsx" ? "placeholder" : "built";
}

/** Rows whose Status isn't their route's state, one line each, naming the screen. */
function statusProblems(rows: readonly Row[]): string[] {
  return rows
    .filter((row) => row.status !== routeState(row))
    .map((row) => `${row.screen}'s Status says "${row.status}" but its route is "${routeState(row)}"`);
}

describe("the screen map, docs/design/flow.md", () => {
  it("has every route the router has, and none it doesn't", () => {
    expect(routerPaths.length).toBeGreaterThan(0);
    expect(mapProblems(routerPaths, flow)).toEqual([]);
  });

  it("gives each screen's Status as its route's state alone: built, placeholder or no route", () => {
    const rows = screensTable(flow);
    expect(rows.length).toBeGreaterThan(0);
    expect(statusProblems(rows)).toEqual([]);
    expect(
      statusProblems([
        { screen: "X", path: "/x", file: "src/frame/PageNotBuilt.tsx", status: "built" },
        { screen: "Y", path: "/y", file: "src/frame/PageNotBuilt.tsx", status: "to grill (placeholder)" },
        { screen: "Z", path: null, file: "none", status: "spec'd (#45)" },
        { screen: "W", path: "/w", file: "src/w/WPage.tsx", status: "placeholder" },
      ]),
    ).toEqual([
      `X's Status says "built" but its route is "placeholder"`,
      `Y's Status says "to grill (placeholder)" but its route is "placeholder"`,
      `Z's Status says "spec'd (#45)" but its route is "no route"`,
      `W's Status says "placeholder" but its route is "built"`,
    ]);
  });

  it("names files that exist", () => {
    const files = screensTable(flow).flatMap((row) => (row.file === "none" ? [] : [row.file]));
    expect(sourceFiles).toContain("src/routes/router.tsx");
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
