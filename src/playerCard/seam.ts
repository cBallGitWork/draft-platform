// The seam for a player's card (#381): what the screen reads. Convex fills it in live
// (livePlayerCard.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { PlayedMatch, PlayerCard } from "../../convex/playerCard/playerCard";
import type { CardAction } from "../../convex/waivers/waivers";
import type { Change } from "../shared/refusal";
import type { ShortlistSeam } from "../scouting/shortlist/seam";

export type { CardAction, PlayedMatch, PlayerCard };

/** One player's points in one match, set by whoever runs the league (#32). */
export type PointsOverride = { fixtureCode: number; playerCode: number; points: number; reason: string };

/** The card's waiver changes (#1200, spec/08): `dropCode` is who goes with a claim or a pickup, or
 *  null for nobody. */
export type WaiverChanges = {
  drop(leagueId: Id<"leagues">, playerCode: number): Change;
  claim(leagueId: Id<"leagues">, playerCode: number, dropCode: number | null): Change;
  pickUp(leagueId: Id<"leagues">, playerCode: number, dropCode: number | null): Change;
};

/** His card, the manager's shortlist for the card's shortlist action, his waiver action, and the
 *  override for whoever runs the league. */
export type PlayerCardSeam = ShortlistSeam & {
  /** What the card offers the manager on him, live (a hook): undefined while it loads. */
  useCardAction(leagueId: Id<"leagues">, playerCode: number): CardAction | undefined;
  /** The drop, the claim and the pickup (a hook). */
  useWaiverChanges(): WaiverChanges;
  /** His card at `now`, live (a hook): undefined while it loads, null for a code no feed holds. */
  usePlayerCard(leagueId: Id<"leagues">, playerCode: number, now: number): PlayerCard | null | undefined;
  /** Overriding a player's points in a match (a hook). */
  useOverride(): (leagueId: Id<"leagues">, override: PointsOverride) => Change;
};
