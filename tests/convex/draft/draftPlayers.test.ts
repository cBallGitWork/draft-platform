import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ARSENAL, CHELSEA, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeRules, HELD_FIRST_RULES, holdGameweeks, NO_AREA_MINIMUMS, rulesWith } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, OUTSIDER, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The draft room's players list's legal flag (spec/04, The draft room; #1099): the players the
// reader's team can't take as its next pick, and why, by the pick's own rule, while the draft runs.

let t: TestConvex;
let leagueId: Id<"leagues">;
const [ANN, BOB] = MANAGERS;

const player = (code: number, clubCode: number, position: HeldPlayer["positions"][number]): HeldPlayer => ({
  code,
  name: `Player ${code}`,
  fullName: `Player ${code}`,
  clubCode,
  positions: [position],
});
const ARSENAL_MID = player(101, ARSENAL.code, "CM");
const ARSENAL_STRIKER = player(102, ARSENAL.code, "ST");
const CHELSEA_MID = player(201, CHELSEA.code, "CM");
const CHELSEA_KEEPER = player(202, CHELSEA.code, "GK");

const setSquadRules = (squad: Partial<LeagueRules["squad"]>) =>
  t.run(async (ctx) => {
    for (const row of await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect()) {
      await ctx.db.patch("leagueRules", row._id, {
        rules: { ...row.rules, squad: { size: { minimum: 1, maximum: 2 }, minimumByArea: null, maxPerClub: null, ...squad } },
      });
    }
  });

const as = (email: string) => actingAs(t, email);
const greyedOut = async (email: string) => (await as(email)).query(api.draft.draftPlayers.greyedOut, { leagueId });
const start = async () => (await as(COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
const pick = async (email: string, playerCode: number) => (await as(email)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode });
const byCode = (greyed: { code: number }[]) => [...greyed].sort((one, other) => one.code - other.code);

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, [ARSENAL_MID, ARSENAL_STRIKER, CHELSEA_MID, CHELSEA_KEEPER]);
  });
});

describe("the players a team can't take", () => {
  test("are none before the draft starts", async () => {
    await setSquadRules({ maxPerClub: 1 });
    expect(await greyedOut(ANN)).toEqual([]);
  });

  test("are those of a club the team is at the maximum for, whoever is on the clock", async () => {
    await setSquadRules({ maxPerClub: 1 });
    await start();
    await pick(ANN, ARSENAL_MID.code);

    expect(byCode(await greyedOut(ANN))).toEqual([
      { code: ARSENAL_MID.code, reason: "clubFull" },
      { code: ARSENAL_STRIKER.code, reason: "clubFull" },
    ]);
    expect(await greyedOut(BOB)).toEqual([]);
  });

  test("are every outfielder when the last pick must fill an area's minimum", async () => {
    await setSquadRules({ minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 } });
    await start();
    await pick(ANN, ARSENAL_MID.code);

    expect(byCode(await greyedOut(ANN))).toEqual([
      { code: ARSENAL_MID.code, reason: "areasShort" },
      { code: ARSENAL_STRIKER.code, reason: "areasShort" },
      { code: CHELSEA_MID.code, reason: "areasShort" },
    ]);
  });

  test("are none for a commissioner who runs no team, and none once the draft is over", async () => {
    await setSquadRules({ maxPerClub: 1, size: { minimum: 1, maximum: 1 } });
    await start();
    expect(await greyedOut(COMMISSIONER)).toEqual([]);
    await pick(ANN, ARSENAL_MID.code);
    await pick(BOB, CHELSEA_MID.code);
    expect(await greyedOut(ANN)).toEqual([]);
  });

  test("are refused to anyone outside the league", async () => {
    await expectRefused(greyedOut(OUTSIDER), refusals.notInLeague);
  });
});

describe("the draft room's figures", () => {
  const figuresOf = async (email: string) => (await as(email)).query(api.draft.draftPlayers.figures, { leagueId, now: Date.now() });
  const byCodeOf = <Figure extends { code: number }>(figures: { players: Figure[] }) => new Map(figures.players.map((each) => [each.code, each]));

  test("rank the admin's ranking first, then last season's points, newcomers last, with each one's overview", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("draftRanking", { players: [{ code: CHELSEA_KEEPER.code, rank: 1 }], uploadedAt: Date.now() });
      await ctx.db.insert("pastSeasonPoints", { season: 2025, playerCode: ARSENAL_MID.code, points: { CM: 120 } });
      await ctx.db.insert("pastSeasonPoints", { season: 2025, playerCode: CHELSEA_MID.code, points: { CM: 150 } });
      await ctx.db.insert("pastSeasonPoints", { season: 2025, playerCode: CHELSEA_KEEPER.code, points: { GK: 90 } });
      await ctx.db.insert("playerSeasonStats", { season: 2025, playerCode: ARSENAL_MID.code, stats: { appearances: 30, goals_scored: 4, assists: 6 } });
    });
    const figures = await figuresOf(ANN);
    const of = byCodeOf(figures);
    expect([CHELSEA_KEEPER, CHELSEA_MID, ARSENAL_MID, ARSENAL_STRIKER].map(({ code }) => of.get(code)?.rank)).toEqual([1, 2, 3, 4]);
    expect(of.get(CHELSEA_MID.code)?.lastSeasonPoints).toBe(150);
    expect(of.get(ARSENAL_STRIKER.code)?.lastSeasonPoints).toBeNull();
    expect(of.get(ARSENAL_MID.code)?.overview).toEqual({ appearances: 30, goals: 4, assists: 6, cleanSheets: 0 });
    expect(figures).toMatchObject({ lastSeason: 2025, statsSeason: 2025 });
  });

  test("give the club maximum the draft picks by: the league's before the start, the one it started under after", async () => {
    await setSquadRules({ maxPerClub: 1 });
    expect((await figuresOf(ANN)).maxPerClub).toBe(1);
    await start();
    await setSquadRules({ maxPerClub: 2 });
    expect((await figuresOf(ANN)).maxPerClub).toBe(1);
  });

  test("before the start, give the club maximum of a change waiting for the next gameweek, which the draft would start under (#1130)", async () => {
    await holdGameweeks(t, { next: 5 });
    expect(HELD_FIRST_RULES.squad.maxPerClub).not.toBe(1);
    expect(await changeRules(t, leagueId, rulesWith({ squad: { ...HELD_FIRST_RULES.squad, maxPerClub: 1 } }))).toBe(5);

    expect((await figuresOf(ANN)).maxPerClub).toBe(1);
  });

  test("are refused to anyone outside the league", async () => {
    await expectRefused(figuresOf(OUTSIDER), refusals.notInLeague);
  });
});
