import { v, type Infer } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import { turnsInHour } from "../gameweeks/hourAnswers";
import { lastSeasonCopied, pastRowsOf } from "../pastSeasons/pastSeasonPoints";
import { inForceAt, setOf, siteScoringByGameweek, siteVersions } from "../scoring/siteVersions";
import { managerOf } from "../shared/leagueAccess";
import { clubsByCode, playerByCode } from "../shared/players";
import { isWhole, MINUTES_STAT, statValue } from "../stats/matchRecords";
import { seasonRecords } from "../stats/seasonRecords";
import { heldPositionsOf } from "./lineups";
import { cellShape } from "./pitchShape";
import { cardRolesOf, pricedMatch, ROLE_CARD_MATCHES, roleCardShape, type MatchToPrice } from "./roleCardShape";

// A player's role card for a slot (spec/05 Roles; #848): every role the slot offers in the
// formation, each with its description, what it scores more and less for, and what he would have
// scored under it in his last ROLE_CARD_MATCHES matches played, against his base points. Craig, 6
// Nov 2026, on #848: his last 5 matches played, cameos included, at any Premier League club, with
// last season's filling in once recorded. Each of this season's matches is priced under the site's
// set its gameweek was scored under; last season's under the set in force now, as his card prices
// them (playerCard.ts).

/** The card through an hour: one from its start, and another from each scoring version taking
 *  effect inside it (hourAnswers.ts's `answerAt` picks the minute's). */
const roleCardInHour = v.array(v.object({ from: v.number(), card: roleCardShape }));
export type RoleCardInHour = Infer<typeof roleCardInHour>;

/** The card for `playerCode` in `cell` of `formation` (the eleven's cells), through the hour
 *  starting at `hour`. It takes the hour, never the minute, so an open card isn't run again,
 *  uncached, every minute (#2008). Refused for anyone who runs no team in the league. */
export const forSlot = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), cell: cellShape, formation: v.array(cellShape), hour: v.number() },
  returns: roleCardInHour,
  handler: async (ctx, { leagueId, playerCode, cell, formation, hour }): Promise<RoleCardInHour> => {
    await managerOf(ctx, leagueId);
    const positions = (await heldPositionsOf(ctx, leagueId, [playerCode])).get(playerCode) ?? [];
    const versions = await siteVersions(ctx);
    const { thisSeason, past } = await lastMatchesPlayed(ctx, playerCode);
    return turnsInHour(
      versions.map(({ takesEffectAt }) => takesEffectAt),
      hour,
    ).map((from) => {
      const set = setOf(inForceAt(versions, from));
      const roles = cardRolesOf(cell, formation, positions, set);
      const matches = [...thisSeason, ...past.map((match) => ({ ...match, set }))];
      return { from, card: { roles, matches: matches.map((match) => pricedMatch(match, cell, roles.map(({ key }) => key))) } };
    });
  },
});

/** His newest ROLE_CARD_MATCHES matches played, cameos included, newest first: this season's
 *  final ones (locked or complete, his whole record in), at whichever club, then last season's
 *  copied matches to fill, still to be given the set in force. */
async function lastMatchesPlayed(ctx: QueryCtx, playerCode: number): Promise<{ thisSeason: MatchToPrice[]; past: Omit<MatchToPrice, "set">[] }> {
  const setIn = await siteScoringByGameweek(ctx);
  const clubs = clubsByCode(ctx);
  const currentClub = (await playerByCode(ctx, playerCode))?.clubCode ?? null;
  const played = (await seasonRecords(ctx, playerCode))
    .filter(({ record }) => record.state !== "provisional" && isWhole(record) && (statValue(record, MINUTES_STAT) ?? 0) > 0)
    .toSorted((one, other) => (other.fixture.kickoff ?? 0) - (one.fixture.kickoff ?? 0))
    .slice(0, ROLE_CARD_MATCHES);
  const thisSeason: MatchToPrice[] = [];
  for (const { record, fixture, gameweek } of played) {
    // The club he played it for, kept with his record since #502; his club now for an older one.
    const clubCode = record.clubCode ?? currentClub;
    const home = clubCode === fixture.homeClubCode;
    const opponent = clubCode === null ? null : { club: await clubs(home ? fixture.awayClubCode : fixture.homeClubCode), home };
    thisSeason.push({ stats: record.stats, set: setIn(gameweek), gameweek, pastSeason: null, opponent });
  }
  if (thisSeason.length === ROLE_CARD_MATCHES) return { thisSeason, past: [] };
  const season = await lastSeasonCopied(ctx);
  if (season === null) return { thisSeason, past: [] };
  const past = (await pastRowsOf(ctx, season, playerCode))
    .flatMap(({ match }) => (match !== null && (match.stats[MINUTES_STAT] ?? 0) > 0 ? [match] : []))
    .toSorted((one, other) => other.kickoff - one.kickoff)
    .slice(0, ROLE_CARD_MATCHES - thisSeason.length);
  return { thisSeason, past: past.map(({ stats }) => ({ stats, gameweek: null, pastSeason: season, opponent: null })) };
}
