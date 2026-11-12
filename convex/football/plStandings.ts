import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { clubRecord } from "../schema";
import { currentFixtures, heldFixturesSeason } from "../shared/fixtures";
import { callerEmail } from "../shared/leagueAccess";
import { clubOf, currentClubs, type Club } from "../shared/players";
import { isPlaying, scoreOf } from "./matchScores";
import { seasonPointsOverrides } from "./plPointsOverrides";
import { plTable, type PlMatch, type PlResult } from "./plTable";
import { COMPETITION_TIE_BREAKS } from "./tieBreaks";

// The Premier League table for the section (#50; spec/18, The table: "P W D L GF GA GD Pts, worked
// out from the results. Live during matches, provisional until they are final"). The results are
// the held scores (matchScores.ts) of the matches the feed still sends: those at full time, and
// those being played, as they stand.

const tableRow = v.object({
  club: clubRecord,
  position: v.number(),
  played: v.number(),
  won: v.number(),
  drawn: v.number(),
  lost: v.number(),
  goalsFor: v.number(),
  goalsAgainst: v.number(),
  goalDifference: v.number(),
  points: v.number(),
});

/** The table's rows, and whether a match in it is still being played. */
const standings = v.object({ rows: v.array(tableRow), provisional: v.boolean() });
type Standings = Infer<typeof standings>;

/** The table, every current club in it, and whether a match in it is still being played. */
export const ofSeason = query({
  args: {},
  returns: standings,
  handler: async (ctx) => {
    await callerEmail(ctx);
    return standingsOf(ctx, await scoredFixtures(ctx));
  },
});

/** A current match and its newest score, null until a feed has read one. */
export type ScoredFixture = { fixture: Doc<"fixtures">; score: Doc<"matchScores"> | null };

/** The matches the feed still sends, each with its newest score: what the table counts, and what a
 *  club's page reads its matches from (clubPage.ts). */
export async function scoredFixtures(ctx: QueryCtx): Promise<ScoredFixture[]> {
  const fixtures = await currentFixtures(ctx);
  const scores = await Promise.all(fixtures.map(({ code }) => scoreOf(ctx, code)));
  return fixtures.map((fixture, index) => ({ fixture, score: scores[index] }));
}

/** The table over `scored`, every current club in it, and whether a match in it is still being
 *  played. */
export async function standingsOf(ctx: QueryCtx, scored: readonly ScoredFixture[]): Promise<Standings> {
  // Clubs level on everything share a position in the order given: the Premier League's own
  // practice is alphabetical (plTable.ts).
  const clubs = (await currentClubs(ctx))
    .map(clubOf)
    .toSorted((one, other) => one.name.localeCompare(other.name));
  const byCode = new Map(clubs.map((club) => [club.code, club]));
  const currentClubOf = (code: number, fixtureCode: number) => {
    const club = byCode.get(code);
    if (club === undefined) throw new Error(`Match ${fixtureCode} names club ${code}, which isn't a current club`);
    return club;
  };
  const results: PlResult<Club>[] = [];
  const unplayed: PlMatch<Club>[] = [];
  let provisional = false;
  // The season is over once its last gameweek's matches are all at full time: a match never
  // played then is one of `unplayed`, holding back head-to-head only for its two clubs (C.17).
  const lastGameweek = Math.max(...scored.flatMap(({ fixture: { gameweek } }) => (gameweek === null ? [] : [gameweek])));
  const seasonOver = scored.every(({ fixture: { gameweek }, score }) => gameweek !== lastGameweek || score?.state === "fullTime");
  for (const { fixture, score } of scored) {
    const { code, homeClubCode, awayClubCode } = fixture;
    const match = { home: currentClubOf(homeClubCode, code), away: currentClubOf(awayClubCode, code) };
    // A match counts once it is being played or at full time.
    if (score === null || !(isPlaying(score.state) || score.state === "fullTime")) {
      unplayed.push(match);
      continue;
    }
    // The score reads refuse a kicked-off match without both scores (scoreReads.ts), so one held
    // here is a bug, never a match to leave out.
    if (score.homeGoals === null || score.awayGoals === null) throw new Error(`Match ${code} is held at ${score.state} with no score`);
    if (isPlaying(score.state)) provisional = true;
    results.push({ ...match, homeGoals: score.homeGoals, awayGoals: score.awayGoals });
  }
  // A club's total the admin set, for a points deduction (#898).
  const season = await heldFixturesSeason(ctx);
  const overrides = new Map<Club, number>();
  for (const [clubCode, points] of season === null ? [] : await seasonPointsOverrides(ctx, season)) {
    const club = byCode.get(clubCode);
    if (club === undefined) throw new Error(`Club ${clubCode} has a total set, but isn't a current club`);
    overrides.set(club, points);
  }
  const rows = plTable(clubs, results, { competition: COMPETITION_TIE_BREAKS.premierLeague, seasonOver: seasonOver && results.length > 0, unplayed }, overrides);
  return { rows, provisional };
}
