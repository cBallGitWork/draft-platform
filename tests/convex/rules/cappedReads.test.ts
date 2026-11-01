import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { QueryCtx } from "../../../convex/_generated/server";
import { rulesRefusals } from "../../../convex/rules/leagueRules";
import { RULES_CHANGES_MOST } from "../../../convex/rules/rulesHistory";
import { heldSchedule } from "../../../convex/gameweeks/leagueDeadlines";
import { CURRENT_FIXTURES_MOST } from "../../../convex/shared/fixtures";
import { FIRST_GAMEWEEK, GAMEWEEKS, SEASON_GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { changeRules, holdGameweeks, holdGameweeksPastTheSeason, rulesWith, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { expectRefused, ROWS_TO_THE_CAP } from "../../support/convex/test.harness";
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

const change = (rules = TOTAL_POINTS) => changeRules(t, leagueId, rules);
const latest = async () => (await actingAs(t, COMMISSIONER)).query(api.rules.leagueRules.latest, { leagueId });
const countRulesRows = async (ctx: QueryCtx) =>
  (await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect()).length;
const rulesRows = () => t.run(countRulesRows);

/** Brings the league's rules rows up to `count`, written straight in, each the first rules. */
const holdRulesRows = (count: number) =>
  t.run(async (ctx) => {
    for (let row = await countRulesRows(ctx); row < count; row += 1) {
      await ctx.db.insert("leagueRules", { leagueId, fromGameweek: FIRST_GAMEWEEK, rules: rulesWith({}) });
    }
  });

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
  /** Holds `count` more matches in gameweek 1, beyond holdGameweeks' one a gameweek, their codes
   *  from `firstCode`; dropped when `droppedAt` is given. */
  const holdMoreFixtures = (count: number, firstCode: number, droppedAt?: number) =>
    t.run(async (ctx) => {
      for (let index = 0; index < count; index += 1) {
        await ctx.db.insert("fixtures", { code: firstCode + index, gameweek: FIRST_GAMEWEEK, homeClubCode: 1, awayClubCode: 2, kickoff: 0, droppedAt });
      }
    });
  const schedule = () => t.run((ctx) => heldSchedule(ctx));
  const DROPPED_AT = 1;

  test("reads only the current matches, a dropped one left out", async () => {
    await holdMoreFixtures(1, 1000, DROPPED_AT);

    const { matches } = await schedule();
    expect(matches).toHaveLength(GAMEWEEKS);
    expect(matches).not.toContainEqual({ gameweek: FIRST_GAMEWEEK, kickoff: 0 });
  });

  test(`reads ${CURRENT_FIXTURES_MOST} current matches, and throws past them rather than cut the schedule short`, async () => {
    await holdMoreFixtures(CURRENT_FIXTURES_MOST - GAMEWEEKS, 1000);
    expect((await schedule()).matches).toHaveLength(CURRENT_FIXTURES_MOST);

    await holdMoreFixtures(1, 2000);
    await expect(schedule()).rejects.toThrow(`More than ${CURRENT_FIXTURES_MOST} matches are held as current`);
  });

  test(`reads the season's ${GAMEWEEKS} gameweeks, a dropped one kept (#202), and throws past them rather than cut the schedule short`, async () => {
    await t.run(async (ctx) => {
      const first = await ctx.db.query("gameweeks").withIndex("by_number", (q) => q.eq("number", FIRST_GAMEWEEK)).unique();
      await ctx.db.patch("gameweeks", first!._id, { droppedAt: DROPPED_AT });
    });
    const { gameweeks } = await schedule();
    expect(gameweeks).toHaveLength(GAMEWEEKS);
    expect(gameweeks).toContainEqual({ number: FIRST_GAMEWEEK });

    // Only a row written by hand can pass the football sync's one a gameweek number: a second row
    // for one of the season's gameweeks throws.
    await t.run((ctx) => ctx.db.insert("gameweeks", { number: FIRST_GAMEWEEK + 1, deadline: 0 }));
    await expect(schedule()).rejects.toThrow(`More than ${GAMEWEEKS} gameweek rows are held for gameweeks ${FIRST_GAMEWEEK} to ${GAMEWEEKS}`);
  });

  test(`reads none past the season's ${GAMEWEEKS} gameweeks, so a row written past them never stops it (#872)`, async () => {
    await holdGameweeksPastTheSeason(t, 2);
    expect((await schedule()).gameweeks).toEqual(SEASON_GAMEWEEKS.map((number) => ({ number })));
  });

  test("dropped matches past the most don't count against it", async () => {
    await holdMoreFixtures(CURRENT_FIXTURES_MOST, 1000, DROPPED_AT);

    expect((await schedule()).matches).toHaveLength(GAMEWEEKS);
  });
});
