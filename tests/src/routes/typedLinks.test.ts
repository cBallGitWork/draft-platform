import { linkOptions } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { MY_TEAM_PATH } from "../../../src/frame/menu";
import { MATCH_ROUTE } from "../../../src/premierLeague/paths";
import "../../../src/routes/router";

// The router is registered (routes/router.tsx), so a link is checked against the routes when the
// code is built: the typecheck fails each `@ts-expect-error` below that stops being an error.

test("a link to an address with no route fails the typecheck", () => {
  // @ts-expect-error: no route has this address.
  expect(linkOptions({ to: "/no-such-page" }).to).toBe("/no-such-page");
});

test("a link to a route with a param must give it", () => {
  // @ts-expect-error: the match page needs its fixtureCode.
  linkOptions({ to: MATCH_ROUTE });
  expect(linkOptions({ to: MATCH_ROUTE, params: { fixtureCode: "1" } }).params).toEqual({ fixtureCode: "1" });
  expect(linkOptions({ to: MY_TEAM_PATH }).to).toBe(MY_TEAM_PATH);
});

test("the match route keeps its literal type, written without `as const`", () => {
  // screen_routes.py traces a path constant only when its string ends the statement, so the route is
  // a plain template; the typecheck fails here if it ever stops reading as the literal route.
  const route: "/premier-league/match/$fixtureCode" = MATCH_ROUTE;
  expect(route).toBe("/premier-league/match/$fixtureCode");
});
