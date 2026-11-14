// The smoke run's built-screens check (tests/smoke/builtScreens.spec.ts), on the phone and the
// desk, opens every route the router has, so a new screen can't skip its sideways-scroll and
// console-error check; the few it doesn't open are listed here, each with why.

import { describe, expect, it } from "vitest";
import { LANDING_PATH } from "../../src/routes/root";
import { SIGN_IN_PATH } from "../../src/signIn/paths";
import { BUILT_SCREENS } from "../support/smoke/builtScreens";
import { routePattern, routerPaths, routesNotReached } from "../support/src/routerPaths";

/** Routes the built-screens run doesn't open, each with why. */
const NOT_SMOKED: ReadonlyMap<string, string> = new Map([
  [LANDING_PATH, "it redirects to My team; smoke.spec.ts's ?preview=manager test opens it"],
  [SIGN_IN_PATH, "smoke.spec.ts's ?preview=visitor test opens it"],
]);

describe("the smoke run's built screens", () => {
  it("open every route the router has, but those listed with a reason", () => {
    const unsmoked = routesNotReached(BUILT_SCREENS.map(([, path]) => path), NOT_SMOKED);
    expect(unsmoked, "routes no BUILT_SCREENS entry opens: add each to tests/support/smoke/builtScreens.ts").toEqual([]);
  });

  it("list only routes the router has", () => {
    expect([...NOT_SMOKED.keys()].filter((route) => !routerPaths.includes(route))).toEqual([]);
  });

  it("each open a route", () => {
    expect(BUILT_SCREENS.filter(([, path]) => !routerPaths.some((route) => routePattern(route).test(path)))).toEqual([]);
  });
});
