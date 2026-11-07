import { beforeEach, describe, expect, test } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { DAY_MS, WEEK_MS } from "../../../convex/shared/time";
import { clubsByCode } from "../../../convex/shared/players";
import { squadSchedule } from "../../../convex/squads/squadSchedule";
import { adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { holdGameweeks, KICKS_OFF_IN } from "../../support/convex/leagueRules.harness";
import { ARSENAL, CHELSEA, insertClubs } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The Squad tab's Schedule view (#1006): his club's matches in the next six gameweeks, from the one
// a lineup is being set for; a blank week has none, a double two, and the gameweeks stop at 38
// (Craig, 6 Nov 2026).

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  await t.run((ctx) => insertClubs(ctx, [ARSENAL, CHELSEA]));
});

/** Holds a season whose gameweek `next` is the one being set, with Arsenal's matches in it: one at
 *  home to Chelsea in `next`, none in the week after, two in the week after that. */
async function holdSeason(next: number) {
  await holdGameweeks(t, { next });
  const kickoffOf = (gameweek: number, days = 0) => Date.now() + KICKS_OFF_IN + (gameweek - next) * WEEK_MS + days * DAY_MS;
  const match = (code: number, gameweek: number, homeClubCode: number, awayClubCode: number, days = 0) => ({ code, gameweek, homeClubCode, awayClubCode, kickoff: kickoffOf(gameweek, days) });
  await t.run(async (ctx) => {
    for (const each of [match(101, next, ARSENAL.code, CHELSEA.code), match(102, next + 2, CHELSEA.code, ARSENAL.code, 3), match(103, next + 2, ARSENAL.code, CHELSEA.code)]) {
      if (each.gameweek <= 38) await ctx.db.insert("fixtures", each);
    }
  });
}

/** The schedule, its map as entries: a test run returns only Convex values. */
const scheduleOf = async () => {
  const { gameweeks, byClub } = await t.run(async (ctx) => {
    const schedule = await squadSchedule(ctx, leagueId, Date.now(), new Set([ARSENAL.code, CHELSEA.code]), clubsByCode(ctx));
    return { gameweeks: schedule.gameweeks, byClub: [...schedule.byClub] };
  });
  return { gameweeks, byClub: new Map(byClub) };
};

describe("the schedule", () => {
  test("holds the next six gameweeks, from the one being set, and each club's matches in them, a double week's in kickoff order", async () => {
    await holdSeason(10);
    const { gameweeks, byClub } = await scheduleOf();
    expect(gameweeks).toEqual([10, 11, 12, 13, 14, 15]);
    expect(byClub.get(ARSENAL.code)!.map(({ gameweek, opponent, home }) => [gameweek, opponent.shortName, home])).toEqual([
      [10, "CHE", true],
      [12, "CHE", true],
      [12, "CHE", false],
    ]);
    expect(byClub.get(CHELSEA.code)!.map(({ gameweek, home }) => [gameweek, home])).toEqual([
      [10, false],
      [12, false],
      [12, true],
    ]);
  });

  test("stops at gameweek 38 near the season's end", async () => {
    await holdSeason(35);
    expect((await scheduleOf()).gameweeks).toEqual([35, 36, 37, 38]);
  });

  test("holds no gameweeks once every gameweek has begun", async () => {
    await holdGameweeks(t, { next: 40 });
    expect(await scheduleOf()).toEqual({ gameweeks: [], byClub: new Map() });
  });
});
