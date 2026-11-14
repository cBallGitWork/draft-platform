import { describe, expect, it } from "vitest";
import { DRAFT_PATH, sectionsWith } from "../../../src/frame/menu";
import { frameChildren } from "../../../src/routes/frame";
// Building the router, as this does, also fills in each route's path.
import { routerPaths } from "../../support/src/routerPaths";

// Every page the menu reaches has its own screen: with every one built, there is no placeholder
// route left to catch one that isn't (#1579).

describe("the menu's routes", () => {
  it("give no address two frame routes", () => {
    const paths: readonly string[] = frameChildren.map((route) => route.fullPath);
    expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toEqual([]);
  });

  it("give every section and tab in the menu, the draft room's included, a route", () => {
    const menuPaths = sectionsWith(true).flatMap((section) => [section.path, ...section.tabs.map((tab) => tab.path)]);
    expect(menuPaths).toContain(DRAFT_PATH);
    expect(menuPaths.filter((path) => !routerPaths.includes(path))).toEqual([]);
  });
});
