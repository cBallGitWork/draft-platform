import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { nextDeadline } from "../../../convex/gameweeks/deadline";
import { leagueDeadlines } from "../../../convex/gameweeks/leagueDeadlines";
import { NEVER_DUE } from "../../../convex/leagues/leagueChecks";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { MINUTE_MS } from "../../../convex/shared/time";
import { WAIVER_CHECK_EVERY } from "../../../convex/waivers/waiverRun";
import { firstRunFrom } from "../../../convex/waivers/waiverTimes";
import { changeRules, HELD_FIRST_RULES, rulesWith } from "../../support/convex/leagueRules.harness";
import { ANN, BOB } from "../../support/convex/leagues.harness";
import { pendingJobs } from "../../support/convex/test.harness";
import { ANNS_FIRST_DROP, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";
import { NEXT } from "../../support/convex/waivers.harness";

// The waiver and trade crons read only the leagues due a look (#1998): each league's next check is
// kept on its row, so a pass between them reads no league at all, and whatever brings a check
// sooner wakes the league for the next pass.

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
});

type PerLeague = FunctionReference<"mutation", "internal", { leagueId: Id<"leagues"> }>;

/** One pass of `cron`, each league it asks for then looked at by `perLeague`, the clock still: the
 *  leagues it asked for. */
async function pass(cron: FunctionReference<"mutation", "internal", Record<string, never>>, perLeague: PerLeague): Promise<Id<"leagues">[]> {
  const before = new Set((await pendingJobs(w.t, perLeague)).map(({ _id }) => _id));
  await w.t.mutation(cron, {});
  const asked = (await pendingJobs(w.t, perLeague)).filter(({ _id }) => !before.has(_id)).map((job) => job.args[0] as { leagueId: Id<"leagues"> });
  for (const args of asked) await w.t.mutation(perLeague, args);
  return asked.map(({ leagueId }) => leagueId);
}
const waiverPass = () => pass(internal.waivers.waiverRun.runDue, internal.waivers.waiverRun.runLeagueDue);
const offerPass = () => pass(internal.trades.tradeClose.closeDue, internal.trades.tradeClose.closeLeagueDue);

const row = () => w.t.run((ctx) => ctx.db.query("leagueChecks").withIndex("by_leagueId", (q) => q.eq("leagueId", w.leagueId)).unique());
const nextDeadlineAt = () => w.t.run(async (ctx) => nextDeadline(await leagueDeadlines(ctx, w.leagueId), Date.now())!.at);

describe("the waiver cron", () => {
  test("looks at a league once its work is done, then not again until its next run time or deadline", async () => {
    // The league's window shut at gameweek 4's deadline, so its free agents go back on waivers,
    // and the cron looks again on its next pass, as it always did.
    expect(await waiverPass()).toEqual([w.leagueId]);
    const [back] = await pendingJobs(w.t, internal.waivers.backOnWaivers.putBackOnWaivers);
    await w.t.mutation(internal.waivers.backOnWaivers.putBackOnWaivers, back.args[0] as { leagueId: Id<"leagues">; deadline: number });
    vi.setSystemTime(Date.now() + WAIVER_CHECK_EVERY.minutes * MINUTE_MS);
    expect(await waiverPass()).toEqual([w.leagueId]);

    const expected = Math.min(firstRunFrom(FIRST_RULES.waivers.runs, Date.now() + 1)!, await nextDeadlineAt());
    expect((await row())?.waiversAt).toBe(expected);

    // A pass before then reads no league.
    expect(await waiverPass()).toEqual([]);
  });

  test("a rules save wakes the league for the next pass", async () => {
    await waiverPass();
    await changeRules(w.t, w.leagueId, rulesWith({ waivers: { ...HELD_FIRST_RULES.waivers, runs: [{ day: "monday", hour: 9, minute: 0 }] } }));
    expect(await waiverPass()).toEqual([w.leagueId]);
  });

  test("the first pass after the release, with no row kept, looks at every league", async () => {
    await w.t.run(async (ctx) => {
      for (const { _id } of await ctx.db.query("leagueChecks").collect()) await ctx.db.delete("leagueChecks", _id);
    });
    expect(await waiverPass()).toEqual([w.leagueId]);
  });

  test("a moved kickoff wakes every league", async () => {
    await waiverPass();
    const kickoff = await w.t.run(async (ctx) => (await ctx.db.query("fixtures").collect()).find(({ code }) => code === NEXT + 1)!);
    const { _id, _creationTime, ...sent } = kickoff;
    await w.t.mutation(internal.football.footballSync.upsertFixtures, { rows: [{ ...sent, kickoff: kickoff.kickoff! - MINUTE_MS }] });
    expect(await waiverPass()).toEqual([w.leagueId]);
  });
});

describe("the trade cron", () => {
  test("leaves a league with no open offer alone until one is made", async () => {
    await offerPass();
    expect((await row())?.offersAt).toBe(NEVER_DUE);
    expect(await offerPass()).toEqual([]);

    await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    expect(await offerPass()).toEqual([w.leagueId]);
  });

  test("looks at an open offer's league only once the coming deadline passes, and closes it then", async () => {
    await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await offerPass();
    expect((await row())?.offersAt).toBe(await nextDeadlineAt());
    expect(await offerPass()).toEqual([]);
    expect(await w.offers()).toHaveLength(1);

    await w.gameweekEnds(NEXT);
    await offerPass();
    expect(await w.offers()).toEqual([]);
    expect(await w.subjectsTo(BOB)).toContainEqual(expect.stringContaining("closed"));
  });
});
