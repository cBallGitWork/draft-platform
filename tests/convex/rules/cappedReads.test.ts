import { beforeEach, describe, expect, test } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { QueryCtx } from "../../../convex/_generated/server";
import { rulesRefusals } from "../../../convex/rules/leagueRules";
import { RULES_CHANGES_MOST } from "../../../convex/rules/rulesHistory";
import { heldSchedule } from "../../../convex/gameweeks/leagueDeadlines";
import { CURRENT_FIXTURES_MOST } from "../../../convex/shared/fixtures";
import { FIRST_GAMEWEEK, GAMEWEEKS_MOST, seasonGameweeks } from "../../../convex/gameweeks/usedGameweeks";
import { gameweekStartsOf } from "../../../convex/gameweeks/gameweekStarts";
import { fixedDeadlinesOf, passedDeadlinesOf } from "../../../convex/gameweeks/passedDeadlines";
import { ROUNDS_READ_MOST, roundStartsOf } from "../../../convex/gameweeks/roundStarts";
import { seasonRules } from "../../../convex/rules/rulesHistory";
import { seasonStartYear } from "../../../convex/shared/time";
import { scheduleOf } from "../../../convex/table/playedFixtures";
import { PL_GAMEWEEKS } from "../../support/convex/footballRows.harness";
import { changeRules, holdGameweeks, holdGameweeksPastTheSeason, latestRules, rulesWith, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { expectRefused, ROWS_TO_THE_CAP } from "../../support/convex/test.harness";
import { adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
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
  expect((await latestRules(t, leagueId))?.rules).toEqual(TOTAL_POINTS);

  await expectRefused(change(rulesWith({})), rulesRefusals.tooManyChanges);
  expect(await rulesRows()).toBe(RULES_CHANGES_MOST);

  // Only a row written by hand can pass the most; reading the rules in force from a cut list would
  // read the wrong ones.
  await holdRulesRows(RULES_CHANGES_MOST + 1);
  await expect(latestRules(t, leagueId)).rejects.toThrow(`more than ${RULES_CHANGES_MOST} rules rows`);
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
    expect(matches).toHaveLength(PL_GAMEWEEKS);
    expect(matches).not.toContainEqual({ gameweek: FIRST_GAMEWEEK, kickoff: 0 });
  });

  test(`reads ${CURRENT_FIXTURES_MOST} current matches, and throws past them rather than cut the schedule short`, async () => {
    await holdMoreFixtures(CURRENT_FIXTURES_MOST - PL_GAMEWEEKS, 1000);
    expect((await schedule()).matches).toHaveLength(CURRENT_FIXTURES_MOST);

    await holdMoreFixtures(1, 2000);
    await expect(schedule()).rejects.toThrow(`More than ${CURRENT_FIXTURES_MOST} matches are held as current`);
  });

  test(`reads the season's ${PL_GAMEWEEKS} gameweeks, a dropped one kept (#202), and throws past ${GAMEWEEKS_MOST} rather than cut the schedule short`, async () => {
    await t.run(async (ctx) => {
      const first = await ctx.db.query("gameweeks").withIndex("by_season_and_number", (q) => q.eq("season", undefined).eq("number", FIRST_GAMEWEEK)).unique();
      await ctx.db.patch("gameweeks", first!._id, { droppedAt: DROPPED_AT });
    });
    const { gameweeks } = await schedule();
    expect(gameweeks).toHaveLength(PL_GAMEWEEKS);
    expect(gameweeks).toContainEqual({ number: FIRST_GAMEWEEK });

    // More rows than any season holds can only be written by hand: the read throws.
    await holdGameweeksPastTheSeason(t, GAMEWEEKS_MOST - PL_GAMEWEEKS + 1);
    await expect(schedule()).rejects.toThrow(`More than ${GAMEWEEKS_MOST} gameweek rows are held for one season`);
  });

  test("reads a gameweek past the Premier League's 38 as one of the season's, so it never stops the read (#872, #1618)", async () => {
    await holdGameweeksPastTheSeason(t, 2);
    expect((await schedule()).gameweeks).toEqual(seasonGameweeks(PL_GAMEWEEKS + 2).map((number) => ({ number })));
  });

  test("dropped matches past the most don't count against it", async () => {
    await holdMoreFixtures(CURRENT_FIXTURES_MOST, 1000, DROPPED_AT);

    expect((await schedule()).matches).toHaveLength(PL_GAMEWEEKS);
  });
});

describe("a read of one row a gameweek throws past its cap rather than drop the latest gameweeks (#1739)", () => {
  const OVER_THE_CAP = GAMEWEEKS_MOST + 1;
  /** The numbers 1 to `count`: one row each, as a bug writing rows by hand might leave them. */
  const numbersTo = (count: number) => Array.from({ length: count }, (_, index) => FIRST_GAMEWEEK + index);
  const NO_GAMES = { fixtures: [], byes: [] };
  const KICKOFF = 0;
  const SEASON = seasonStartYear(KICKOFF);

  const schedule = () =>
    t.run(async (ctx) => {
      await scheduleOf(ctx, (await ctx.db.get("leagues", leagueId))!, await seasonRules(ctx, leagueId));
    });

  test(`the stored fixtures: past ${GAMEWEEKS_MOST} gameweeks`, async () => {
    await t.run(async (ctx) => {
      for (const gameweek of numbersTo(OVER_THE_CAP)) await ctx.db.insert("playedFixtures", { leagueId, gameweek, ...NO_GAMES, storedAt: 0 });
    });
    await expect(schedule()).rejects.toThrow(`More than ${GAMEWEEKS_MOST} stored gameweeks are held for one league`);
  });

  test(`the fixture edits: past ${GAMEWEEKS_MOST} gameweeks`, async () => {
    await t.run(async (ctx) => {
      for (const gameweek of numbersTo(OVER_THE_CAP)) {
        await ctx.db.insert("fixtureEdits", { leagueId, gameweek, ...NO_GAMES, drawn: NO_GAMES, editedAt: 0 });
      }
    });
    await expect(schedule()).rejects.toThrow(`More than ${GAMEWEEKS_MOST} fixture edit rows are held for one league`);
  });

  test(`the passed deadlines: past ${GAMEWEEKS_MOST} gameweeks`, async () => {
    await t.run(async (ctx) => {
      for (const gameweek of numbersTo(OVER_THE_CAP)) await ctx.db.insert("passedDeadlines", { leagueId, gameweek, deadline: 0, recordedAt: 0 });
    });
    await expect(t.run((ctx) => passedDeadlinesOf(ctx, leagueId).then(() => undefined))).rejects.toThrow(
      `More than ${GAMEWEEKS_MOST} passed deadlines are held for one league`,
    );
  });

  test(`the kept deadlines: past ${GAMEWEEKS_MOST} gameweeks`, async () => {
    await t.run(async (ctx) => {
      for (const gameweek of numbersTo(OVER_THE_CAP)) await ctx.db.insert("keptDeadlines", { leagueId, gameweek, deadline: 0, keptAt: 0 });
    });
    await expect(t.run((ctx) => fixedDeadlinesOf(ctx, leagueId).then(() => undefined))).rejects.toThrow(
      `More than ${GAMEWEEKS_MOST} kept deadlines are held for one league`,
    );
  });

  test(`the gameweek starts: past ${GAMEWEEKS_MOST} gameweeks`, async () => {
    await t.run(async (ctx) => {
      for (const gameweek of numbersTo(OVER_THE_CAP)) await ctx.db.insert("gameweekStarts", { season: SEASON, gameweek, firstKickoff: KICKOFF, recordedAt: 0 });
    });
    const matches = [{ gameweek: FIRST_GAMEWEEK, kickoff: KICKOFF }];
    await expect(t.run((ctx) => gameweekStartsOf(ctx, matches).then(() => undefined))).rejects.toThrow(
      `More than ${GAMEWEEKS_MOST} gameweek starts are held for one season`,
    );
  });

  test(`the round starts: past ${ROUNDS_READ_MOST} rounds`, async () => {
    await t.run(async (ctx) => {
      for (const round of numbersTo(ROUNDS_READ_MOST + 1)) await ctx.db.insert("roundStarts", { season: SEASON, round, firstKickoff: KICKOFF, recordedAt: 0 });
    });
    await expect(t.run((ctx) => roundStartsOf(ctx, SEASON).then(() => undefined))).rejects.toThrow(
      `More than ${ROUNDS_READ_MOST} round starts are held for one season`,
    );
  });
});
