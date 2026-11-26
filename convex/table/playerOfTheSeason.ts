import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { fileLetter, wholeLeague } from "../mail/letters";
import { positionsNow } from "../positions/playerPositions";
import { siteScoringByGameweek } from "../scoring/siteVersions";
import { inTenths } from "../scoring/values";
import { takeAllOrThrow } from "../shared/cappedRead";
import { gameweekFixtures, heldFixturesSeason } from "../shared/fixtures";
import { lostPlayerName, playerByCode } from "../shared/players";
import { MATCH_RECORDS_MOST, matchRecordsOf } from "../stats/matchRecordReads";
import { cardMatchPoints } from "../stats/seasonPoints";
import { playerOfTheSeasonLetter } from "./awardWords";

// Player of the Season (spec/09, Awards; #2678): the player with the most points over the league's
// own gameweeks, those it scores, whoever held him (S09.5; Craig, 19 Nov 2026: "because its a draft
// player of the season"). Players level are split by the best points per game, a game every match
// he played in, off the bench too, never one he sat out as an unused substitute; any still level
// share it (Craig, 19 and 26 Nov 2026, on #2678). A match counts what his card shows for it in the
// league (seasonPoints.ts): his base points at his main position under the site's set that
// gameweek, or the league's override. It is awarded once every gameweek of the league is final
// (awards.ts's `giveAwards`), counted a gameweek a run so a season of match records never meets
// Convex's read limits, and stored in `awards`, so it is awarded and Mailed once.

/** One player's count over the league's gameweeks: his points and the matches he played in. */
const seasonTally = v.object({ playerCode: v.number(), points: v.number(), games: v.number() });
export type SeasonTally = Infer<typeof seasonTally>;

const perGame = ({ points, games }: SeasonTally) => points / games;

/** The players of the season among `tallies`: the most points, those level split by the best
 *  points per game, any still level sharing it. None while no player has played. Pure. */
export function playersOfTheSeason(tallies: readonly SeasonTally[]): SeasonTally[] {
  const played = tallies.filter(({ games }) => games > 0);
  if (played.length === 0) return [];
  const most = Math.max(...played.map(({ points }) => points));
  const level = played.filter(({ points }) => points === most);
  const best = Math.max(...level.map(perGame));
  return level.filter((tally) => perGame(tally) === best);
}

/** Starts counting the season's Player of the Season over `gameweeks`, the league's, unless the
 *  season has one already. */
export async function startPlayerOfTheSeason(ctx: MutationCtx, leagueId: Id<"leagues">, gameweeks: number[]): Promise<void> {
  const season = await heldFixturesSeason(ctx);
  if (season === null || (await seasonAwardOf(ctx, leagueId, season)) !== null) return;
  await ctx.scheduler.runAfter(0, internal.table.playerOfTheSeason.tallySeason, { leagueId, season, gameweeks, tallies: [] });
}

const seasonAwardOf = (ctx: MutationCtx, leagueId: Id<"leagues">, season: number) =>
  ctx.db
    .query("awards")
    .withIndex("by_leagueId_and_season", (q) => q.eq("leagueId", leagueId).eq("season", season))
    .first();

/** `tallies` with each match of the gameweek its players played in added. */
async function tallyGameweek(ctx: MutationCtx, leagueId: Id<"leagues">, gameweek: number, tallies: readonly SeasonTally[]): Promise<SeasonTally[]> {
  const byPlayer = new Map(tallies.map((tally) => [tally.playerCode, tally]));
  const set = (await siteScoringByGameweek(ctx))(gameweek);
  const positionsOf = await positionsNow(ctx, leagueId);
  const why = "Player of the Season would be cut short";
  for (const fixture of await gameweekFixtures(ctx, gameweek, why)) {
    const overrides = await takeAllOrThrow(
      ctx.db
        .query("pointsOverrides")
        .withIndex("by_leagueId_and_fixtureCode_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("fixtureCode", fixture.code)),
      MATCH_RECORDS_MOST,
      `League ${leagueId} holds more than ${MATCH_RECORDS_MOST} overrides for match ${fixture.code}, so ${why}`,
    );
    for (const record of await matchRecordsOf(ctx, fixture.code, why)) {
      if (record.played === false) continue;
      const priced = cardMatchPoints(record, set, await positionsOf(record.playerCode));
      if (priced === null) continue;
      const points = overrides.find((each) => each.playerCode === record.playerCode)?.points ?? priced;
      const before = byPlayer.get(record.playerCode) ?? { playerCode: record.playerCode, points: 0, games: 0 };
      byPlayer.set(record.playerCode, { ...before, points: inTenths(before.points + points), games: before.games + 1 });
    }
  }
  return [...byPlayer.values()];
}

/** Counts the first of `gameweeks` into `tallies` and runs on to the rest; after the last, stores a
 *  row for each Player of the Season and Mails the whole league. Run by `startPlayerOfTheSeason`. */
export const tallySeason = internalMutation({
  args: { leagueId: v.id("leagues"), season: v.number(), gameweeks: v.array(v.number()), tallies: v.array(seasonTally) },
  returns: v.null(),
  handler: async (ctx, { leagueId, season, gameweeks, tallies }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null || (await seasonAwardOf(ctx, leagueId, season)) !== null) return null;
    const [gameweek, ...rest] = gameweeks;
    const counted = gameweek === undefined ? tallies : await tallyGameweek(ctx, leagueId, gameweek, tallies);
    if (rest.length > 0) {
      await ctx.scheduler.runAfter(0, internal.table.playerOfTheSeason.tallySeason, { leagueId, season, gameweeks: rest, tallies: counted });
      return null;
    }
    const winners = playersOfTheSeason(counted);
    if (winners.length === 0) return null;
    const awardedAt = Date.now();
    for (const { playerCode, points, games } of winners) await ctx.db.insert("awards", { leagueId, season, playerCode, points, games, awardedAt });
    const names = await Promise.all(winners.map(async ({ playerCode }) => (await playerByCode(ctx, playerCode))?.name ?? lostPlayerName(playerCode)));
    const [{ points, games }] = winners;
    await fileLetter(ctx, league, "league", await wholeLeague(ctx, league), playerOfTheSeasonLetter(names, points, games));
    return null;
  },
});
