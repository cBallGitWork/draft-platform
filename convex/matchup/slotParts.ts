import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { positionOfSlot } from "../lineup/pitch";
import { namedRole, roleIn, type Role } from "../lineup/roles";
import type { SlotPoints } from "../scoring/teamPoints";
import { playerByCode } from "../shared/players";
import { shirtNumber } from "../squads/squadNumbers";
import { placeOf as squadPlaceOf } from "../squads/squadPlace";
import type { MatchupPlace, MatchupSlot } from "./matchupShape";

// The parts of a matchup slot that matchup.ts reads beside the scorer's points: his role, his
// place, his shirt, and his matches in kickoff order.

/** The role the scorer priced him in at his cell, so the matchup and the table never disagree. Its
 *  run is read from the role set at his place (spec/05 Runs), so only its key is sent. */
export function pricedRole({ playerCode, cell, role }: SlotPoints): Pick<Role, "key" | "name"> {
  if (role === undefined) throw new Error(`player ${playerCode} plays at ${cell.area} ${cell.lane}, which has no roles`);
  return namedRole(roleIn(cell, role));
}

/** The slot he plays in: its lane and its position label, as the Tactics pitch labels it. */
export const placeOf = ({ cell }: SlotPoints): MatchupPlace => ({ lane: cell.lane, label: positionOfSlot(cell) });

/** His shirt on the matchup's pitch (#1026): his club, whose colours it wears, and the number his
 *  manager gave him while the side's team still holds him, else his club's (squadNumbers.ts). */
export async function shirtOf(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  playerCode: number,
  teamId: Id<"teams">,
): Promise<Pick<MatchupSlot, "clubCode" | "number">> {
  const player = await playerByCode(ctx, playerCode);
  const place = await squadPlaceOf(ctx, leagueId, playerCode);
  return {
    clubCode: player?.clubCode ?? null,
    number: await shirtNumber(ctx, { playerCode, number: place?.teamId === teamId ? place.number : undefined }),
  };
}

type KicksOff = { kickoff: number | null };

/** Two matches in kickoff order, any with no time yet last. */
export const byKickoffOrder = (one: KicksOff, other: KicksOff) =>
  (one.kickoff === null ? 1 : 0) - (other.kickoff === null ? 1 : 0) || (one.kickoff ?? 0) - (other.kickoff ?? 0);

/** Matches by kickoff, any with no time yet last. */
export const byKickoff = <Fixture extends KicksOff>(fixtures: readonly Fixture[]): Fixture[] => fixtures.toSorted(byKickoffOrder);
