import { expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { actingAs } from "../../support/convex/leagues.harness";
import { ANN, BOB, ELEVENS } from "../../support/convex/miniBeta.harness";
import { chainToGameweekSeven, firstRulesDeadline, heldSquad, holdHullEverton, NEXT_GAMEWEEK, playedAndLocked } from "../../support/convex/seasonChain.harness";
import { clockRunsTo, MADE_UP_CODES, pendingJobs, SLOW_TEST } from "../../support/convex/test.harness";
import { waiverStateOf } from "../../support/convex/waivers.harness";

// The clock-change weekend (#2134): the season chain (../../support/convex/seasonChain.harness.ts)
// carried on from gameweek 7 across Sunday 25 Oct 2026, when the clocks go back at 01:00 UTC and UK
// time goes from UTC+1 to UTC. It asserts only the times the spec sets: the waiver runs at 18:00 UK
// (S08.22) and the positions sync at 06:00 UK (S06.8). Deadlines across the change wait for
// Craig's answer, so gameweek 8's is only passed, never checked. Each moment is written in UTC,
// with what it is in the UK. The in-memory backend only.

/** Gameweek 8, Hull v Everton a week on again, on the Sunday the clocks go back, and its code. */
const CLOCK_CHANGE_GAMEWEEK = NEXT_GAMEWEEK + 1;
const CLOCK_CHANGE_MATCH = MADE_UP_CODES + 2;
const CLOCK_CHANGE_KICKOFF = Date.parse("2026-10-25T14:00:00Z");
/** The waiver runs either side, each at 18:00 UK (S08.22: "Wednesday and Thursday at 18:00 UK
 *  time"): summer time's last week's at 17:00 UTC, winter's first at 18:00. */
const SUMMER_WEDNESDAY = Date.parse("2026-10-21T17:00:00Z");
const SUMMER_THURSDAY = Date.parse("2026-10-22T17:00:00Z");
const WINTER_WEDNESDAY = Date.parse("2026-10-28T18:00:00Z");
/** The positions sync's 06:00 UK either side (S06.8):Saturday's at 05:00 UTC, Sunday's at 06:00. */
const SATURDAY_SIX = Date.parse("2026-10-24T05:00:00Z");
const SUNDAY_SIX = Date.parse("2026-10-25T06:00:00Z");

test("the season chain across the clocks going back on 25 Oct 2026: waivers run at 18:00 UK and the positions sync starts at 06:00 UK either side", SLOW_TEST, async () => {
  const { t, leagueId, annsTeam, bobsTeam, annsDrop, bobsDrop } = await chainToGameweekSeven();
  /** When the league's latest waiver run was. */
  const ranAt = () => t.run(async (ctx) => (await ctx.db.query("waiverOrders").withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId)).unique())!.ranAt);
  /** The waiver cron looks at `time`, as it does every few minutes, and what it starts runs. */
  const waiverCronAt = async (time: number) => {
    vi.setSystemTime(time);
    await t.mutation(internal.waivers.waiverRun.runDue, {});
    await clockRunsTo(t, time);
  };
  const claim = async (email: string, playerCode: number, dropCode: number) =>
    (await actingAs(t, email)).mutation(api.waivers.waiverClaims.putIn, { leagueId, playerCode, dropCode });

  // Gameweek 8 is held, kicking off on the Sunday the clocks go back. The cron's first look after
  // gameweek 7 makes Thursday 15 Oct's run, which the chain went past.
  await holdHullEverton(t, CLOCK_CHANGE_GAMEWEEK, CLOCK_CHANGE_MATCH, CLOCK_CHANGE_KICKOFF);
  await waiverCronAt(Date.now());
  const caughtUp = await ranAt();
  expect(caughtUp).toBeLessThan(SUMMER_WEDNESDAY);

  // Summer time: on Monday Bob claims the man Ann dropped, naming his own midfielder to go. At
  // 17:55 UK on Wednesday nothing runs; at 18:00 UK, 17:00 UTC, the run gives him his man.
  vi.setSystemTime(Date.parse("2026-10-19T09:00:00Z"));
  await claim(BOB, annsDrop.playerCode, bobsDrop.playerCode);
  await waiverCronAt(SUMMER_WEDNESDAY - 5 * MINUTE_MS);
  expect(await ranAt()).toBe(caughtUp);
  expect(await heldSquad(t, bobsTeam)).not.toContain(annsDrop.playerCode);
  await waiverCronAt(SUMMER_WEDNESDAY);
  expect(await ranAt()).toBe(SUMMER_WEDNESDAY);
  expect(await heldSquad(t, bobsTeam)).toContain(annsDrop.playerCode);
  expect(await heldSquad(t, bobsTeam)).not.toContain(bobsDrop.playerCode);
  await waiverCronAt(SUMMER_THURSDAY);
  expect(await ranAt()).toBe(SUMMER_THURSDAY);

  // The positions sync's cron fires at 05:00 and 06:00 UTC every day and starts one run a day, at
  // 06:00 UK: Saturday's at 05:00 UTC, the last of summer time, and Sunday's at 06:00 UTC, after the
  // clocks went back at 01:00 UTC. What a run reads is positionsSync's own tests', so the runs
  // started are counted and let go.
  const positionRuns = () => pendingJobs(t, internal.positions.positionsSync.run);
  const started: number[] = [];
  for (const time of [SATURDAY_SIX, SATURDAY_SIX + HOUR_MS, SUNDAY_SIX - HOUR_MS, SUNDAY_SIX]) {
    vi.setSystemTime(time);
    const before = (await positionRuns()).length;
    await t.mutation(internal.positions.positionsSync.daily, {});
    if ((await positionRuns()).length > before) started.push(time);
  }
  expect(started).toEqual([SATURDAY_SIX, SUNDAY_SIX]);
  for (const { _id } of await positionRuns()) await t.run((ctx) => ctx.scheduler.cancel(_id));

  // Gameweek 8's deadline passes on the Sunday and the cron puts the free agents back on waivers,
  // the man Bob let go among them; the match is played and locks. Ann claims him on Monday.
  await waiverCronAt(firstRulesDeadline(CLOCK_CHANGE_KICKOFF) + MINUTE_MS);
  await t.run((ctx) => recordPassedDeadlines(ctx));
  await playedAndLocked(t, CLOCK_CHANGE_MATCH, CLOCK_CHANGE_KICKOFF);
  expect(await waiverStateOf(t, leagueId, bobsDrop.playerCode)).toMatchObject({ kind: "onWaivers" });
  const annsMidfielder = ELEVENS[ANN].find(({ area, playerCode }) => area === "midfield" && playerCode !== annsDrop.playerCode)!;
  vi.setSystemTime(Date.parse("2026-10-26T09:00:00Z"));
  await claim(ANN, bobsDrop.playerCode, annsMidfielder.playerCode);

  // Winter time: at 17:00 UTC on Wednesday, summer's run time, it is 17:00 in the UK and nothing
  // runs; at 18:00 UTC, 18:00 UK, the run gives Ann her man.
  await waiverCronAt(WINTER_WEDNESDAY - HOUR_MS);
  expect(await ranAt()).toBe(SUMMER_THURSDAY);
  expect(await heldSquad(t, annsTeam)).not.toContain(bobsDrop.playerCode);
  await waiverCronAt(WINTER_WEDNESDAY);
  expect(await ranAt()).toBe(WINTER_WEDNESDAY);
  expect(await heldSquad(t, annsTeam)).toContain(bobsDrop.playerCode);
  expect(await heldSquad(t, annsTeam)).not.toContain(annsMidfielder.playerCode);
});
