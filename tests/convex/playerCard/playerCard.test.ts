import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { NEXT_FIXTURES_SHOWN } from "../../../convex/playerCard/playerCard";
import type { Position } from "../../../convex/positions/positionTables";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { refusals } from "../../../convex/shared/leagueAccess";
import { DAY_MS, WEEK_MS } from "../../../convex/shared/time";
import { MANAGERS, OUTSIDER, actingAs, teamName, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { EXAMPLE_SET } from "../../support/convex/scoring.example";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";
import { ARSENAL, CHELSEA, COVENTRY, GONE, completeRecord, insertClubs, insertDroppedPlayer, insertPlayers } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// A player's card (#381, spec/12 The player card): who he is, who owns him in the league, FPL's
// news, this season's matches priced under the site's scoring at his best position, or at his slot
// and role where his team started him, and his club's next fixtures. The site plays EXAMPLE_SET throughout.

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
    await insertPlayers(ctx, [SAKA, MOVER]);
    await insertDroppedPlayer(ctx, GONE, NOW);
    for (const each of [ARS_COV, CHE_ARS, LAST_SEASON, COV_CHE, ...ARSENAL_AHEAD, NO_KICKOFF_YET]) await ctx.db.insert("fixtures", each);
    await holdSiteScoring(ctx, { scoring: structuredClone(EXAMPLE_SET) as StoredScoringSet, kind: "fix", season: 2025, number: 1, at: 0 });
    await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[0], playerCode: SAKA.code });
    for (const each of [
      completeRecord(SAKA.code, ARS_COV.code, { minutes: 90, goals_scored: 1, assists: 1 }),
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

test("this season's matches are newest first, priced at his best position, by category", async () => {
  const { matches } = (await cardAs(ANN, SAKA.code))!;

  expect(matches.map((match) => match.fixtureCode)).toEqual([CHE_ARS.code, ARS_COV.code]);
  const [unarrived, priced] = matches;
  expect(priced).toMatchObject({ gameweek: 1, kickoff: ARS_COV.kickoff, home: ARSENAL, away: COVENTRY, minutes: 90 });
  // As a winger in attacking midfield: goal 5, assist 4, minutes 2.
  expect(priced.points).toMatchObject({ scoredAs: "bestPosition", position: "W", total: 11 });
  expect(priced.points.categories.slice(0, 3)).toEqual([
    { stat: "goals_scored", name: "Goals scored", points: 5 },
    { stat: "assists", name: "Assists", points: 4 },
    { stat: "minutes", name: "Minutes", points: 2 },
  ]);
  expect(unarrived).toMatchObject({ minutes: null, points: { position: null, total: null } });
});

test("a match his team started him in is priced at his slot and role, with the role's line (#10)", async () => {
  await t.run(async (ctx) => {
    // Gameweek 1 begun for the league, so its table scores it (#577).
    const madeAt = (await ctx.db.get("leagues", leagueId))!._creationTime;
    await ctx.db.insert("passedDeadlines", { leagueId, gameweek: 1, deadline: madeAt, recordedAt: madeAt });
    const row = (await ctx.db.query("siteScoring").first())!;
    const scoring = { ...row.scoring, roleAdjustments: [{ role: "insideForward", adjustments: [{ stat: "goals_scored", points: 2 }] }] };
    await ctx.db.patch("siteScoring", row._id, { scoring });
    await ctx.db.insert("lineups", {
      leagueId,
      teamId: teams[0],
      fromGameweek: 1,
      starters: [{ playerCode: SAKA.code, area: "attackingMidfield", lane: "left", role: "insideForward" }],
      bench: [],
    });
  });
  const priced = (await cardAs(ANN, SAKA.code))!.matches.find((match) => match.fixtureCode === ARS_COV.code)!;

  // His base 11 as a winger, and his role's +2 for the goal.
  expect(priced.points).toMatchObject({ scoredAs: "slot", position: "W", total: 13 });
  expect(priced.points.role).toEqual({ name: "Inside forward", points: 2, lines: [{ stat: "goals_scored", name: "Goals scored", actions: 1, points: 2 }] });
});

test("a player's matches for a club he has left still count, and an unused substitute's don't", async () => {
  const { matches } = (await cardAs(ANN, MOVER.code))!;

  // For Arsenal in gameweek 1, as a centre-back: minutes 2, four conceded -2.
  expect(matches).toHaveLength(1);
  expect(matches[0]).toMatchObject({ fixtureCode: ARS_COV.code, home: ARSENAL, points: { position: "CB", total: 0 } });
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
