import { beforeEach, expect, test } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { changeRules, HELD_FIRST_RULES, holdGameweeks, latestRules, rulesIn, rulesWith } from "../../support/convex/leagueRules.harness";
import { adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// A save of the rules stores only what it changed (#1617; Craig, 11 Nov 2026: "a save stores only
// what changed"), so a league's history doesn't copy the formations and classics with each change,
// and reads as the whole rules in force in each gameweek all the same.

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: 9 });
  leagueId = await adminCreatesLeague(t);
});

const rulesRows = () =>
  t.run((ctx) => ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect());

const LATER_WAIVERS = { ...HELD_FIRST_RULES.waivers, runs: [{ day: "wednesday" as const, hour: 11, minute: 30 }] };

test("a league's first rules are stored whole, and a change of a waiver time stores only the waivers", async () => {
  await changeRules(t, leagueId, rulesWith({ waivers: LATER_WAIVERS }));

  const [first, changed] = await rulesRows();
  expect(first.rules).toBeDefined();
  expect(changed.rules).toBeUndefined();
  expect(changed.changes).toEqual({ waivers: LATER_WAIVERS });
  expect((await latestRules(t, leagueId))?.rules).toEqual(rulesWith({ waivers: LATER_WAIVERS }));
  expect(await rulesIn(t, leagueId, 8)).toEqual(HELD_FIRST_RULES);
});

test("a change stored on top of another reads as the whole rules, each on the one before", async () => {
  await changeRules(t, leagueId, rulesWith({ waivers: LATER_WAIVERS }));
  await changeRules(t, leagueId, rulesWith({ waivers: LATER_WAIVERS, tieBreaks: ["headToHead"] }));

  expect((await rulesRows()).map((row) => row.changes)).toEqual([undefined, { waivers: LATER_WAIVERS }, { tieBreaks: ["headToHead"] }]);
  expect(await rulesIn(t, leagueId, 8)).toEqual(HELD_FIRST_RULES);
  expect(await rulesIn(t, leagueId, 9)).toEqual(rulesWith({ waivers: LATER_WAIVERS, tieBreaks: ["headToHead"] }));
});

test("a change leaving a part out is stored whole, as a part a row lacks reads as the row before's", async () => {
  const { classics: _classics, ...withoutClassics } = rulesWith({ format: "totalPoints" });
  await changeRules(t, leagueId, withoutClassics);

  const changed = (await rulesRows()).at(-1)!;
  expect(changed.changes).toBeUndefined();
  expect(changed.rules).toEqual(withoutClassics);
  expect(await rulesIn(t, leagueId, 9)).toEqual(withoutClassics);
});
