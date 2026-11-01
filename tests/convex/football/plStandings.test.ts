import { expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { ScoreRead } from "../../../convex/football/scoreReads";
import { refusals } from "../../../convex/shared/leagueAccess";
import { HOUR_MS } from "../../../convex/shared/time";
import { actingAs } from "../../support/convex/leagues.harness";
import { syncRun } from "../../support/convex/footballSync.harness";
import { expectRefused, freshConvex, type TestConvex } from "../../support/convex/test.harness";
import { clubCodeOfPlTeam, recordedResults, recordedStandings } from "../../support/recorded/standings.payloads";

// The Premier League table on the section (#50; spec/18, The table): worked out from the held
// results, live during matches and provisional until they are final.

const MANAGER = "manager@example.com";

async function table(t: TestConvex) {
  return (await actingAs(t, MANAGER)).query(api.football.plStandings.ofSeason, {});
}

/** A row as [position, club code, P, W, D, L, GF, GA, GD, Pts]. */
type Line = [number, number, number, number, number, number, number, number, number, number];
async function lines(t: TestConvex): Promise<Line[]> {
  return (await table(t)).rows.map((row) => [
    row.position,
    row.club.code,
    row.played,
    row.won,
    row.drawn,
    row.lost,
    row.goalsFor,
    row.goalsAgainst,
    row.goalDifference,
    row.points,
  ]);
}

test("this season's results give the table the Premier League showed for them, gameweek 8 all played", async () => {
  const t = freshConvex();
  await syncRun(t, recordedResults());

  const premierLeagues: Line[] = recordedStandings.map(({ team, position, overall }) => [
    position,
    clubCodeOfPlTeam.get(team.id)!,
    overall.played,
    overall.won,
    overall.drawn,
    overall.lost,
    overall.goalsFor,
    overall.goalsAgainst,
    overall.goalsDifference,
    overall.points,
  ]);
  expect(premierLeagues).toHaveLength(20);
  expect(await lines(t)).toEqual(premierLeagues);
  expect((await table(t)).provisional).toBe(false);
});

// A replayed match of gameweek 9, still to come in the recording: Coventry, 19th, at home to
// Sunderland, bottom.

const COVENTRY = 9;
const SUNDERLAND = 56;
function coventrySunderland() {
  const payloads = recordedResults();
  const idOf = (code: number) => payloads.bootstrap.teams.find((team) => team.code === code)!.id;
  const match = payloads.fixtures.find((fixture) => fixture.event === 9 && fixture.team_h === idOf(COVENTRY) && fixture.team_a === idOf(SUNDERLAND))!;
  return { payloads, code: match.code };
}

function read(t: TestConvex, readAt: number, score: Omit<ScoreRead, "fixtureCode">, fixtureCode: number) {
  return t.mutation(internal.football.matchScores.upsertScores, { feed: "pl", readAt, reads: [{ fixtureCode, ...score }] });
}

// 1.4s alone and up to 3.9s on a busy core (27 Oct 2026), too near vitest's 5s; none of it is spare (#473).
test("a replayed goal moves the table at once, marked provisional, until full time makes it final", { timeout: 30_000 }, async () => {
  const t = freshConvex();
  const { payloads, code } = coventrySunderland();
  const run = await syncRun(t, payloads);
  // One read of the table at each point of the match: in convex-test a read costs about a third of
  // a second, each of its 380 index reads scanning every held row, and a read per row timed out.
  const standing = async () => {
    const { rows, provisional } = await table(t);
    const rowOf = (club: number) => rows.find((row) => row.club.code === club)!;
    return { coventry: rowOf(COVENTRY), sunderland: rowOf(SUNDERLAND), provisional };
  };
  const before = await standing();
  expect(before.coventry).toMatchObject({ position: 19, played: 8, points: 6 });
  expect(before.sunderland).toMatchObject({ position: 20, played: 8, points: 5 });

  await read(t, run.ranAt + HOUR_MS, { state: "live", homeGoals: 0, awayGoals: 1, minutes: 12, clockLabel: "12'30" }, code);
  const live = await standing();
  expect(live.sunderland).toMatchObject({ position: 16, played: 9, won: 2, points: 8, goalsFor: 7 });
  expect(live.coventry).toMatchObject({ position: 20, played: 9, lost: 7, points: 6 });
  expect(live.provisional).toBe(true);

  await read(t, run.ranAt + 2 * HOUR_MS, { state: "halfTime", homeGoals: 1, awayGoals: 1, minutes: 45, clockLabel: "45+1'00" }, code);
  const halfTime = await standing();
  expect(halfTime.sunderland).toMatchObject({ played: 9, drawn: 3, points: 6 });
  expect(halfTime.coventry).toMatchObject({ played: 9, drawn: 1, points: 7 });
  expect(halfTime.provisional).toBe(true);

  await read(t, run.ranAt + 3 * HOUR_MS, { state: "fullTime", homeGoals: 1, awayGoals: 2, minutes: 90, clockLabel: "90+5'00" }, code);
  const fullTime = await standing();
  expect(fullTime.sunderland).toMatchObject({ position: 16, played: 9, won: 2, points: 8 });
  expect(fullTime.provisional).toBe(false);
});

// Small seasons held by hand: three clubs, each pair meeting once at home and once away.

const CLUBS = [
  { code: 1, name: "Arsenal", shortName: "ARS" },
  { code: 2, name: "Burnley", shortName: "BUR" },
  { code: 3, name: "Chelsea", shortName: "CHE" },
];
type Held = { code: number; home: number; away: number; score: [number, number] | null };

async function holdSeason(t: TestConvex, matches: Held[]) {
  await t.run(async (ctx) => {
    for (const club of CLUBS) await ctx.db.insert("clubs", club);
    for (const { code, home, away } of matches) {
      await ctx.db.insert("fixtures", { code, gameweek: code, homeClubCode: home, awayClubCode: away, kickoff: code * HOUR_MS });
    }
  });
  for (const { code, score } of matches) {
    if (score === null) continue;
    await read(t, 0, { state: "fullTime", homeGoals: score[0], awayGoals: score[1], minutes: 90, clockLabel: null }, code);
  }
}

test("with no results, every club is on nothing, sharing first in alphabetical order, and nothing is provisional", async () => {
  const t = freshConvex();
  await holdSeason(t, [{ code: 1, home: 3, away: 1, score: null }]);

  expect((await lines(t)).map(([position, club]) => [position, club])).toEqual([
    [1, 1],
    [1, 2],
    [1, 3],
  ]);
  expect((await table(t)).provisional).toBe(false);
});

// Arsenal and Burnley end level on points, goal difference and goals; Burnley took more points
// from their two meetings.
const levelSeason: Held[] = [
  { code: 1, home: 2, away: 1, score: [0, 0] },
  { code: 2, home: 1, away: 2, score: [0, 1] },
  { code: 3, home: 1, away: 3, score: [1, 0] },
  { code: 4, home: 3, away: 1, score: [0, 1] },
  { code: 5, home: 2, away: 3, score: [0, 1] },
  { code: 6, home: 3, away: 2, score: [0, 1] },
];

test("in the season, clubs level after goals share a position; head to head doesn't part them", async () => {
  const t = freshConvex();
  await holdSeason(t, [...levelSeason, { code: 7, home: 1, away: 3, score: null }]);

  const [first, second] = await lines(t);
  expect([first.slice(0, 2), second.slice(0, 2)]).toEqual([
    [1, 1],
    [1, 2],
  ]);
});

test("once every match is at full time, head-to-head parts the clubs level after goals (Handbook C.17)", async () => {
  const t = freshConvex();
  await holdSeason(t, levelSeason);

  const [first, second, third] = await lines(t);
  expect(first.slice(0, 2)).toEqual([1, 2]);
  expect(second.slice(0, 2)).toEqual([2, 1]);
  expect(third.slice(0, 2)).toEqual([3, 3]);
});

test("at the end of the season, a match never played between two other clubs leaves head-to-head splitting a tied pair", async () => {
  const t = freshConvex();
  await t.run(async (ctx) => {
    await ctx.db.insert("clubs", { code: 4, name: "Derby", shortName: "DER" });
  });
  // Chelsea v Derby, in an early gameweek, never played; every other match, Derby's last, at full time.
  await holdSeason(t, [...levelSeason, { code: 7, home: 3, away: 4, score: null }, { code: 8, home: 4, away: 2, score: [0, 0] }, { code: 9, home: 1, away: 4, score: [0, 0] }]);
  await t.run(async (ctx) => {
    const neverPlayed = await ctx.db.query("fixtures").filter((q) => q.eq(q.field("code"), 7)).unique();
    await ctx.db.patch(neverPlayed!._id, { gameweek: 1 });
  });

  const [first, second] = await lines(t);
  expect(first.slice(0, 2)).toEqual([1, 2]);
  expect(second.slice(0, 2)).toEqual([2, 1]);
});

test("a match held as played with no score throws, never left out of the table", async () => {
  const t = freshConvex();
  await holdSeason(t, [{ code: 1, home: 3, away: 1, score: null }]);
  await t.run(async (ctx) => {
    await ctx.db.insert("matchScores", { fixtureCode: 1, state: "live", homeGoals: null, awayGoals: null, minutes: 10, clockLabel: null, feed: "pl", readAt: 0 });
  });

  await expect(table(t)).rejects.toThrow("Match 1 is held at live with no score");
});

test("someone signed out is refused the table", async () => {
  const t = freshConvex();

  await expectRefused(t.query(api.football.plStandings.ofSeason, {}), refusals.signedOut);
});
