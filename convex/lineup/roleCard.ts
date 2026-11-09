import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import { lastSeasonCopied, pastRowsOf } from "../pastSeasons/pastSeasonPoints";
import { siteScoringAt, siteScoringByGameweek } from "../scoring/siteVersions";
import { managerOf } from "../shared/leagueAccess";
import { clubsByCode, playerByCode } from "../shared/players";
import { isWhole, MINUTES_STAT, statValue } from "../stats/matchRecords";
import { seasonRecords } from "../stats/seasonRecords";
import { cellShape } from "./pitchShape";
import { cardRolesOf, pricedMatch, ROLE_CARD_MATCHES, roleCardShape, type MatchToPrice } from "./roleCardShape";

// A player's role card for a slot (spec/05 Roles; #848): every role the slot offers in the
// formation, each with its description, what it scores more and less for, and what he would have
// scored under it in his last ROLE_CARD_MATCHES matches played, against his base points. Craig, 6
// Nov 2026, on #848: his last 5 matches played, cameos included, at any Premier League club, with
// last season's filling in once recorded. Each of this season's matches is priced under the site's
// set its gameweek was scored under; last season's under the set in force now, as his card prices
// them (playerCard.ts).

/** The card for `playerCode` in `cell` of `formation` (the eleven's cells), as it stands at `now`
 *  (the screen's minute: a query may not read the clock). Refused for anyone who runs no team in
 *  the league. */
export const forSlot = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), cell: cellShape, formation: v.array(cellShape), now: v.number() },
  returns: roleCardShape,
  handler: async (ctx, { leagueId, playerCode, cell, formation, now }) => {
    await managerOf(ctx, leagueId);
    const roles = cardRolesOf(cell, formation, await siteScoringAt(ctx, now));
    const matches = await lastMatchesPlayed(ctx, playerCode, now);
    return { roles, matches: matches.map((match) => pricedMatch(match, cell, roles.map(({ key }) => key))) };
  },
});

/** His newest ROLE_CARD_MATCHES matches played, cameos included, newest first: this season's
 *  final ones (locked or complete, his whole record in), at whichever club, then last season's
 *  copied matches to fill. */
async function lastMatchesPlayed(ctx: QueryCtx, playerCode: number, now: number): Promise<MatchToPrice[]> {
  const setIn = await siteScoringByGameweek(ctx);
  const clubs = clubsByCode(ctx);
  const currentClub = (await playerByCode(ctx, playerCode))?.clubCode ?? null;
  const played = (await seasonRecords(ctx, playerCode))
    .filter(({ record }) => record.state !== "provisional" && isWhole(record) && (statValue(record, MINUTES_STAT) ?? 0) > 0)
    .toSorted((one, other) => (other.fixture.kickoff ?? 0) - (one.fixture.kickoff ?? 0))
    .slice(0, ROLE_CARD_MATCHES);
  const matches: MatchToPrice[] = [];
  for (const { record, fixture, gameweek } of played) {
    // The club he played it for, kept with his record since #502; his club now for an older one.
    const clubCode = record.clubCode ?? currentClub;
    const home = clubCode === fixture.homeClubCode;
    const opponent = clubCode === null ? null : { club: await clubs(home ? fixture.awayClubCode : fixture.homeClubCode), home };
    matches.push({ stats: record.stats, set: setIn(gameweek), gameweek, pastSeason: null, opponent });
  }
  if (matches.length === ROLE_CARD_MATCHES) return matches;
  const season = await lastSeasonCopied(ctx);
  if (season === null) return matches;
  const set = await siteScoringAt(ctx, now);
  const past = (await pastRowsOf(ctx, season, playerCode))
    .flatMap(({ match }) => (match !== null && (match.stats[MINUTES_STAT] ?? 0) > 0 ? [match] : []))
    .toSorted((one, other) => other.kickoff - one.kickoff)
    .slice(0, ROLE_CARD_MATCHES - matches.length);
  return [...matches, ...past.map(({ stats }) => ({ stats, set, gameweek: null, pastSeason: season, opponent: null }))];
}
