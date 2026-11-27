import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { teamColours } from "../leagues/teamColours";
import { positionsNow } from "../positions/playerPositions";
import { clubRecord, position } from "../schema";
import { memberOf, teamIn } from "../shared/leagueAccess";
import { clubsByCode } from "../shared/players";
import { heldOrNot, squadOf } from "./squadPlace";
import { seasonPointsIn } from "../stats/seasonPoints";
import { awardsOfTeam } from "../table/awards";
import { bySquadOrder } from "./teamSquad";

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
  /** His season points, as the Squad tab, his card and Scouting add them up (seasonPoints.ts), or
   *  null ("—") while none of his matches has been priced. */
  seasonPoints: v.union(v.number(), v.null()),
});

/** `colours`: its colours, first to third (spec/12 S12.32), none while it holds none; `awards`:
 *  the months it was Manager of the Month in, as "2026-10", oldest first (S09.8). */
const otherSquad = v.object({ teamName: v.string(), colours: teamColours, players: v.array(otherSquadRow), awards: v.array(v.string()) });
export type OtherSquad = Infer<typeof otherSquad>;

/** The team's squad, in the Squad tab's order: back to front by his first position, then by name.
 *  Anyone in the league may read it; a team outside the league is refused. */
export const ofTeam = query({
  args: { leagueId: v.id("leagues"), teamId: v.id("teams") },
  returns: otherSquad,
  handler: async (ctx, { leagueId, teamId }) => {
    await memberOf(ctx, leagueId);
    const team = await teamIn(ctx, leagueId, teamId);
    const positionsOfNow = await positionsNow(ctx, leagueId);
    const clubs = clubsByCode(ctx);
    const { held } = await heldOrNot(ctx, await squadOf(ctx, team._id));
    const seasonPointsOf = await seasonPointsIn(ctx, leagueId, held.map(({ player }) => player.code));
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
          seasonPoints: seasonPointsOf(player.code, positions),
        };
      }),
    );
    players.sort(bySquadOrder);
    return { teamName: team.name, colours: team.colours ?? [], players, awards: await awardsOfTeam(ctx, team._id) };
  },
});
