import { beforeEach, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { changeEveryRules, changeRulesTo, holdGameweeks, NEXT, REORDERED_TIE_BREAKS, rulesIn, rulesRevision } from "../../support/convex/leagueRules.harness";
import { actingAs, adminCreatesLeague, COMMISSIONER, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { everyJobRuns, ROWS_TO_THE_CAP, silenceConsoleError } from "../../support/convex/test.harness";
import { rulesRefusals } from "../../../convex/rules/leagueRules";
import { RULES_CHANGES_MOST } from "../../../convex/rules/rulesHistory";
import { FIRST_GAMEWEEK } from "../../../convex/gameweeks/usedGameweeks";

// #2266 (S03.2; Craig, 15 Nov 2026, on #1034): every league has all three tie-breaks, in its own
// order. A league saved with one keeps it first, the other two after it, from the next gameweek, so
// a gameweek already begun keeps the rules it had.

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
});

/** Runs the one-off, then each league's change it schedules. */
const migrate = async () => {
  const result = await t.mutation(internal.migrations.everyTieBreak.addEveryTieBreak, {});
  await everyJobRuns(t);
  return result;
};
const rulesRowCount = () => t.run(async (ctx) => (await ctx.db.query("leagueRules").collect()).length);
const tieBreaksIn = async (leagueId: Id<"leagues">, gameweek: number) => (await rulesIn(t, leagueId, gameweek)).tieBreaks;

/** A league, and the admin's defaults, saved when a league held one tie-break: `kept`. */
async function oneTieBreakLeague(kept: LeagueRules["tieBreaks"][number]): Promise<Id<"leagues">> {
  const leagueId = await adminCreatesLeague(t);
  const onOne = (rules: LeagueRules): LeagueRules => ({ ...rules, tieBreaks: [kept] });
  await changeEveryRules(t, leagueId, onOne);
  await t.run(async (ctx) => {
    const row = (await ctx.db.query("defaultLeagueRules").unique())!;
    await ctx.db.patch("defaultLeagueRules", row._id, { rules: { ...row.rules, tieBreaks: [kept] } });
  });
  return leagueId;
}

test("S03.8a new league has Points for, Head-to-head and Points against, in that order", async () => {
  const leagueId = await adminCreatesLeague(t);

  expect(await tieBreaksIn(leagueId, NEXT)).toEqual(["pointsFor", "headToHead", "pointsAgainst"]);
});

test("S03.8a league saved with one tie-break keeps it first, the other two added from the next gameweek", async () => {
  const leagueId = await oneTieBreakLeague("headToHead");

  expect(await migrate()).toEqual({ defaultsChanged: true });
  expect(await tieBreaksIn(leagueId, NEXT - 1)).toEqual(["headToHead"]);
  expect(await tieBreaksIn(leagueId, NEXT)).toEqual(["headToHead", "pointsFor", "pointsAgainst"]);
});

test("S03.8the admin's defaults get all three, so the next league made has them", async () => {
  await oneTieBreakLeague("pointsAgainst");
  await migrate();

  expect(await tieBreaksIn(await adminCreatesLeague(t, undefined, "Next League"), NEXT)).toEqual(["pointsAgainst", "pointsFor", "headToHead"]);
});

test("S03.8before the one-off runs, a league made from defaults with one tie-break gets all three", async () => {
  await oneTieBreakLeague("headToHead");

  expect(await tieBreaksIn(await adminCreatesLeague(t, undefined, "Next League"), 1)).toEqual(["headToHead", "pointsFor", "pointsAgainst"]);
});

test("S03.8before the one-off runs, League settings shows all three, and a save adds them from the next gameweek", async () => {
  const leagueId = await oneTieBreakLeague("pointsAgainst");
  const commissioner = await actingAs(t, COMMISSIONER);
  const { part } = await commissioner.query(api.rules.leagueSettings.settings, { leagueId });

  expect(part.tieBreaks).toEqual(["pointsAgainst", "pointsFor", "headToHead"]);
  await commissioner.mutation(api.rules.leagueSettings.changeSettings, { leagueId, settings: part, revision: await rulesRevision(t, leagueId) });
  expect(await tieBreaksIn(leagueId, NEXT - 1)).toEqual(["pointsAgainst"]);
  expect(await tieBreaksIn(leagueId, NEXT)).toEqual(["pointsAgainst", "pointsFor", "headToHead"]);
});

test("S03.8before the one-off runs, a save of another part, the draft's pick time, is not refused and adds them from the next gameweek", async () => {
  const leagueId = await oneTieBreakLeague("pointsAgainst");

  await (await actingAs(t, COMMISSIONER)).mutation(api.draft.draftCommissioner.setPickTime, { leagueId, pickSeconds: 60 });
  expect(await tieBreaksIn(leagueId, NEXT - 1)).toEqual(["pointsAgainst"]);
  expect(await tieBreaksIn(leagueId, NEXT)).toEqual(["pointsAgainst", "pointsFor", "headToHead"]);
  expect((await rulesIn(t, leagueId, NEXT)).draft?.pickSeconds).toBe(60);
});

test("S03.8a league with all three keeps its order, and running it again changes nothing", async () => {
  const one = await oneTieBreakLeague("pointsFor");
  const three = await adminCreatesLeague(t, undefined, "Three League");
  await changeRulesTo(t, three, { tieBreaks: REORDERED_TIE_BREAKS });

  expect(await migrate()).toEqual({ defaultsChanged: true });
  const rowsAfterOne = await rulesRowCount();
  expect(await migrate()).toEqual({ defaultsChanged: false });
  expect(await rulesRowCount()).toBe(rowsAfterOne);
  expect(await tieBreaksIn(three, NEXT)).toEqual(REORDERED_TIE_BREAKS);
  expect(await tieBreaksIn(one, NEXT)).toEqual(["pointsFor", "headToHead", "pointsAgainst"]);
});

test("S03.8a league already holding the most rules changes keeps its own, and every other league still gets all three", ROWS_TO_THE_CAP, async () => {
  const full = await oneTieBreakLeague("headToHead");
  const other = await adminCreatesLeague(t, undefined, "Other League");
  await changeEveryRules(t, other, (rules) => ({ ...rules, tieBreaks: ["pointsAgainst"] }));
  await t.run(async (ctx) => {
    const held = (await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", full)).collect()).length;
    for (let row = held; row < RULES_CHANGES_MOST; row += 1) {
      await ctx.db.insert("leagueRules", { leagueId: full, fromGameweek: FIRST_GAMEWEEK, changes: { tieBreaks: ["headToHead"] } });
    }
  });

  const logged = silenceConsoleError();

  expect(await migrate()).toEqual({ defaultsChanged: true });
  expect(String(logged.mock.calls.flat())).toContain(`League ${full}: ${rulesRefusals.tooManyChanges}`);
  expect(await tieBreaksIn(full, NEXT)).toEqual(["headToHead"]);
  expect(await tieBreaksIn(other, NEXT)).toEqual(["pointsAgainst", "pointsFor", "headToHead"]);
});
