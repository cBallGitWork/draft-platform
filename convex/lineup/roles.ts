// The roles a slot offers (spec/05 Roles; #10; Craig, 26 Oct 2026): the default set's list for
// the position the slot stands for (pitch.ts's positionOfSlot), and in the defence's centre cell
// the sweeper's roles too (spec/05 The pitch; #844; Craig, 31 Oct 2026). Each role's adjustment
// comes with the site's scoring (spec/14), not here; this is only who may be asked to play what.

import { positionOfSlot, sameCell, type Cell, type SlotPosition } from "./pitch";

export interface Role {
  /** Saved with a lineup, so never renamed: a new name is a new role. */
  key: string;
  /** As managers say it, such as "Attacking full-back". */
  name: string;
}

const role = (key: string, name: string): Role => ({ key, name });

const SHADOW_STRIKER = role("shadowStriker", "Shadow striker");

/** The sweeper's label. Only a slot's label, never a SlotPosition: no rule prices it, as spec/14
 *  prices a sweeper's slot as CB. */
export const SWEEPER = "SW";

/** What a slot is labelled on the pitch: its position, or SW for a sweeper (spec/05 What the pitch
 *  shows). */
export type SlotLabel = SlotPosition | typeof SWEEPER;

/** The one cell a sweeper plays: there is no sweeper row (spec/05 The pitch). */
export const SWEEPER_CELL: Cell = { area: "defence", lane: "centre" };

/** spec/05's default set, made long before roles were built, for Craig to cut much later. */
export const DEFAULT_ROLES: Record<SlotLabel, readonly Role[]> = {
  GK: [role("shotStopper", "Shot-stopper"), role("sweeperKeeper", "Sweeper keeper")],
  FB: [role("defensiveFullBack", "Defensive full-back"), role("attackingFullBack", "Attacking full-back")],
  CB: [role("stopper", "Stopper"), role("ballPlayingDefender", "Ball-playing defender")],
  // Offered in SWEEPER_CELL after the centre-back's, so a back three keeps a CB in the middle.
  SW: [role("sweeper", "Sweeper"), role("libero", "Libero")],
  WB: [role("attackingWingBack", "Attacking wing-back"), role("holdingWingBack", "Holding wing-back")],
  CDM: [role("anchor", "Anchor"), role("deepPlaymaker", "Deep playmaker")],
  WM: [role("wideMidfielder", "Winger"), role("defensiveWinger", "Defensive winger")],
  CM: [role("boxToBox", "Box-to-box"), role("playmaker", "Playmaker"), role("ballWinner", "Ball-winner")],
  W: [role("insideForward", "Inside forward"), role("winger", "Winger")],
  CAM: [role("numberTen", "Number 10"), SHADOW_STRIKER],
  ST: [role("poacher", "Poacher"), role("targetMan", "Target man"), role("pressingForward", "Pressing forward"), SHADOW_STRIKER, role("falseNine", "False 9")],
};

const SWEEPER_CELL_ROLES: readonly Role[] = [...DEFAULT_ROLES.CB, ...DEFAULT_ROLES.SW];

/** The roles this slot offers, its first the one a player starts on until stars exist (spec/05). */
export const rolesOfSlot = (cell: Cell): readonly Role[] =>
  sameCell(cell, SWEEPER_CELL) ? SWEEPER_CELL_ROLES : DEFAULT_ROLES[positionOfSlot(cell)];

/** Whether this slot offers the role with this key. */
export const offersRole = (cell: Cell, key: string): boolean => rolesOfSlot(cell).some((role) => role.key === key);

/** The role a starter plays: the one he was given, or the slot's first. */
export const roleIn = (cell: Cell, given: string | undefined): Role =>
  rolesOfSlot(cell).find(({ key }) => key === given) ?? rolesOfSlot(cell)[0];

/** The slot's label from its cell and the role its starter was given: SW only while he plays a
 *  sweeper's role, its position otherwise. Only the pitch's drawing reads it; scoring prices the
 *  slot by its position alone (spec/14). */
export const slotLabel = (cell: Cell, given: string | undefined): SlotLabel =>
  DEFAULT_ROLES.SW.includes(roleIn(cell, given)) ? SWEEPER : positionOfSlot(cell);

/** Each slot label as spec/05's list names it, to tell apart two roles of one name. */
const POSITION_WORDS: Record<SlotLabel, string> = {
  GK: "goalkeeper",
  FB: "full-back",
  CB: "centre-back",
  SW: "sweeper",
  WB: "wing-back",
  CDM: "defensive midfield",
  WM: "wide midfield",
  CM: "centre midfield",
  W: "attacking midfield, wide",
  CAM: "attacking midfield, centre",
  ST: "attack",
};

/** A role's name as managers say it, by its key, with its position where another role shares the
 *  name ("Winger (wide midfield)"); the key itself for one no slot offers. */
export function roleName(key: string): string {
  const entries = Object.entries(DEFAULT_ROLES) as [SlotLabel, readonly Role[]][];
  const found = entries.flatMap(([position, roles]) => roles.filter((each) => each.key === key).map((each) => ({ position, ...each })))[0];
  if (found === undefined) return key;
  const shared = entries.some(([, roles]) => roles.some((each) => each.name === found.name && each.key !== key));
  return shared ? `${found.name} (${POSITION_WORDS[found.position]})` : found.name;
}
