// The seam for a league's squads (#31): what the screen reads and asks of them. Convex fills it in
// live (liveSquads.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { FoundPlayer, TeamSquad } from "../../convex/squads/squads";
import type { Change } from "../shared/refusal";

export type { FoundPlayer, TeamSquad };

export type SquadsSeam = {
  /** Each team's squad and its warnings, live (a hook): undefined while they load. */
  useSquads(leagueId: Id<"leagues">): readonly TeamSquad[] | undefined;
  /** The players whose name matches `text`, live (a hook): undefined while they load, and none
   *  for blank text. */
  useFoundPlayers(leagueId: Id<"leagues">, text: string): readonly FoundPlayer[] | undefined;
  assign(leagueId: Id<"leagues">, playerCode: number, teamId: Id<"teams">): Change;
  move(leagueId: Id<"leagues">, playerCode: number, teamId: Id<"teams">): Change;
  release(leagueId: Id<"leagues">, playerCode: number): Change;
};
