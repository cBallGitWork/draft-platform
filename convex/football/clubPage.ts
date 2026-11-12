import { v } from "convex/values";
import { query } from "../_generated/server";
import { clubRecord, scoreRead } from "../schema";
import { memberOf } from "../shared/leagueAccess";
import { clubOf, findClubByCode, type Club } from "../shared/players";
import { RESULTS } from "../table/standings";
import { clubPageOf, type HeldMatch } from "./clubFixtures";
import { scoreOnly } from "./matchScores";
import { scoredFixtures, standingsOf } from "./plStandings";

// A real club's page under Football (#1936; spec/18, Club pages): its header (`S18.7`: its table
// place, its last five results and its next match as an opponent card) and its Fixtures tab
// (`S18.9`), one read per club and league. The league is the one the app is in: only its members
// read it.

const form = v.array(v.union(...RESULTS.map((result) => v.literal(result))));

const clubFixture = v.object({
  fixtureCode: v.number(),
  /** Null while a postponed match waits for a new date. */
  gameweek: v.union(v.number(), v.null()),
  kickoff: v.union(v.number(), v.null()),
  atHome: v.boolean(),
  opponent: clubRecord,
  /** Null until a feed's read has given its score; home's goals first. */
  score: v.union(scoreRead.omit("fixtureCode"), v.null()),
});

const clubPage = v.object({
  club: clubRecord,
  /** Its place in the table; null for a club no longer in it. */
  position: v.union(v.number(), v.null()),
  form,
  /** Its next match, and the opponent's place and form; null when none is left. */
  next: v.union(clubFixture.extend({ kickoff: v.number(), opponentPosition: v.union(v.number(), v.null()), opponentForm: form }), v.null()),
  /** Its matches this season, in kickoff order, any with no time yet last. */
  fixtures: v.array(clubFixture),
});

/** The club with `clubCode` as its page shows it; null while no club with the code is held. */
export const ofClub = query({
  args: { leagueId: v.id("leagues"), clubCode: v.number() },
  returns: v.union(clubPage, v.null()),
  handler: async (ctx, { leagueId, clubCode }) => {
    await memberOf(ctx, leagueId);
    const held = await findClubByCode(ctx, clubCode);
    if (held === null) return null;
    const scored = await scoredFixtures(ctx);
    const { rows } = await standingsOf(ctx, scored);
    // Every club a current match names is a current club, in the table: standingsOf throws otherwise.
    const tableClubs = new Map(rows.map(({ club, position }) => [club.code, { club, position }]));
    const clubIn = (code: number): Club => {
      const row = tableClubs.get(code);
      if (row === undefined) throw new Error(`A current match names club ${code}, which isn't in the table`);
      return row.club;
    };
    const matches: HeldMatch[] = scored.map(({ fixture, score }) => ({
      fixtureCode: fixture.code,
      gameweek: fixture.gameweek,
      kickoff: fixture.kickoff,
      home: clubIn(fixture.homeClubCode),
      away: clubIn(fixture.awayClubCode),
      score: score === null ? null : scoreOnly(score),
    }));
    return clubPageOf(clubOf(held), matches, (code) => tableClubs.get(code)?.position ?? null);
  },
});
