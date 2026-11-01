import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { seasonRecords } from "../stats/seasonRecords";
import { positionsNow, type PositionsNow } from "../positions/playerPositions";
import { clubRecord, position } from "../schema";
import { memberOf } from "../shared/leagueAccess";
import { clubByCode, clubOf, heldPlayerByCode } from "../shared/players";
import { ownerOf } from "../squads/squadPlace";
import { isWhole } from "../stats/matchRecords";
import { seasonPointsIn, type SeasonPointsOf } from "../stats/seasonPoints";
import { sumStats } from "../stats/statTotals";
import { COMPARED_PLAYERS } from "./comparedPlayers";

// Two players side by side (spec/19, The players list: "Two players side by side, to compare";
// #373), for anyone in the league: who each is and who owns him here, and his stats this season
// added up, from the same matches his card lists (seasonRecords), a record counting once whole as
// the card prices it (both feeds in, or an unused substitute). Every stat is open to everyone
// (spec/19). Season points are the players list's (seasonPoints.ts).

const comparedPlayer = v.object({
  code: v.number(),
  name: v.string(),
  fullName: v.string(),
  club: clubRecord,
  positions: v.array(position),
  /** The team in this league that owns him, or null for a free agent. */
  ownerTeamName: v.union(v.string(), v.null()),
  /** His points this season under the site's scoring, as on the players list, or null ("—") while
   *  none of his matches is priced. */
  seasonPoints: v.union(v.number(), v.null()),
  /** This season's matches he was in. */
  matches: v.number(),
  /** His stats this season added up from his whole records, by the name the merged record keeps
   *  each under; a stat left out is 0. */
  stats: v.record(v.string(), v.number()),
});
export type ComparedPlayer = Infer<typeof comparedPlayer>;

const comparison = v.array(comparedPlayer);
export type Comparison = Infer<typeof comparison>;

/** The players with these codes, in that order, side by side. Anyone not in the league is
 *  refused, as is asking for other than two players, the same one twice, or one the football sync
 *  doesn't hold. */
export const players = query({
  args: { leagueId: v.id("leagues"), codes: v.array(v.number()) },
  returns: comparison,
  handler: async (ctx, { leagueId, codes }) => {
    await memberOf(ctx, leagueId);
    if (codes.length !== COMPARED_PLAYERS || new Set(codes).size !== COMPARED_PLAYERS) {
      throw new Error(`Compare ${COMPARED_PLAYERS} different players, not ${codes.join(", ")}`);
    }
    const positionsOfNow = await positionsNow(ctx, leagueId);
    const seasonPointsOf = await seasonPointsIn(ctx, leagueId, codes);
    return Promise.all(codes.map((code) => compared(ctx, leagueId, code, positionsOfNow, seasonPointsOf)));
  },
});

async function compared(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  code: number,
  positionsOfNow: PositionsNow,
  seasonPointsOf: SeasonPointsOf,
): Promise<ComparedPlayer> {
  const player = await heldPlayerByCode(ctx, code, `No player ${code} is held to compare`);
  const club = await clubByCode(ctx, player.clubCode);
  const season = await seasonRecords(ctx, code);
  const positions = await positionsOfNow(code);
  return {
    code,
    name: player.name,
    fullName: player.fullName,
    club: clubOf(club),
    positions,
    ownerTeamName: (await (await ownerOf(ctx, leagueId))(code))?.name ?? null,
    seasonPoints: seasonPointsOf(code, positions),
    matches: season.length,
    stats: sumStats(season.filter(({ record }) => isWhole(record)).map(({ record }) => record.stats)),
  };
}
