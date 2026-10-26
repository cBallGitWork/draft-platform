import { FIRST_GAMEWEEK } from "../../convex/gameweeks/usedGameweeks";
import type { FirstKickoff } from "./seam";

/** The gameweek the fixtures open on, the current one (spec/18): the latest whose first match has
 *  kicked off by `now`, or before any has, the first to come; with no kickoff times held, the
 *  season's first. `firstKickoffs` are in gameweek order. */
export function openingGameweek(firstKickoffs: readonly FirstKickoff[], now: number): number {
  const begun = firstKickoffs.findLast(({ firstKickoff }) => firstKickoff <= now);
  return (begun ?? firstKickoffs[0])?.gameweek ?? FIRST_GAMEWEEK;
}
