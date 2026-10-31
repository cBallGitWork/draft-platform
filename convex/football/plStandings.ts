import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { clubRecord, matchState } from "../schema";
import { currentFixtures } from "../shared/fixtures";
import { callerEmail } from "../shared/leagueAccess";
import { clubOf, currentClubs, type Club } from "../shared/players";
import { isPlaying, scoreOf } from "./matchScores";
import { plTable, type PlResult } from "./plTable";

// The Premier League table for the section (#50; spec/18, The table: "P W D L GF GA GD Pts, worked
// out from the results. Live during matches, provisional until they are final"). The results are
// the held scores (matchScores.ts) of the matches the feed still sends: those at full time, and
// those being played, as they stand.

/** A match's states that count in the table, and which of them are still being played. */
type State = Infer<typeof matchState>;
const COUNTED_STATES: ReadonlySet<State> = new Set(["live", "halfTime", "fullTime"]);

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

/** The table, every current club in it, and whether a match in it is still being played. */
export const ofSeason = query({
  args: {},
  returns: v.object({ rows: v.array(tableRow), provisional: v.boolean() }),
  handler: async (ctx) => {
    await callerEmail(ctx);
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
    let provisional = false;
    let seasonOver = true;
    const fixtures = await currentFixtures(ctx);
    const scores = await Promise.all(fixtures.map(({ code }) => scoreOf(ctx, code)));
    for (const [index, { code, homeClubCode, awayClubCode }] of fixtures.entries()) {
      const score = scores[index];
      if (score?.state !== "fullTime") seasonOver = false;
      if (score === null || !COUNTED_STATES.has(score.state)) continue;
      // The score reads refuse a kicked-off match without both scores (scoreReads.ts), so one held
      // here is a bug, never a match to leave out.
      if (score.homeGoals === null || score.awayGoals === null) throw new Error(`Match ${code} is held at ${score.state} with no score`);
      if (isPlaying(score.state)) provisional = true;
      results.push({ home: currentClubOf(homeClubCode, code), away: currentClubOf(awayClubCode, code), homeGoals: score.homeGoals, awayGoals: score.awayGoals });
    }
    const rows = plTable(clubs, results, { seasonOver: seasonOver && results.length > 0 });
    return { rows, provisional };
  },
});
