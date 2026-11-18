import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { nextDeadline } from "../../../convex/gameweeks/deadline";
import { leagueDeadlines } from "../../../convex/gameweeks/leagueDeadlines";
import { E2E_FUNCTIONS_SETTING } from "../../../convex/outbound/deploymentSettings";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { latestRunAt } from "../../../convex/waivers/waiverTimes";
import { ANN } from "../../support/convex/leagues.harness";
import { pendingJobs } from "../../support/convex/test.harness";
import { ANNS_FIRST_DROP, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";
import { NEXT } from "../../support/convex/waivers.harness";

// "Run this timed job now" (spec/20, S20.17; #2288): an e2e run's server has its timed jobs off, so
// a test runs one through the job's own entry point, as at a time past the one it wants passed,
// while the server's clock stays where it is.

let w: TradeLeague;
/** When the league's next deadline, gameweek NEXT's, falls. */
let deadline: number;

beforeEach(async () => {
  w = await tradeLeague();
  vi.stubEnv(E2E_FUNCTIONS_SETTING, "on");
  deadline = await w.t.run(async (ctx) => nextDeadline(await leagueDeadlines(ctx, w.leagueId), Date.now())!.at);
});

const runJobNow = (job: "deadlines" | "waivers" | "offers", now?: number) =>
  w.t.mutation(internal.e2e.runJobNow.runJobNow, { job, leagueId: w.leagueId, now });
/** The gameweeks whose deadlines the league has recorded as passed. */
const passedGameweeks = () =>
  w.t.run(async (ctx) => (await ctx.db.query("passedDeadlines").collect()).filter(({ leagueId }) => leagueId === w.leagueId).map(({ gameweek }) => gameweek));

test("S20.17: without the test-only setting, running a job refuses and records nothing", async () => {
  vi.stubEnv(E2E_FUNCTIONS_SETTING, "");
  const before = await passedGameweeks();
  await expect(runJobNow("deadlines", deadline)).rejects.toThrow(`${E2E_FUNCTIONS_SETTING} isn't set`);
  expect(await passedGameweeks()).toEqual(before);
});

test("S20.17: the deadlines job records a deadline passed as at the time given, the clock where it was", async () => {
  await runJobNow("deadlines");
  expect(await passedGameweeks()).not.toContain(NEXT);

  await runJobNow("deadlines", deadline);
  expect(await passedGameweeks()).toContain(NEXT);
  expect(Date.now()).toBeLessThan(deadline);
});

test("S20.17: the offers job closes an offer unanswered at the deadline, as at a time past it", async () => {
  await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
  await runJobNow("offers");
  expect(await w.offers()).toHaveLength(1);

  await runJobNow("offers", deadline + MINUTE_MS);
  expect(await w.offers()).toEqual([]);
});

test("S20.17: the waivers job starts the league's run, as at a time past its run time", async () => {
  for (const gameweek of [NEXT, NEXT + 1]) await w.matchIs(gameweek, "fullTime");
  const runTime = latestRunAt(FIRST_RULES.waivers.runs, Date.now() + WEEK_MS)!;
  await runJobNow("waivers");
  expect(await pendingJobs(w.t, internal.waivers.waiverRunRetries.runWithRetries)).toEqual([]);

  await runJobNow("waivers", runTime + 2 * MINUTE_MS);
  const [running] = await pendingJobs(w.t, internal.waivers.waiverRunRetries.runWithRetries);
  expect(running.args[0]).toMatchObject({ leagueId: w.leagueId, at: runTime });
  await w.t.action(internal.waivers.waiverRunRetries.runWithRetries, running.args[0] as { leagueId: Id<"leagues">; at: number; backFrom: number | null });
  expect(await w.t.run(async (ctx) => (await ctx.db.query("waiverOrders").unique())?.ranAt)).toBe(runTime);
});
