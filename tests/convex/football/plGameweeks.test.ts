import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { refusals } from "../../../convex/shared/leagueAccess";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { actingAs } from "../../support/convex/leagues.harness";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";

// Each Premier League gameweek's first kickoff (#49), which the section's fixtures open on the
// current gameweek from.

const MANAGER = "manager@example.com";
const SATURDAY = Date.parse("2026-10-17T11:30:00Z");

function holdFixtures(t: TestConvex, fixtures: { code: number; gameweek: number | null; kickoff: number | null; droppedAt?: number }[]) {
  return t.run(async (ctx) => {
    for (const fixture of fixtures) await ctx.db.insert("fixtures", { homeClubCode: 1, awayClubCode: 2, ...fixture });
  });
}

test("each gameweek's earliest kickoff, in gameweek order, leaving out matches with no time, no gameweek or dropped", async () => {
  const t = freshConvex();
  await holdFixtures(t, [
    { code: 1, gameweek: 9, kickoff: SATURDAY + WEEK_MS },
    { code: 2, gameweek: 8, kickoff: SATURDAY + 2 * HOUR_MS },
    { code: 3, gameweek: 8, kickoff: SATURDAY },
    { code: 4, gameweek: 8, kickoff: null },
    { code: 5, gameweek: null, kickoff: null },
    { code: 6, gameweek: 10, kickoff: null },
    { code: 7, gameweek: 8, kickoff: SATURDAY - HOUR_MS, droppedAt: SATURDAY },
  ]);

  expect(await (await actingAs(t, MANAGER)).query(api.football.plGameweeks.firstKickoffs, {})).toEqual([
    { gameweek: 8, firstKickoff: SATURDAY },
    { gameweek: 9, firstKickoff: SATURDAY + WEEK_MS },
  ]);
});

test("with no matches held, none", async () => {
  const t = freshConvex();

  expect(await (await actingAs(t, MANAGER)).query(api.football.plGameweeks.firstKickoffs, {})).toEqual([]);
});

test("someone signed out is refused them", async () => {
  const t = freshConvex();

  await expect(t.query(api.football.plGameweeks.firstKickoffs, {})).rejects.toThrow(refusals.signedOut);
});
