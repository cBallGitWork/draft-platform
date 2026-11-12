import { beforeEach, expect, test } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { deadlineOf, leagueDeadlines } from "../../../convex/gameweeks/leagueDeadlines";
import { nextByDeadlines } from "../../../convex/gameweeks/nextGameweek";
import { saveGameweekOf } from "../../../convex/lineup/lineups";
import { DAY_MS, WEEK_MS } from "../../../convex/shared/time";
import { changeRules, holdGameweeks, NEXT, rulesWith } from "../../support/convex/leagueRules.harness";
import { adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The gameweek a save goes to is the one the league's own deadlines, which every screen shows, mark
// as next (#1764): never worked out from another list of the season's gameweeks. One deadline a
// gameweek, the league's own (S05.25, S05.20).

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});

/** The gameweek the league's deadlines mark as next, as the screens work it out. */
const markedNext = (leagueId: Id<"leagues">) =>
  t.run(async (ctx) => {
    const deadlines = await leagueDeadlines(ctx, leagueId);
    return nextByDeadlines([...deadlines.keys()], deadlineOf(deadlines), Date.now());
  });
/** The gameweek a save now goes to, or null once the season is over. */
const saveGameweek = (leagueId: Id<"leagues">) =>
  t.run(async (ctx) => {
    const save = await saveGameweekOf(ctx, leagueId, Date.now());
    return save.kind === "open" ? save.gameweek : null;
  });

/** Rows for gameweeks 1 to 11, each begun; the matches of 12 (begun yesterday) and 13 (next week)
 *  arrive before their rows. */
const holdMatchesBeforeRows = () =>
  t.run(async (ctx) => {
    for (let number = 1; number <= 13; number += 1) {
      const kickoff = Date.now() - DAY_MS + (number - 12) * WEEK_MS;
      if (number <= 11) await ctx.db.insert("gameweeks", { number, deadline: kickoff });
      await ctx.db.insert("fixtures", { code: number, gameweek: number, homeClubCode: 1, awayClubCode: 2, kickoff });
    }
  });

test("matches held for gameweeks with no row yet: a save goes to the gameweek the screens mark as next", async () => {
  await holdMatchesBeforeRows();
  const leagueId = await adminCreatesLeague(t);

  expect(await markedNext(leagueId)).toBe(13);
  expect(await saveGameweek(leagueId)).toBe(13);
});

test("matches held for gameweeks with no row yet: a rules change takes effect from the gameweek the screens mark as next", async () => {
  await holdMatchesBeforeRows();
  const leagueId = await adminCreatesLeague(t);

  expect(await markedNext(leagueId)).toBe(13);
  expect(await changeRules(t, leagueId, rulesWith({ deadline: { minutesBeforeFirstKickoff: 90 } }))).toBe(13);
});

test("a league with no rules row in force in its early gameweeks still finds the gameweek a save goes to", async () => {
  await holdGameweeks(t, { next: NEXT });
  const leagueId = await adminCreatesLeague(t);
  // Its rules dated from gameweek 5, as for a league whose history starts mid-season.
  await t.run(async (ctx) => {
    const [first] = await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect();
    await ctx.db.patch("leagueRules", first!._id, { fromGameweek: 5 });
  });

  expect(await markedNext(leagueId)).toBe(NEXT);
  expect(await saveGameweek(leagueId)).toBe(NEXT);
});
