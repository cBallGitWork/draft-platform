import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { clubRecord, position } from "../schema";
import { memberOf } from "../shared/leagueAccess";
import { clubByCode, clubOf, heldPlayerByCode } from "../shared/players";
import { ownerOf } from "../squads/squadPlace";
import { MINUTES_STAT } from "../stats/matchRecords";
import { COMPARED_PLAYERS } from "./comparedPlayers";
import { per90Figure, weigher } from "./per90";
import { per90FiguresIn } from "./per90Figures";
import { shownSeasonPoints } from "./shownSeasonPoints";

// Two players side by side (spec/19, The players list: "Two players side by side, to compare";
// #373; the approved picture's compare, #1028), for anyone in the league: who each is and who owns
// him here, his season points (the players list's, seasonPoints.ts), his minutes, and each stat of
// the first player's area with his total, per 90 and percentile against that area, weighed as the
// selected player's panel weighs him (per90.ts). Every stat is open to everyone (spec/19).

const comparedPlayer = v.object({
  code: v.number(),
  name: v.string(),
  fullName: v.string(),
  club: clubRecord,
  positions: v.array(position),
  /** The team in this league that owns him, or null for a free agent. */
  ownerTeamName: v.union(v.string(), v.null()),
  /** His points under the site's scoring, as on the players list: last season's before the new
   *  season's first match (shownSeasonPoints.ts), or null ("—") while none is priced. */
  seasonPoints: v.union(v.number(), v.null()),
  /** His minutes over the per-90 figures' period (per90.ts). */
  minutes: v.number(),
  /** His per-90 figures (per90.ts) for the first player's area's stats and the list's stat, ranked
   *  against that area, so the two line up row by row; none while the first has no position. */
  figures: v.array(per90Figure),
});
export type ComparedPlayer = Infer<typeof comparedPlayer>;

const comparison = v.array(comparedPlayer);
export type Comparison = Infer<typeof comparison>;

/** The players with these codes, in that order, side by side, with their per-90 figures for the
 *  first's area and `stat` (the list's, or null). Anyone not in the league is refused, as is asking
 *  for other than two players, the same one twice, one the football sync doesn't hold, or a stat
 *  neither the catalogue nor the site's set holds. */
export const players = query({
  args: { leagueId: v.id("leagues"), codes: v.array(v.number()), stat: v.union(v.string(), v.null()) },
  returns: comparison,
  handler: async (ctx, { leagueId, codes, stat }): Promise<Comparison> => {
    await memberOf(ctx, leagueId);
    if (codes.length !== COMPARED_PLAYERS || new Set(codes).size !== COMPARED_PLAYERS) {
      throw new Error(`Compare ${COMPARED_PLAYERS} different players, not ${codes.join(", ")}`);
    }
    const positionsOfNow = await positionsNow(ctx, leagueId);
    const { pointsOf: seasonPointsOf } = await shownSeasonPoints(ctx, leagueId, codes);
    const ownerOfCode = await ownerOf(ctx, leagueId);
    const { weighed, ranked } = await weigher(ctx, leagueId, stat);
    const { area } = await weighed(codes[0]);
    return Promise.all(
      codes.map(async (code) => {
        const player = await heldPlayerByCode(ctx, code, `No player ${code} is held to compare`);
        const positions = await positionsOfNow(code);
        const { totals } = await weighed(code);
        return {
          code,
          name: player.name,
          fullName: player.fullName,
          club: clubOf(await clubByCode(ctx, player.clubCode)),
          positions,
          ownerTeamName: (await ownerOfCode(code))?.name ?? null,
          seasonPoints: seasonPointsOf(code, positions),
          minutes: totals[MINUTES_STAT] ?? 0,
          figures: area === null ? [] : per90FiguresIn(area, totals, ranked, stat),
        };
      }),
    );
  },
});
