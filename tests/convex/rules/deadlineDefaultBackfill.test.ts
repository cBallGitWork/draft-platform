import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { leagueDeadlines } from "../../../convex/gameweeks/leagueDeadlines";
import { HOUR_MS, MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { changeEveryRules, giveDeadlineRule, holdGameweeks, KICKS_OFF_IN, NEXT, rulesInGameweek } from "../../support/convex/leagueRules.harness";
import { adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// #1412: a new league's deadline is 15 minutes before the gameweek's first kickoff (S03.3, S05.20),
// not FPL's 90, and the migration moves the alpha leagues made with 90 to 15, keeping a deadline
// already passed where it fell (S05.25).

/** When gameweek NEXT's one match kicks off: KICKS_OFF_IN from the deployment's morning. */
let kickoff: number;
let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  kickoff = Date.now() + KICKS_OFF_IN;
  await holdGameweeks(t, { next: NEXT });
});

const minutesOf = async (leagueId: Id<"leagues">, gameweek: number) =>
  (await t.run((ctx) => rulesInGameweek(ctx, leagueId, gameweek))).deadline.minutesBeforeFirstKickoff;
const deadlinesOf = async (leagueId: Id<"leagues">) => new Map(await t.run(async (ctx) => [...(await leagueDeadlines(ctx, leagueId))]));
const migrate = () => t.mutation(internal.rules.deadlineDefaultBackfill.moveDeadlinesToDefault, {});

/** A league as the old default made it: every rules row, and the admin's defaults, on 90. */
async function alphaLeague(): Promise<Id<"leagues">> {
  const leagueId = await adminCreatesLeague(t);
  const onNinety = <Rules extends { deadline: { minutesBeforeFirstKickoff: number } }>(rules: Rules): Rules => ({
    ...rules,
    deadline: { minutesBeforeFirstKickoff: 90 },
  });
  await changeEveryRules(t, leagueId, onNinety);
  await t.run(async (ctx) => {
    const row = (await ctx.db.query("defaultLeagueRules").unique())!;
    await ctx.db.patch("defaultLeagueRules", row._id, { rules: onNinety(row.rules) });
  });
  return leagueId;
}

test("a new league's deadline is 15 minutes before the gameweek's first kickoff", async () => {
  const leagueId = await adminCreatesLeague(t);

  expect(await minutesOf(leagueId, NEXT)).toBe(15);
  expect((await deadlinesOf(leagueId)).get(NEXT)).toBe(kickoff - 15 * MINUTE_MS);
});

test("an alpha league on 90 moves to 15, keeping the deadline that passed under 90 where it fell", async () => {
  const leagueId = await alphaLeague();
  // An hour before gameweek NEXT's kickoff: its deadline under 90 passed half an hour ago, and no
  // sync has recorded it yet.
  vi.setSystemTime(kickoff - HOUR_MS);

  expect(await migrate()).toEqual({ rowsMoved: 1, defaultsMoved: true });

  expect(await minutesOf(leagueId, NEXT + 1)).toBe(15);
  const deadlines = await deadlinesOf(leagueId);
  expect(deadlines.get(NEXT)).toBe(kickoff - 90 * MINUTE_MS);
  expect(deadlines.get(NEXT + 1)).toBe(kickoff + WEEK_MS - 15 * MINUTE_MS);
});

test("the admin's defaults move too, so the next league made gets 15", async () => {
  await alphaLeague();
  await migrate();

  expect(await minutesOf(await adminCreatesLeague(t, undefined, "Next League"), NEXT)).toBe(15);
});

test("a league whose commissioner chose another time keeps it, and running it again moves nothing", async () => {
  const alpha = await alphaLeague();
  const chosen = await adminCreatesLeague(t, undefined, "Chosen League");
  await giveDeadlineRule(t, chosen, 60);
  await migrate();

  expect(await migrate()).toEqual({ rowsMoved: 0, defaultsMoved: false });
  expect(await minutesOf(chosen, NEXT)).toBe(60);
  expect(await minutesOf(alpha, NEXT)).toBe(15);
});
