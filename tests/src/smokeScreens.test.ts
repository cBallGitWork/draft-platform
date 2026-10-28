// The smoke run's phone check (tests/smoke/smoke.spec.ts) opens every route the router has, so a
// new screen can't skip its sideways-scroll and console-error check; the few it doesn't open are
// listed here, each with why.

import { describe, expect, it } from "vitest";
import { TRADES_PATH } from "../../src/frame/menu";
import { createShellRouter, type ShellContext } from "../../src/router";
import { LANDING_PATH } from "../../src/routes/root";
import { SIGN_IN_PATH } from "../../src/sign-in/paths";
import { BUILT_SCREENS } from "../support/smoke/builtScreens";

/** Every path the router matches, read from its route tree. Building it loads nothing. */
const routerPaths = Object.keys(createShellRouter({} as ShellContext).routesByPath);

/** Routes the phone run doesn't open, each with why. Trades is a placeholder (PageNotBuilt) until
 *  it's built: src/routes/frame.tsx. */
const NOT_SMOKED: ReadonlyMap<string, string> = new Map([
  [LANDING_PATH, "it redirects to My team; smoke.spec.ts's ?preview=manager test opens it"],
  [SIGN_IN_PATH, "smoke.spec.ts's ?preview=visitor test opens it"],
  [TRADES_PATH, "a placeholder until Trades is built"],
]);

/** A route's path as a pattern its addresses match: each `$param` one segment. */
const routePattern = (route: string) => new RegExp(`^${route.replace(/\$[^/]+/g, "[^/]+")}$`);

describe("the smoke run's built screens", () => {
  it("open every route the router has, but those listed with a reason", () => {
    const unsmoked = routerPaths.filter(
      (route) => !NOT_SMOKED.has(route) && !BUILT_SCREENS.some(([, path]) => routePattern(route).test(path)),
    );
    expect(unsmoked, "routes no BUILT_SCREENS entry opens: add each to tests/support/smoke/builtScreens.ts").toEqual([]);
  });

  it("list only routes the router has", () => {
    expect([...NOT_SMOKED.keys()].filter((route) => !routerPaths.includes(route))).toEqual([]);
  });

  it("each open a route", () => {
    expect(BUILT_SCREENS.filter(([, path]) => !routerPaths.some((route) => routePattern(route).test(path)))).toEqual([]);
  });
});
