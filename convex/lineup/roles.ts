// The roles a slot offers (spec/05 Roles; #10; Craig, 26 Oct 2026): the default set's list for
// the position the slot stands for (pitch.ts's positionOfSlot). Each role's adjustment comes with
// the site's scoring (spec/14), not here; this is only who may be asked to play what.

import { positionOfSlot, type Cell, type SlotPosition } from "./pitch";

export interface Role {
  /** Saved with a lineup, so never renamed: a new name is a new role. */
  key: string;
  /** As managers say it, such as "Attacking full-back". */
  name: string;
}

const role = (key: string, name: string): Role => ({ key, name });

const SHADOW_STRIKER = role("shadowStriker", "Shadow striker");

/** spec/05's default set, made long before roles were built, for Craig to cut much later. */
export const DEFAULT_ROLES: Record<SlotPosition, readonly Role[]> = {
  GK: [role("shotStopper", "Shot-stopper"), role("sweeperKeeper", "Sweeper keeper")],
  FB: [role("defensiveFullBack", "Defensive full-back"), role("attackingFullBack", "Attacking full-back")],
  CB: [role("stopper", "Stopper"), role("ballPlayingDefender", "Ball-playing defender")],
  WB: [role("attackingWingBack", "Attacking wing-back"), role("holdingWingBack", "Holding wing-back")],
  CDM: [role("anchor", "Anchor"), role("deepPlaymaker", "Deep playmaker")],
  WM: [role("wideMidfielder", "Winger"), role("defensiveWinger", "Defensive winger")],
  CM: [role("boxToBox", "Box-to-box"), role("playmaker", "Playmaker"), role("ballWinner", "Ball-winner")],
  W: [role("insideForward", "Inside forward"), role("winger", "Winger")],
  CAM: [role("numberTen", "Number 10"), SHADOW_STRIKER],
  ST: [role("poacher", "Poacher"), role("targetMan", "Target man"), role("pressingForward", "Pressing forward"), SHADOW_STRIKER, role("falseNine", "False 9")],
};

/** The roles this slot offers, its first the one a player starts on until stars exist (spec/05). */
export const rolesOfSlot = (cell: Cell): readonly Role[] => DEFAULT_ROLES[positionOfSlot(cell)];

/** The role a starter plays: the one he was given, or the slot's first. */
export const roleIn = (cell: Cell, given: string | undefined): Role =>
  rolesOfSlot(cell).find(({ key }) => key === given) ?? rolesOfSlot(cell)[0];
