import { describe, expect, it } from "vitest";
import { DRAFT_PATH, sectionsWith } from "../../../src/frame/menu";
import { createShellRouter, type ShellContext } from "../../../src/routes/router";
import { frameChildren } from "../../../src/routes/frame";

// Every page the menu reaches has its own screen: with every one built, there is no placeholder
// route left to catch one that isn't (#1579).

/** Every path the router matches, read from its route tree; building it also fills in each
 *  route's path. Building it loads nothing. */
const routerPaths = new Set(Object.keys(createShellRouter({} as ShellContext).routesByPath));

describe("the menu's routes", () => {
  it("give no address two frame routes", () => {
    const paths: readonly string[] = frameChildren.map((route) => route.fullPath);
    expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toEqual([]);
  });

  it("give every section and tab in the menu, the draft room's included, a route", () => {
    const menuPaths = sectionsWith(true).flatMap((section) => [section.path, ...section.tabs.map((tab) => tab.path)]);
    expect(menuPaths).toContain(DRAFT_PATH);
    expect(menuPaths.filter((path) => !routerPaths.has(path))).toEqual([]);
  });
});
