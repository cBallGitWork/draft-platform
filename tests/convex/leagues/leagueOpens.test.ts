import { expect, test } from "vitest";
import { leagueOpens } from "../../../convex/leagues/leagueOpens";

// Whether a league's pages open (#562): the one rule the switcher's list and the screens share.

test("a league opens until it is being deleted", () => {
  expect(leagueOpens({})).toBe(true);
  expect(leagueOpens({ deletion: { deletesAt: Date.parse("2026-10-22T09:00:00Z") } })).toBe(false);
});
