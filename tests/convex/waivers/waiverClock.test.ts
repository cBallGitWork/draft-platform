import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { leagueDeadlines } from "../../../convex/gameweeks/leagueDeadlines";
import { clockHourOf } from "../../../convex/home/homeAt";
import { latestRules } from "../../../convex/rules/rulesHistory";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { firstRunsAt, firstRunTaking } from "../../../convex/waivers/runsAhead";
import { underWayIn } from "../../../convex/waivers/waiverLock";
import { actingAs, ANN } from "../../support/convex/leagues.harness";
import { NEXT, waiverLeague } from "../../support/convex/waivers.harness";

// The waiver clock (#2008): Scouting, the claims and the player card ask for the runs' times once
// an hour, never each minute, and judge them at their minute. Nothing a manager sees changes: at
// every minute, the run that can first take a player is the one the server worked out when the
// minute was in the query's arguments.

test("every minute of the hours around a deadline judges the runs from its hour's one clock read, as the server judged them at that minute, whether the gameweek is under way or over (S08.14)", async () => {
  const w = await waiverLeague();
  const caller = await actingAs(w.t, ANN);
  const deadline = await w.t.run(async (ctx) => (await leagueDeadlines(ctx, w.leagueId)).get(NEXT) ?? null);
  if (deadline === null) throw new Error("The waiver league holds no deadline for its next gameweek");
  const claimable = [deadline - DAY_MS, deadline + DAY_MS];
  const hours = [...new Set([clockHourOf(deadline - MINUTE_MS), clockHourOf(deadline)])];
  /** The run that can first take each claimable player at `now`, as the server worked it out before #2008. */
  const serverAt = (now: number) =>
    w.t.run(async (ctx) => {
      const deadlines = await leagueDeadlines(ctx, w.leagueId);
      const runs = (await latestRules(ctx, w.leagueId)).waivers.runs;
      const underWay = await underWayIn(ctx, deadlines, now);
      return claimable.map((claimableFrom) => firstRunTaking(runs, deadlines, underWay, claimableFrom, now));
    });
  const skippedIfs = new Set<number | null>();
  const compareEachMinute = async () => {
    for (const hour of hours) {
      const times = await caller.query(api.waivers.waiverClock.clockOf, { leagueId: w.leagueId, hour });
      for (let now = hour; now < hour + HOUR_MS; now += MINUTE_MS) {
        const shown = claimable.map(firstRunsAt(times, now));
        expect(shown, new Date(now).toISOString()).toEqual(await serverAt(now));
        for (const run of shown) skippedIfs.add(run?.skippedIf ?? null);
      }
    }
  };

  await compareEachMinute();
  await w.matchIs(NEXT, "fullTime");
  await compareEachMinute();
  // Both of the lock's answers were judged: a run that may be skipped, and one that surely isn't.
  expect(skippedIfs).toEqual(new Set([NEXT, null]));
});
