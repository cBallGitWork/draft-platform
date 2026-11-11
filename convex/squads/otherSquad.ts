import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { clubRecord, position } from "../schema";
import { memberOf, teamIn } from "../shared/leagueAccess";
import { clubsByCode } from "../shared/players";
import { heldOrNot, squadOf } from "./squadPlace";
import { bySquadOrder, pricer, squadPoints } from "./teamSquad";

// Another team's squad, read-only, opened from its name on a player's card (Craig, 9 Nov 2026,
// #1027: "a read-only page of that team, its Squad table (players, positions, club, season
// points), with nothing changeable and no tactics shown").

const otherSquadRow = v.object({
  code: v.number(),
  name: v.string(),
  fullName: v.string(),
  positions: v.array(position),
  club: clubRecord,
  /** Left the Premier League: he stays on the team until released. */
  gone: v.boolean(),
  /** What his team got from him this season, added up as the Squad tab adds it (teamSquad.ts), or
   *  null ("—") while none of his matches has been priced. */
  seasonPoints: v.union(v.number(), v.null()),
});
export type OtherSquadRow = Infer<typeof otherSquadRow>;

const otherSquad = v.object({ teamName: v.string(), players: v.array(otherSquadRow) });
export type OtherSquad = Infer<typeof otherSquad>;

/** The team's squad, in the Squad tab's order: back to front by his first position, then by name.
 *  Anyone in the league may read it; a team outside the league is refused. */
export const ofTeam = query({
  args: { leagueId: v.id("leagues"), teamId: v.id("teams") },
  returns: otherSquad,
  handler: async (ctx, { leagueId, teamId }) => {
    const { league } = await memberOf(ctx, leagueId);
    const team = await teamIn(ctx, leagueId, teamId);
    const positionsOfNow = await positionsNow(ctx, leagueId);
    const clubs = clubsByCode(ctx);
    const price = await pricer(ctx, league, team._id);
    const { held } = await heldOrNot(ctx, await squadOf(ctx, team._id));
    const players = await Promise.all(
      held.map(async ({ player }) => {
        const positions = await positionsOfNow(player.code);
        return {
          code: player.code,
          name: player.name,
          fullName: player.fullName,
          positions,
          club: await clubs(player.clubCode),
          gone: player.droppedAt !== undefined,
          seasonPoints: squadPoints(await price(player.code, positions), null).seasonPoints,
        };
      }),
    );
    players.sort(bySquadOrder);
    return { teamName: team.name, players };
  },
});
