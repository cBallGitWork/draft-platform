// What a starter's chip on the pitch carries (spec/05 What the pitch shows; #845): one read, so
// the pitch draws from it and tests can poke it. His slot's position picks the area's colour, the
// role he plays gives its code and his stars for it, and his club's matches in the gameweek being
// picked are his opponents: two in a double gameweek, none in a blank one.

import { positionOfSlot, type Cell, type SlotPosition } from "../../../../convex/lineup/pitch";
import { roleIn } from "../../../../convex/lineup/roles";
import { starsIn } from "../../../../convex/stars/bestRole";
import type { Stars } from "../../../../convex/stars/starsShape";
import type { SquadRow } from "../../../../convex/squads/teamSquad";
import type { SquadMember } from "../lineupDraft";

export type Opponent = SquadRow["nextFixtures"][number];

export interface PitchChip {
  /** The position his slot stands for, whose area colours the chip. */
  position: SlotPosition;
  /** The role's short code, at most three letters, and its name for the hover. */
  code: string;
  roleName: string;
  stars: Stars;
  /** His club's matches in this gameweek, soonest first; undefined while they load. */
  opponents: readonly Opponent[] | undefined;
}

/** A starter's chip: `cell` and `role` are where he stands and the role he was given, `season` his
 *  row on the Squad tab's read (undefined while it loads, null where it holds none), `gameweek` the
 *  one his lineup is being picked for. */
export function pitchChipOf({
  cell,
  role,
  player,
  season,
  gameweek,
}: {
  cell: Cell;
  role: string | undefined;
  player: Pick<SquadMember, "stars">;
  season: Pick<SquadRow, "nextFixtures"> | null | undefined;
  gameweek: number;
}): PitchChip {
  const played = roleIn(cell, role);
  return {
    position: positionOfSlot(cell),
    code: played.code,
    roleName: played.name,
    stars: starsIn(cell, played.key, player.stars),
    opponents: season === undefined ? undefined : (season?.nextFixtures ?? []).filter((match) => match.gameweek === gameweek),
  };
}
