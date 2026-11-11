import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import { firstRunFrom } from "../../../convex/waivers/waiverTimes";
import { passNextDeadline } from "../../support/convex/lineupSquad.harness";
import { BOB, NEXT, SAKA, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";

// A waiver run in the lock (spec/08: "From the deadline until the gameweek's last match is over,
// there are no claims, drops or free agent pickups. A run that falls in that time is skipped"):
// skipped while the lock is on, and, made late, skipped if its own time fell in it (Craig, 11 Nov
// 2026, #1470), judged by when the gameweek's last match was first read at full time.

let w: WaiverLeague;
beforeEach(async () => {
  w = await waiverLeague();
});

const waiverOrder = () => w.t.run((ctx) => ctx.db.query("waiverOrders").unique());

describe("a run whose time fell in the lock (#1470)", () => {
  // The league's first run is made before NEXT's deadline, then the deadline passes and the
  // gameweek's last match ends an hour after the first run time inside its lock.
  let inLock: number;
  let endedAt: number;
  let madeAt: number | undefined;
  beforeEach(async () => {
    await w.runWaivers();
    madeAt = (await waiverOrder())?.madeAt;
    await w.onWaivers([SAKA]);
    await w.claim(BOB, SAKA);
    await passNextDeadline(w.t);
    inLock = firstRunFrom(FIRST_RULES.waivers.runs, Date.now())!;
    endedAt = inLock + HOUR_MS;
    const read = { fixtureCode: NEXT, state: "fullTime" as const, homeGoals: 1, awayGoals: 0, minutes: 90, clockLabel: null };
    await w.t.mutation(internal.football.matchScores.upsertScores, { feed: "fpl", readAt: endedAt, reads: [read] });
  });

  const skipped = async () => {
    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "onWaivers" });
    expect(await w.pending(BOB)).toHaveLength(1);
    // The free agent window opens only with a made run.
    expect((await waiverOrder())?.madeAt).toBe(madeAt);
  };

  test("the cron starting it after the lock ends, after an outage or run times moved back into the lock, skips it", async () => {
    vi.setSystemTime(endedAt + HOUR_MS);
    await w.t.mutation(internal.waivers.waiverRun.runDue, {});
    // Only the run it starts, now: running every timer would move the clock on past later deadlines.
    vi.advanceTimersToNextTimer();
    await w.t.finishInProgressScheduledFunctions();
    expect(Date.now()).toBe(endedAt + HOUR_MS);
    expect((await waiverOrder())?.ranAt).toBe(inLock);
    await skipped();
  });

  test("made after the lock ends, it is skipped; a run time after the last match is made", async () => {
    vi.setSystemTime(endedAt + DAY_MS);
    await w.t.mutation(internal.waivers.waiverRun.run, { leagueId: w.leagueId, at: inLock });
    await skipped();

    await w.t.mutation(internal.waivers.waiverRun.run, { leagueId: w.leagueId, at: endedAt });
    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "owned", teamId: w.bobsTeam });
    expect((await waiverOrder())?.madeAt).toBe(endedAt);
  });
});

test("a run whose time came before the deadline, made in the lock, is still skipped", async () => {
  await w.onWaivers([SAKA]);
  await w.claim(BOB, SAKA);
  const at = Date.now();
  await passNextDeadline(w.t);
  await w.t.mutation(internal.waivers.waiverRun.run, { leagueId: w.leagueId, at });
  expect(await w.stateOf(SAKA)).toMatchObject({ kind: "onWaivers" });
});
