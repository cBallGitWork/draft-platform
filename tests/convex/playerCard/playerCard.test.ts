import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { NEXT_FIXTURES_SHOWN } from "../../../convex/playerCard/playerCard";
import type { Position } from "../../../convex/positions/positionTables";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { refusals } from "../../../convex/shared/leagueAccess";
import { DAY_MS, WEEK_MS } from "../../../convex/shared/time";
import { MANAGERS, OUTSIDER, actingAs, teamName, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { EXAMPLE_SET, GOAL_AND_ASSIST } from "../../support/convex/scoring.example";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";
import { ARSENAL, CHELSEA, COVENTRY, GONE, completeRecord, insertClubs, insertDroppedPlayer, insertPlayers } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// A player's card (#381, spec/12 The player card): who he is, who owns him in the league, FPL's
// news, this season's matches at his base points under the site's scoring, at each position he has
// (Craig, 31 Oct 2026), with his role's line apart where his team started him, and his club's next
// fixtures. The site plays EXAMPLE_SET throughout.

const [ANN, BOB] = MANAGERS;

const SAKA = {
  code: 1001,
  name: "Saka",
  fullName: "Bukayo Saka",
  clubCode: ARSENAL.code,
  news: "Knock - 75% chance of playing",
  chanceOfPlaying: 75,
  positions: ["W"] as Position[],
};
/** A centre-back FPL has no doubt about, who played for Arsenal in gameweek 1 and has since joined Chelsea. */
const MOVER = { code: 1002, name: "Mover", fullName: "Moving Man", clubCode: CHELSEA.code, news: "", chanceOfPlaying: null, positions: ["CB"] as Position[] };
/** An Arsenal forward with two positions, held front first, who scored and assisted in gameweek 1. */
const FORWARD = { ...MOVER, code: 1003, name: "Forward", fullName: "Two Positions", clubCode: ARSENAL.code, positions: ["ST", "W"] as Position[] };
/** An Arsenal second striker, a position no slot prices yet (spec/14), who scored and assisted in gameweek 1. */
const SUPPORT = { ...MOVER, code: 1004, name: "Support", fullName: "Second Striker", clubCode: ARSENAL.code, positions: ["SS"] as Position[] };

const NOW = Date.parse("2026-09-01T12:00:00Z");
const fixture = (code: number, gameweek: number | null, home: number, away: number, kickoff: number | null, dropped = false) => ({
  code,
  gameweek,
  homeClubCode: home,
  awayClubCode: away,
  kickoff,
  ...(dropped ? { droppedAt: NOW } : {}),
});
const ARS_COV = fixture(1, 1, ARSENAL.code, COVENTRY.code, Date.parse("2026-08-22T14:00:00Z"));
const CHE_ARS = fixture(2, 2, CHELSEA.code, ARSENAL.code, Date.parse("2026-08-29T14:00:00Z"));
/** Last season's, which the feed no longer sends. */
const LAST_SEASON = fixture(3, 30, ARSENAL.code, CHELSEA.code, Date.parse("2026-04-01T14:00:00Z"), true);
const COV_CHE = fixture(4, 3, COVENTRY.code, CHELSEA.code, NOW + 4 * DAY_MS);
/** Arsenal's next six, one more than the card shows. */
const ARSENAL_AHEAD = Array.from({ length: NEXT_FIXTURES_SHOWN + 1 }, (_, index) =>
  fixture(10 + index, 3 + index, ARSENAL.code, index % 2 === 0 ? CHELSEA.code : COVENTRY.code, NOW + (index + 1) * WEEK_MS),
);
const NO_KICKOFF_YET = fixture(20, null, ARSENAL.code, COVENTRY.code, null);

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA, COVENTRY]);
    await insertPlayers(ctx, [SAKA, MOVER, FORWARD, SUPPORT]);
    await insertDroppedPlayer(ctx, GONE, NOW);
    for (const each of [ARS_COV, CHE_ARS, LAST_SEASON, COV_CHE, ...ARSENAL_AHEAD, NO_KICKOFF_YET]) await ctx.db.insert("fixtures", each);
    await holdSiteScoring(ctx, { scoring: structuredClone(EXAMPLE_SET) as StoredScoringSet, kind: "fix", season: 2025, number: 1, at: 0 });
    await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[0], playerCode: SAKA.code });
    for (const each of [
      completeRecord(SAKA.code, ARS_COV.code, GOAL_AND_ASSIST),
      completeRecord(FORWARD.code, ARS_COV.code, GOAL_AND_ASSIST),
      completeRecord(SUPPORT.code, ARS_COV.code, GOAL_AND_ASSIST),
      // Only FPL's part has arrived: not yet whole.
      completeRecord(SAKA.code, CHE_ARS.code, { minutes: 90 }, { pl: false }),
      completeRecord(SAKA.code, LAST_SEASON.code, { minutes: 90, goals_scored: 3 }),
      completeRecord(MOVER.code, ARS_COV.code, { minutes: 90, goals_conceded: 4 }),
      // An unused substitute.
      completeRecord(MOVER.code, CHE_ARS.code, {}, { played: false }),
    ]) {
      await ctx.db.insert("playerMatchStats", each);
    }
  });
});

const cardAs = async (email: string, playerCode: number) => (await actingAs(t, email)).query(api.playerCard.playerCard.card, { leagueId, playerCode, now: NOW });

test("the card names him, his club, his positions, his owner in the league and FPL's news", async () => {
  expect(await cardAs(BOB, SAKA.code)).toMatchObject({
    code: SAKA.code,
    name: "Saka",
    fullName: "Bukayo Saka",
    club: ARSENAL,
    gone: false,
    positions: ["W"],
    ownerTeamName: await teamName(t, teams[0]),
    news: SAKA.news,
    chanceOfPlaying: SAKA.chanceOfPlaying,
  });
});

test("a free agent with no news has no owner, no news and no chance of playing", async () => {
  expect(await cardAs(ANN, MOVER.code)).toMatchObject({ ownerTeamName: null, news: null, chanceOfPlaying: null });
});

test("this season's matches are newest first, at his base points, by category", async () => {
  const { pricedAt, matches } = (await cardAs(ANN, SAKA.code))!;

  expect(pricedAt).toEqual(["W"]);
  expect(matches.map((match) => match.fixtureCode)).toEqual([CHE_ARS.code, ARS_COV.code]);
  const [unarrived, priced] = matches;
  expect(priced).toMatchObject({ gameweek: 1, kickoff: ARS_COV.kickoff, home: ARSENAL, away: COVENTRY, minutes: 90 });
  // As a winger in attacking midfield: goal 5, assist 4, minutes 2.
  expect(priced.points).toHaveLength(1);
  expect(priced.points[0]).toMatchObject({ position: "W", total: 11 });
  // Each with why (spec/14, On screen): EXAMPLE_SET prices all three by area.
  const inArea = { by: "area", area: "attackingMidfield" } as const;
  expect(priced.points[0].categories.slice(0, 3)).toEqual([
    { stat: "goals_scored", name: "Goals scored", points: 5, why: { actions: 1, value: { shape: "perAction", points: 5 }, pricedBy: inArea, cut: null } },
    { stat: "assists", name: "Assists", points: 4, why: { actions: 1, value: { shape: "perAction", points: 4 }, pricedBy: inArea, cut: null } },
    { stat: "minutes", name: "Minutes", points: 2, why: { actions: 90, value: { shape: "bands", earned: [{ atLeast: 60, points: 2 }] }, pricedBy: inArea, cut: null } },
  ]);
  expect(priced.version).toBe("25_26.1");
  expect(priced.role).toBeUndefined();
  expect(unarrived).toMatchObject({ minutes: null, points: [{ position: "W", total: null }] });
});

test("each match names the version it was scored under: a later version reaches only the gameweeks after it (spec/14)", async () => {
  // Takes effect between gameweek 1's kickoff and gameweek 2's.
  const between = ARS_COV.kickoff! + DAY_MS;
  await t.run((ctx) => holdSiteScoring(ctx, { scoring: structuredClone(EXAMPLE_SET) as StoredScoringSet, kind: "patch", season: 2026, number: 1, at: between }));
  const { matches } = (await cardAs(ANN, SAKA.code))!;

  expect(matches.map(({ gameweek, version }) => [gameweek, version])).toEqual([
    [2, "26_27.1"],
    [1, "25_26.1"],
  ]);
});

test("before the site has any version, its matches were scored under the first set, which has no name", async () => {
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("siteScoring").collect()) await ctx.db.delete("siteScoring", row._id);
  });
  const { matches } = (await cardAs(ANN, SAKA.code))!;
  expect(matches.map((match) => match.version)).toEqual([null, null]);
});

test("a player with two positions is priced at each, back to front, whatever order they are held in", async () => {
  const { pricedAt, matches } = (await cardAs(ANN, FORWARD.code))!;

  expect(pricedAt).toEqual(["W", "ST"]);
  // A goal and an assist: 5 + 4 + 2 as a winger, 4 + 3 + 2 up front.
  expect(matches[0].points.map(({ position, total }) => [position, total])).toEqual([
    ["W", 11],
    ["ST", 9],
  ]);
});

test("a second striker, whose position no slot prices yet, is priced once at his best position", async () => {
  const { pricedAt, matches } = (await cardAs(ANN, SUPPORT.code))!;

  expect(pricedAt).toEqual([]);
  // His cells are attacking midfield's and the attack's: a winger's 11 beats a striker's 9.
  expect(matches[0].points).toMatchObject([{ position: "W", total: 11 }]);
});

/** Gameweek 1 begun for the league, so its table scores it (#577), the set adjusting an inside
 *  forward +2 a goal, and Ann's lineup naming Saka, in a starter's slot or on the bench. */
async function annFieldsSaka(where: "started" | "benched") {
  await t.run(async (ctx) => {
    const madeAt = (await ctx.db.get("leagues", leagueId))!._creationTime;
    await ctx.db.insert("passedDeadlines", { leagueId, gameweek: 1, deadline: madeAt, recordedAt: madeAt });
    const row = (await ctx.db.query("siteScoring").first())!;
    const scoring = { ...row.scoring, roleAdjustments: [{ role: "insideForward", adjustments: [{ stat: "goals_scored", points: 2 }] }] };
    await ctx.db.patch("siteScoring", row._id, { scoring });
    const slot = { playerCode: SAKA.code, area: "attackingMidfield" as const, lane: "left" as const, role: "insideForward" };
    await ctx.db.insert("lineups", {
      leagueId,
      teamId: teams[0],
      fromGameweek: 1,
      starters: where === "started" ? [slot] : [],
      bench: where === "benched" ? [SAKA.code] : [],
    });
  });
  return (await cardAs(ANN, SAKA.code))!.matches.find((match) => match.fixtureCode === ARS_COV.code)!;
}

test("a match his team started him in shows his base points, and his role's line apart from them (#10)", async () => {
  const priced = await annFieldsSaka("started");

  // His base 11 as a winger; his role's +2 for the goal on its own line, not added in.
  expect(priced.points).toMatchObject([{ position: "W", total: 11 }]);
  expect(priced.role).toEqual({ name: "Inside forward", points: 2, lines: [{ stat: "goals_scored", name: "Goals scored", actions: 1, points: 2 }] });
});

test("a match his team named him on the bench for shows his base points, with no role line", async () => {
  const priced = await annFieldsSaka("benched");

  expect(priced.points).toMatchObject([{ position: "W", total: 11 }]);
  expect(priced.role).toBeUndefined();
});

test("a free agent's matches show his base points, for a club he has left too, and an unused substitute's don't show", async () => {
  const { matches } = (await cardAs(ANN, MOVER.code))!;

  // For Arsenal in gameweek 1, as a centre-back: minutes 2, four conceded -2.
  expect(matches).toHaveLength(1);
  expect(matches[0]).toMatchObject({ fixtureCode: ARS_COV.code, home: ARSENAL, points: [{ position: "CB", total: 0 }] });
});

test("his club's next fixtures after now, soonest first, are the few the card shows", async () => {
  const { nextFixtures } = (await cardAs(ANN, SAKA.code))!;

  expect(nextFixtures.map((each) => each.fixtureCode)).toEqual(ARSENAL_AHEAD.slice(0, NEXT_FIXTURES_SHOWN).map((each) => each.code));
  expect(nextFixtures[0]).toEqual({ fixtureCode: ARSENAL_AHEAD[0].code, gameweek: 3, kickoff: ARSENAL_AHEAD[0].kickoff, home: ARSENAL, away: CHELSEA });
});

test("a player who has left the Premier League still has a card, marked gone", async () => {
  expect(await cardAs(ANN, GONE.code)).toMatchObject({ gone: true, positions: [], matches: [], nextFixtures: expect.any(Array) });
});

test("a code the football sync doesn't hold has no card", async () => {
  expect(await cardAs(ANN, 999_999)).toBeNull();
});

test("someone not in the league is refused", async () => {
  await expectRefused(cardAs(OUTSIDER, SAKA.code), refusals.notInLeague);
});
