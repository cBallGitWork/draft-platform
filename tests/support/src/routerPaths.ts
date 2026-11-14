// The router's every path, read from its route tree, for the tests that must reach each one: the
// smoke run's built screens (tests/src/smokeScreens.test.ts) and the failed-read check
// (tests/src/frame/errorScreen.test.tsx), so a new route can't skip either.

import { createShellRouter, type ShellContext } from "../../../src/routes/router";

/** Every path the router matches. Building it loads nothing. */
export const routerPaths = Object.keys(createShellRouter({} as ShellContext).routesByPath);

/** A route's path as a pattern its addresses match: each `$param` one segment, then any search. */
export const routePattern = (route: string) => new RegExp(`^${route.replace(/\$[^/]+/g, "[^/]+")}(\\?.*)?$`);

/** Of the router's paths, those none of `paths` opens and `excused` doesn't name. */
export const routesNotReached = (paths: readonly string[], excused: ReadonlyMap<string, string>) =>
  routerPaths.filter((route) => !excused.has(route) && !paths.some((path) => routePattern(route).test(path)));
