import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { heldSchedule, RULES_CHANGES_MOST, rulesRefusals } from "../../../convex/rules/leagueRules";
import { CURRENT_FIXTURES_MOST } from "../../../convex/shared/fixtures";
import { FIRST_GAMEWEEK } from "../../../convex/gameweeks/usedGameweeks";
import { expectRefused, holdGameweeks, rulesRevision, rulesWith, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { actingAs, adminCreatesLeague, COMMISSIONER, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The league's rules reads each have a named cap (#214): past it they throw, never cut short.

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: 9 });
  leagueId = await adminCreatesLeague(t);
});

const change = async (rules = TOTAL_POINTS) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules, revision: await rulesRevision(t, leagueId) });
const latest = async () => (await actingAs(t, COMMISSIONER)).query(api.rules.leagueRules.latest, { leagueId });
const rulesRows = () =>
  t.run(async (ctx) => (await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect()).length);

/** Brings the league's rules rows up to `count`, written straight in, each the first rules. */
const holdRulesRows = (count: number) =>
  t.run(async (ctx) => {
    const held = (await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect()).length;
    for (let row = held; row < count; row += 1) await ctx.db.insert("leagueRules", { leagueId, fromGameweek: FIRST_GAMEWEEK, rules: rulesWith({}) });
  });

/** Writing RULES_CHANGES_MOST rows of the whole rules is slow in convex-test, so one test walks
 *  up to the cap and past it. */
const ROWS_TO_THE_CAP = { timeout: 30_000 };

test(`a league's rules rows: a change up to ${RULES_CHANGES_MOST} is saved, one more is refused, and more held throws when read`, ROWS_TO_THE_CAP, async () => {
  await holdRulesRows(RULES_CHANGES_MOST - 1);
  await change();
  expect(await rulesRows()).toBe(RULES_CHANGES_MOST);
  expect((await latest())?.rules).toEqual(TOTAL_POINTS);

  await expectRefused(change(rulesWith({})), rulesRefusals.tooManyChanges);
  expect(await rulesRows()).toBe(RULES_CHANGES_MOST);

  // Only a row written by hand can pass the most; reading the rules in force from a cut list would
  // read the wrong ones.
  await holdRulesRows(RULES_CHANGES_MOST + 1);
  await expect(latest()).rejects.toThrow(`more than ${RULES_CHANGES_MOST} rules rows`);
});

describe("the held schedule", () => {
  /** Holds `count` more current matches, in gameweek 1, beyond holdGameweeks' 38. */
  const holdMoreFixtures = (count: number) =>
    t.run(async (ctx) => {
      for (let index = 0; index < count; index += 1) {
        await ctx.db.insert("fixtures", { code: 1000 + index, gameweek: FIRST_GAMEWEEK, homeClubCode: 1, awayClubCode: 2, kickoff: null });
      }
    });
  const schedule = () => t.run((ctx) => heldSchedule(ctx));

  test("reads only the current matches, a dropped one left out", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("fixtures", { code: 999, gameweek: FIRST_GAMEWEEK, homeClubCode: 1, awayClubCode: 2, kickoff: 0, droppedAt: 1 });
    });

    const { matches } = await schedule();
    expect(matches).toHaveLength(38);
    expect(matches).not.toContainEqual({ gameweek: FIRST_GAMEWEEK, kickoff: 0 });
  });

  test(`reads ${CURRENT_FIXTURES_MOST} current matches, and throws past them rather than cut the schedule short`, async () => {
    await holdMoreFixtures(CURRENT_FIXTURES_MOST - 38);
    expect((await schedule()).matches).toHaveLength(CURRENT_FIXTURES_MOST);

    await holdMoreFixtures(1);
    await expect(schedule()).rejects.toThrow(`More than ${CURRENT_FIXTURES_MOST} matches are held as current`);
  });

  test("dropped matches past the most don't count against it", async () => {
    await t.run(async (ctx) => {
      for (let index = 0; index < CURRENT_FIXTURES_MOST; index += 1) {
        await ctx.db.insert("fixtures", { code: 2000 + index, gameweek: FIRST_GAMEWEEK, homeClubCode: 1, awayClubCode: 2, kickoff: 0, droppedAt: 1 });
      }
    });

    expect((await schedule()).matches).toHaveLength(38);
  });
});
