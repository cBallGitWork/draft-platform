import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PING_URL_ENV } from "../../../convex/heartbeats/heartbeat";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { HOUR_MS, MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { DATE_DAYS, latestRunAt } from "../../../convex/waivers/waiverTimes";
import { changeRules, HELD_FIRST_RULES, rulesWith } from "../../support/convex/leagueRules.harness";
import { adminCreatesLeague, TEST_LEAGUE_TEAMS } from "../../support/convex/leagues.harness";
import { pendingJobs } from "../../support/convex/test.harness";
import { BOB, NEXT, PALMER, SAKA, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";

// The waiver cron (#1198, spec/08): it runs each league's waivers at its run times, once, and only
// at a time that was a run time when it came (#1468).

let w: WaiverLeague;
/** The league's next run time, within the week, with the gameweeks around it over, so it falls
 *  outside the lock. */
let runTime: number;
beforeEach(async () => {
  w = await waiverLeague();
  runTime = latestRunAt(FIRST_RULES.waivers.runs, Date.now() + WEEK_MS)!;
  for (const gameweek of [NEXT, NEXT + 1]) await w.matchIs(gameweek, "fullTime");
});

const ranAt = () => w.t.run(async (ctx) => (await ctx.db.query("waiverOrders").unique())?.ranAt);
const runDue = async () => {
  await w.t.mutation(internal.waivers.waiverRun.runDue, {});
  await w.t.finishAllScheduledFunctions(vi.runAllTimers);
};

describe("the cron", () => {
  test("runs each league's waivers at its run time, once", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(BOB, SAKA);
    vi.setSystemTime(runTime + 2 * MINUTE_MS);

    await runDue();
    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "owned", teamId: w.bobsTeam });
    expect(await ranAt()).toBe(runTime);

    await w.onWaivers([PALMER], runTime);
    await runDue();
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "onWaivers" });
  });

  test("a run time the commissioner adds once it has gone never runs; one still ahead does (#1468, S08.10)", async () => {
    vi.setSystemTime(runTime + 2 * MINUTE_MS);
    await runDue();
    expect(await ranAt()).toBe(runTime);

    // At 20:00 on the run's day the commissioner adds 19:00 that day, already gone, and 21:00.
    await w.onWaivers([PALMER], runTime);
    await w.claim(BOB, PALMER);
    vi.setSystemTime(runTime + 2 * HOUR_MS);
    const day = DATE_DAYS[new Date(runTime).getUTCDay()];
    const runs = [...FIRST_RULES.waivers.runs, { day, hour: 19, minute: 0 }, { day, hour: 21, minute: 0 }];
    await changeRules(w.t, w.leagueId, rulesWith({ waivers: { ...HELD_FIRST_RULES.waivers, runs } }));
    vi.setSystemTime(runTime + 2 * HOUR_MS + 2 * MINUTE_MS);
    await runDue();
    expect(await ranAt()).toBe(runTime);
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "onWaivers" });

    vi.setSystemTime(runTime + 3 * HOUR_MS + 2 * MINUTE_MS);
    await runDue();
    expect(await ranAt()).toBe(runTime + 3 * HOUR_MS);
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "owned", teamId: w.bobsTeam });
  });

  test("each league is checked in its own transaction, so one league's fault stops no other's run (#1762)", async () => {
    vi.stubEnv(PING_URL_ENV, "https://hc-ping.com/ping-key");
    // Another league, due at the same run time, that has lost its rules, so its check throws.
    const other = await adminCreatesLeague(w.t, TEST_LEAGUE_TEAMS, "Another league");
    await w.t.run(async (ctx) => {
      const rules = ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", other));
      for (const row of await rules.collect()) await ctx.db.delete("leagueRules", row._id);
    });
    await w.onWaivers([SAKA]);
    await w.claim(BOB, SAKA);
    vi.setSystemTime(runTime + 2 * MINUTE_MS);

    await w.t.mutation(internal.waivers.waiverRun.runDue, {});
    expect((await pendingJobs(w.t, internal.heartbeats.heartbeat.beat)).map((job) => job.args)).toEqual([[{ check: "waiverRuns" }]]);
    const asked = (await pendingJobs(w.t, internal.waivers.waiverRun.runLeagueDue)).map((job) => job.args[0] as { leagueId: Id<"leagues"> });
    expect(asked.map(({ leagueId }) => leagueId).sort()).toEqual([w.leagueId, other].sort());

    for (const args of asked) {
      const checking = w.t.mutation(internal.waivers.waiverRun.runLeagueDue, args);
      if (args.leagueId === other) await expect(checking).rejects.toThrow("has no rules");
      else await checking;
    }
    const [running] = await pendingJobs(w.t, internal.waivers.waiverRun.run);
    await w.t.mutation(internal.waivers.waiverRun.run, running.args[0] as { leagueId: Id<"leagues">; at: number });
    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "owned", teamId: w.bobsTeam });
    expect(await ranAt()).toBe(runTime);
  });
});
