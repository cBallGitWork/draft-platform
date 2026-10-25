import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { NEXT_FIXTURES_SHOWN } from "../../../convex/playerCard/playerCard";
import type { Position } from "../../../convex/positions/positionTables";
import type { StoredScoringSet } from "../../../convex/rules/leagueRulesShape";
import { refusals } from "../../../convex/shared/leagueAccess";
import { DAY_MS, WEEK_MS } from "../../../convex/shared/time";
import { MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { EXAMPLE_SET } from "../../support/convex/scoring.example";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// A player's card (#381, spec/12 The player card): who he is, who owns him in the league, FPL's
// news, this season's matches priced under the site's scoring at his best position (no lineup is
// kept until #29), and his club's next fixtures. The site plays EXAMPLE_SET throughout.

const [ANN, BOB] = MANAGERS;
const OUTSIDER = "outsider@example.com";
const ARSENAL = { code: 3, name: "Arsenal", shortName: "ARS" };
const CHELSEA = { code: 8, name: "Chelsea", shortName: "CHE" };
const COVENTRY = { code: 9, name: "Coventry", shortName: "COV" };

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
const GONE = { code: 1003, name: "Gone", fullName: "Long Gone", clubCode: ARSENAL.code, positions: [] as Position[] };

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

const record = (playerCode: number, fixtureCode: number, stats: Record<string, number>, parts: { played?: boolean | null; pl?: boolean } = {}) => ({
  playerCode,
  fixtureCode,
  started: true,
  played: parts.played === undefined ? true : parts.played,
  arrived: { fpl: true, pl: parts.pl ?? true },
  stats,
  state: "complete" as const,
});

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    for (const club of [ARSENAL, CHELSEA, COVENTRY]) await ctx.db.insert("clubs", club);
    for (const { positions, ...player } of [SAKA, MOVER]) {
      await ctx.db.insert("players", player);
      await ctx.db.insert("playerPositions", { code: player.code, starts: [], approved: [], set: positions, removed: [] });
    }
    const { positions: _none, ...gone } = GONE;
    await ctx.db.insert("players", { ...gone, droppedAt: NOW });
    for (const each of [ARS_COV, CHE_ARS, LAST_SEASON, COV_CHE, ...ARSENAL_AHEAD, NO_KICKOFF_YET]) await ctx.db.insert("fixtures", each);
    await ctx.db.insert("siteScoring", { scoring: structuredClone(EXAMPLE_SET) as StoredScoringSet, kind: "fix", season: 2025, number: 1, announcedAt: 0, takesEffectAt: 0 });
    await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[0], playerCode: SAKA.code });
    for (const each of [
      record(SAKA.code, ARS_COV.code, { minutes: 90, goals_scored: 1, assists: 1 }),
      // Only FPL's part has arrived: not yet whole.
      record(SAKA.code, CHE_ARS.code, { minutes: 90 }, { pl: false }),
      record(SAKA.code, LAST_SEASON.code, { minutes: 90, goals_scored: 3 }),
      record(MOVER.code, ARS_COV.code, { minutes: 90, goals_conceded: 4 }),
      // An unused substitute.
      record(MOVER.code, CHE_ARS.code, {}, { played: false }),
    ]) {
      await ctx.db.insert("playerMatchStats", each);
    }
  });
});

const cardAs = async (email: string, playerCode: number) => (await actingAs(t, email)).query(api.playerCard.playerCard.card, { leagueId, playerCode, now: NOW });
const teamName = (teamId: Id<"teams">) => t.run(async (ctx) => (await ctx.db.get("teams", teamId))!.name);

test("the card names him, his club, his positions, his owner in the league and FPL's news", async () => {
  expect(await cardAs(BOB, SAKA.code)).toMatchObject({
    code: SAKA.code,
    name: "Saka",
    fullName: "Bukayo Saka",
    club: ARSENAL,
    gone: false,
    positions: ["W"],
    ownerTeamName: await teamName(teams[0]),
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
  await expect(cardAs(OUTSIDER, SAKA.code)).rejects.toThrow(refusals.notInLeague);
});
