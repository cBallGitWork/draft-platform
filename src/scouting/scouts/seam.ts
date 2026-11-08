// The seam for a team's scouts (#375, spec/19 Scouts): what the player card reads and asks of them,
// and Scouting's Scouts panel once it is drawn. Convex fills it in live (liveScouts.ts); the preview
// and the tests hand the screens their own.

import type { Id } from "../../../convex/_generated/dataModel";
import type { MyScouts, ScoutTrip } from "../../../convex/scouting/scouts";
import type { Change } from "../../shared/refusal";

export type { MyScouts, ScoutTrip };

export type ScoutsSeam = {
  /** The manager's own scouts in the league: how many, those out, and the team's reports, live (a
   *  hook). Undefined while it loads, null for someone who runs no team there. */
  useMyScouts(leagueId: Id<"leagues">): MyScouts | null | undefined;
  /** His team's scouts' trips to one player, newest first, live (a hook). Undefined while it loads,
   *  null for someone who runs no team there. */
  useScoutsOn(leagueId: Id<"leagues">, playerCode: number): readonly ScoutTrip[] | null | undefined;
  /** Sending one of his scouts to a player (a hook). */
  useSendScout(): (leagueId: Id<"leagues">, playerCode: number) => Change;
};
