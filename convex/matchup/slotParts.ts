import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { positionOfSlot } from "../lineup/pitch";
import { namedRole, roleIn, type Role } from "../lineup/roles";
import type { SlotPoints } from "../scoring/teamPoints";
import { shirtNumber } from "../squads/squadNumbers";
import { placeOf as squadPlaceOf } from "../squads/squadPlace";
import type { MatchBreakdown, MatchupPlace, MatchupSlot } from "./matchupShape";

// The parts of a matchup slot that matchup.ts reads beside the scorer's points: his role, his
// place, his shirt, how his breakdown names each match, and his matches in kickoff order.

/** The role the scorer priced him in at his cell, so the matchup and the table never disagree. Its
 *  run is read from the role set at his place (spec/05 Runs), so only its key is sent. */
export function pricedRole({ playerCode, cell, role }: SlotPoints): Pick<Role, "key" | "name"> {
  if (role === undefined) throw new Error(`player ${playerCode} plays at ${cell.area} ${cell.lane}, which has no roles`);
  return namedRole(roleIn(cell, role));
}

/** The slot he plays in: its lane and its position label, as the Tactics pitch labels it. */
export const placeOf = ({ cell }: SlotPoints): MatchupPlace => ({ lane: cell.lane, label: positionOfSlot(cell) });

/** His shirt on the matchup's pitch (#1026): his club, whose colours it wears, and the number his
 *  manager gave him while the side's team still holds him, else his club's (squadNumbers.ts).
 *  `player` is his row as the matchup already read it, null for one the football sync doesn't hold. */
export async function shirtOf(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  playerCode: number,
  player: Pick<Doc<"players">, "clubCode"> | null,
  teamId: Id<"teams">,
): Promise<Pick<MatchupSlot, "clubCode" | "number">> {
  const place = await squadPlaceOf(ctx, leagueId, playerCode);
  return {
    clubCode: player?.clubCode ?? null,
    number: await shirtNumber(ctx, { playerCode, number: place?.teamId === teamId ? place.number : undefined }),
  };
}

/** The log when the football sync doesn't hold a match's club, so his breakdown names it by kickoff. */
export const missingClubLog = (fixtureCode: number, clubCode: number) =>
  `match ${fixtureCode}'s club ${clubCode} isn't in the football sync, so the matchup's breakdown names the match by its kickoff`;

/** A match as his breakdown names it (#1026, "NFO 1–0 BRE 67'"): its clubs' short names, null for
 *  one the football sync doesn't hold (logged, so a missing club is never silent), and its score
 *  and clock as the newest read gives them, null before any. */
export async function namedMatch(
  fixture: Pick<Doc<"fixtures">, "code" | "homeClubCode" | "awayClubCode">,
  club: (code: number) => Promise<Doc<"clubs"> | null>,
  score: (fixtureCode: number) => Promise<Doc<"matchScores"> | null>,
): Promise<Pick<MatchBreakdown, "home" | "away" | "score">> {
  const read = await score(fixture.code);
  const shortName = async (clubCode: number) => {
    const held = await club(clubCode);
    if (held === null) console.warn(missingClubLog(fixture.code, clubCode));
    return held?.shortName ?? null;
  };
  return {
    home: await shortName(fixture.homeClubCode),
    away: await shortName(fixture.awayClubCode),
    score:
      read === null
        ? null
        : { state: read.state, homeGoals: read.homeGoals, awayGoals: read.awayGoals, minutes: read.minutes, clockLabel: read.clockLabel },
  };
}

type KicksOff = { kickoff: number | null };

/** Two matches in kickoff order, any with no time yet last. */
export const byKickoffOrder = (one: KicksOff, other: KicksOff) =>
  (one.kickoff === null ? 1 : 0) - (other.kickoff === null ? 1 : 0) || (one.kickoff ?? 0) - (other.kickoff ?? 0);

/** Matches by kickoff, any with no time yet last. */
export const byKickoff = <Fixture extends KicksOff>(fixtures: readonly Fixture[]): Fixture[] => fixtures.toSorted(byKickoffOrder);
