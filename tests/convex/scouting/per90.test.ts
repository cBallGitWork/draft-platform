import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { mainArea, per90Stats, percentileOf, RANKED_MINUTES } from "../../../convex/scouting/per90Figures";
import { MANAGERS, actingAs, type TestConvex, ANN } from "../../support/convex/leagues.harness";
import { ARSENAL, CHELSEA, ODEGAARD, PALMER, RICE, SAKA, insertPlayers } from "../../support/convex/footballRows.harness";
import { holdSeasonTotals, scoutingLeague } from "../../support/convex/scouting.harness";
import { refusals } from "../../../convex/shared/leagueAccess";
import { expectRefused } from "../../support/convex/test.harness";

// The selected player's per-90 figures on Scouting (#1028; Craig, 9 Nov 2026, on #1028): his
// area's stats per 90 over the season, with his percentile among his area's players of 270+
// minutes, a winger and an attacking midfielder alike.

const RAYA = { code: 1006, name: "Raya", fullName: "David Raya", clubCode: ARSENAL.code, positions: ["GK" as const] };

let t: TestConvex;
let leagueId: Id<"leagues">;
// Saka (W) and Palmer (CAM) are attacking midfield with 900 minutes each, Ødegaard too with only
// 180, Rice a defensive midfielder with many goals, Raya a keeper.
beforeEach(async () => {
  ({ t, leagueId } = await scoutingLeague([SAKA, PALMER, ODEGAARD, RAYA, RICE]));
  await t.run(async (ctx) => {
    await holdSeasonTotals(ctx, SAKA.code, { minutes: 900, goals_scored: 5, assists: 2, total_att_assist: 20 });
    await holdSeasonTotals(ctx, PALMER.code, { minutes: 900, goals_scored: 10, assists: 4, total_att_assist: 30 });
    await holdSeasonTotals(ctx, ODEGAARD.code, { minutes: 180, goals_scored: 4 });
    await holdSeasonTotals(ctx, RICE.code, { minutes: 900, goals_scored: 20 });
    await holdSeasonTotals(ctx, RAYA.code, { minutes: 900, saves: 30 });
  });
});

const figuresOf = async (playerCode: number, stat: string | null = null) =>
  (await actingAs(t, ANN)).query(api.scouting.per90.figures, { leagueId, playerCode, stat });
const figureOf = async (playerCode: number, stat: string, picked: string | null = null) =>
  (await figuresOf(playerCode, picked)).figures.find((each) => each.stat === stat);

test("an attacking midfielder's six per 90, ranked among his area's players of 270+ minutes, wingers included", async () => {
  const palmer = await figuresOf(PALMER.code);
  expect(palmer.area).toBe("attackingMidfield");
  expect(palmer.ranked).toBe(true);
  expect(palmer.figures.map(({ stat }) => stat)).toEqual(["goals_scored", "assists", "total_att_assist", "ontarget_scoring_att", "big_chance_created", "won_tackle"]);
  // 10 goals in 900 minutes is 1 a match; Saka's 0.5 is below, Rice (another area) and Ødegaard (180 minutes) aren't counted.
  expect(palmer.figures[0]).toEqual({ stat: "goals_scored", total: 10, perNinety: 1, percentile: 100 });
  expect(await figureOf(SAKA.code, "goals_scored")).toEqual({ stat: "goals_scored", total: 5, perNinety: 0.5, percentile: 50 });
});

test(`under ${RANKED_MINUTES} minutes he has figures but no percentile`, async () => {
  const odegaard = await figuresOf(ODEGAARD.code);
  expect(odegaard.ranked).toBe(false);
  expect(odegaard.figures[0]).toEqual({ stat: "goals_scored", total: 4, perNinety: 2, percentile: null });
});

test("a goalkeeper gets the goalkeeper's set; the list's stat joins as a seventh, never twice", async () => {
  expect((await figuresOf(RAYA.code)).figures.map(({ stat }) => stat)).toEqual(["saves", "goals_conceded", "clean_sheets", "total_pass"]);
  expect((await figuresOf(RAYA.code, "goals_scored")).figures.map(({ stat }) => stat).at(-1)).toBe("goals_scored");
  expect((await figuresOf(PALMER.code, "assists")).figures).toHaveLength(6);
});

test("goals conceded ranks the keeper who lets in fewest highest, as every fewer-is-better stat does (#1787, S19.3)", async () => {
  const sanchez = { code: 1007, name: "Sánchez", fullName: "Robert Sánchez", clubCode: CHELSEA.code, positions: ["GK" as const] };
  await t.run(async (ctx) => {
    await insertPlayers(ctx, [sanchez]);
    await holdSeasonTotals(ctx, sanchez.code, { minutes: 900, goals_conceded: 21, saves: 40 });
    const raya = (await ctx.db.query("playerSeasonStats").collect()).find((row) => row.playerCode === RAYA.code)!;
    await ctx.db.patch("playerSeasonStats", raya._id, { stats: { ...raya.stats, goals_conceded: 7 } });
  });
  // Raya concedes 0.7 a match, Sánchez 2.1: Raya is 100, Sánchez 50; saves still rank most highest.
  expect(await figureOf(RAYA.code, "goals_conceded")).toMatchObject({ perNinety: 0.7, percentile: 100 });
  expect(await figureOf(sanchez.code, "goals_conceded")).toMatchObject({ perNinety: 2.1, percentile: 50 });
  expect(await figureOf(sanchez.code, "saves")).toMatchObject({ percentile: 100 });
});

test("a player with no minutes has no figures per 90", async () => {
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("playerSeasonStats").collect()) await ctx.db.delete("playerSeasonStats", row._id);
  });
  expect(await figureOf(PALMER.code, "goals_scored")).toEqual({ stat: "goals_scored", total: 0, perNinety: null, percentile: null });
});

test("Compare weighs both players by the first's area, so a goalkeeper set beside a midfielder gets the midfielder's rows", async () => {
  const [palmer, raya] = await (await actingAs(t, ANN)).query(api.scouting.compare.players, { leagueId, codes: [PALMER.code, RAYA.code], stat: null });
  expect(palmer).toMatchObject({ minutes: 900, figures: (await figuresOf(PALMER.code)).figures });
  expect(raya.minutes).toBe(900);
  expect(raya.figures.map(({ stat }) => stat)).toEqual(palmer.figures.map(({ stat }) => stat));
  // Raya is ranked against attacking midfielders in Palmer's rows: neither Saka's goals per 90 nor Palmer's is at or below his 0.
  expect(raya.figures[0]).toEqual({ stat: "goals_scored", total: 0, perNinety: 0, percentile: 0 });
});

test("a stat neither the catalogue nor the site's set holds is refused, as is someone not in the league", async () => {
  await expect(figuresOf(PALMER.code, "not_a_stat")).rejects.toThrow("No stat not_a_stat");
  await expectRefused((await actingAs(t, MANAGERS[3])).query(api.scouting.per90.figures, { leagueId, playerCode: PALMER.code, stat: null }), refusals.notInLeague);
});

describe("the rules apart", () => {
  test("each area's set: defence's five; midfield's and attack's the picture's six", () => {
    expect(per90Stats("defence", null)).toEqual(["won_tackle", "interception", "total_clearance", "clean_sheets", "assists"]);
    expect(per90Stats("midfield", null)).toEqual(per90Stats("attack", null));
  });

  test("a main position's area, as spec/14's table places it", () => {
    expect(mainArea(["W"])).toBe("attackingMidfield");
    expect(mainArea(["CAM", "ST"])).toBe("attackingMidfield");
    expect(mainArea(["WB"])).toBe("defensiveMidfield");
    expect(mainArea(["FB"])).toBe("defence");
    expect(mainArea([])).toBeNull();
  });

  test("a percentile is the share at or below, so the best is 100", () => {
    expect(percentileOf(3, [1, 2, 3, 4])).toBe(75);
    expect(percentileOf(4, [1, 2, 3, 4])).toBe(100);
    expect(percentileOf(1, [])).toBeNull();
  });

  test("where fewer is better, the share at or above, so the fewest is 100", () => {
    expect(percentileOf(1, [1, 2, 3, 4], false)).toBe(100);
    expect(percentileOf(4, [1, 2, 3, 4], false)).toBe(25);
  });
});
