// docs/design/flow.md, the map of the screens, kept honest against the router: every route is in
// its Screens table and drawn in its diagram, every path the table gives a route is a real one,
// and every file it names exists.

import { describe, expect, it } from "vitest";
import flow from "../docs/design/flow.md?raw";
import { createShellRouter, type ShellContext } from "./router";

/** Every source file in src/, as `src/...`, so the table's File column can be checked. */
const sourceFiles = Object.keys(import.meta.glob("./**/*.{ts,tsx}")).map((path) => path.replace(/^\.\//, "src/"));

/** Every path the router matches, read from its route tree. Building it loads nothing. */
const routerPaths = Object.keys(createShellRouter({} as ShellContext).routesByPath);

type Row = { path: string | null; file: string };

/** The Screens table's rows: a path in backticks, or null for a screen with no route yet. */
function screensTable(markdown: string): Row[] {
  const section = markdown.split(/^## Screens$/m)[1]?.split(/^## /m)[0] ?? "";
  return section
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Screen |"))
    .map((line) => {
      const [, path = "", file = ""] = line.split("|").slice(1).map((cell) => cell.trim());
      return { path: /^`(\/[^`]*)`$/.exec(path)?.[1] ?? null, file };
    });
}

/** What's wrong between the router's paths and the map, one line each, naming the path. */
function mapProblems(routes: readonly string[], markdown: string): string[] {
  const mapped = screensTable(markdown).flatMap((row) => (row.path === null ? [] : [row.path]));
  const diagram = markdown.split("```mermaid")[1]?.split("```")[0] ?? "";
  return [
    ...routes.filter((path) => !mapped.includes(path)).map((path) => `${path} is a route but isn't in flow.md's table`),
    ...routes.filter((path) => !diagram.includes(`<br/>${path}<br/>`)).map((path) => `${path} is a route but isn't drawn in flow.md's map`),
    ...mapped.filter((path) => !routes.includes(path)).map((path) => `${path} is in flow.md's table but isn't a route`),
  ];
}

describe("the screen map, docs/design/flow.md", () => {
  it("has every route the router has, and none it doesn't", () => {
    expect(routerPaths.length).toBeGreaterThan(0);
    expect(mapProblems(routerPaths, flow)).toEqual([]);
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
});
