import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { leagueDeadlines } from "../../../convex/gameweeks/leagueDeadlines";
import { clockHourOf } from "../../../convex/home/homeAt";
import { latestRules } from "../../../convex/rules/rulesHistory";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { endedInHour, firstRunsAt, firstRunTaking, waiversAt } from "../../../convex/waivers/runsAhead";
import { inWaiverLock, underWayIn } from "../../../convex/waivers/waiverLock";
import { windowOpen } from "../../../convex/waivers/waiverOrder";
import { actingAs, ANN } from "../../support/convex/leagues.harness";
import { NEXT, waiverLeague } from "../../support/convex/waivers.harness";

// The waiver clock (#2008): Scouting, the claims, the player card and the waiver order ask for the
// runs' times once an hour, never each minute, and judge them at their minute. Nothing a manager sees changes: at
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

test("every minute of the hours around a deadline shows the waiver order, its runs, the lock and the window from its hour's one read, as a read at that minute shows them, whether the gameweek is under way or over (S08.18, S08.14)", async () => {
  const w = await waiverLeague();
  const caller = await actingAs(w.t, ANN);
  const deadline = await w.t.run(async (ctx) => (await leagueDeadlines(ctx, w.leagueId)).get(NEXT) ?? null);
  if (deadline === null) throw new Error("The waiver league holds no deadline for its next gameweek");
  // Gameweek NEXT scored with Cat bottom, so the order changes once it has ended.
  await w.t.run(async (ctx) => {
    for (const teamId of w.teams) {
      const points = teamId === w.catsTeam ? 10 : 50;
      await ctx.db.insert("finalScores", { leagueId: w.leagueId, gameweek: NEXT, teamId, points, fixtureCodes: [NEXT], storedAt: Date.now() });
    }
  });
  const hours = [...new Set([clockHourOf(deadline - MINUTE_MS), clockHourOf(deadline)])];
  /** What the server judges at `now`: the latest gameweek ended, the lock and the window. */
  const serverAt = (now: number) =>
    w.t.run(async (ctx) => {
      const deadlines = await leagueDeadlines(ctx, w.leagueId);
      return { locked: await inWaiverLock(ctx, deadlines, now), windowOpen: await windowOpen(ctx, w.leagueId, deadlines, now) };
    });
  const firstTeams = new Set<string>();
  const compareEachMinute = async () => {
    for (const hour of hours) {
      const held = await caller.query(api.waivers.waiverOrder.ofLeague, { leagueId: w.leagueId, hour });
      for (let now = hour; now < hour + HOUR_MS; now += MINUTE_MS) {
        const shown = waiversAt(held, now);
        const atMinute = waiversAt(await caller.query(api.waivers.waiverOrder.ofLeague, { leagueId: w.leagueId, hour: now }), now);
        expect(shown, new Date(now).toISOString()).toEqual(atMinute);
        expect({ locked: shown.locked, windowOpen: shown.windowOpen }, new Date(now).toISOString()).toEqual(await serverAt(now));
        firstTeams.add(shown.teams[0].teamId);
      }
    }
  };

  await compareEachMinute();
  await w.matchIs(NEXT, "fullTime");
  await compareEachMinute();
  // Over, the gameweek's end reorders the waivers at its deadline's minute, inside the hour read:
  // Cat goes first from then.
  expect(firstTeams).toEqual(new Set([w.teams.at(-1), w.catsTeam]));
});

test("the waiver order sends one order for each latest gameweek ended its hour can see: two in the hour a gameweek already over begins, one otherwise (S08.18)", () => {
  const deadlines = new Map([
    [4, Date.UTC(2027, 0, 9, 10, 0)],
    [5, Date.UTC(2027, 0, 14, 10, 30)],
  ]);
  const deadlineHour = Date.UTC(2027, 0, 14, 10, 0);
  expect(endedInHour(deadlines, [], deadlineHour)).toEqual([4, 5]);
  expect(endedInHour(deadlines, [5], deadlineHour)).toEqual([4]);
  expect(endedInHour(deadlines, [], deadlineHour + HOUR_MS)).toEqual([5]);
  expect(endedInHour(deadlines, [], Date.UTC(2027, 0, 1, 10, 0))).toEqual([null]);
});
