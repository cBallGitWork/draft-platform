// The roles a slot offers (spec/05 Roles; #10; Craig, 26 Oct 2026): the default set's list for
// the position the slot stands for (pitch.ts's positionOfSlot), and in the defence's centre cell
// the sweeper's roles too (spec/05 The pitch; #844; Craig, 31 Oct 2026). Each role's adjustment
// comes with the site's scoring (spec/14), not here; this is who may be asked to play what, and
// each role's run (spec/05 Runs; #846; Craig, 31 Oct 2026).

import { positionOfSlot, sameCell, type Cell, type SlotPosition } from "./pitch";

/** A point of a run, in metres from the player's place: forward toward the goal he attacks (back
 *  is negative), and across toward the middle of the pitch (out wide is negative; in the centre
 *  lane, toward his right), so one run serves a role on either side. */
export interface RunPoint {
  forward: number;
  across: number;
}

/** Where a player on a role goes as if it were a real match (spec/05 Runs): drawn on the pitch as
 *  a dashed arrow from his place through each point in turn. */
export interface Run {
  path: readonly RunPoint[];
  /** A first guess from FM's nearest role, until each role's run has its own research, for Craig
   *  to refine (spec/05 Runs). */
  rough: boolean;
}

export interface Role {
  /** Saved with a lineup, so never renamed: a new name is a new role. */
  key: string;
  /** As managers say it, such as "Attacking full-back". */
  name: string;
  /** His run, or null for a role that holds its place (spec/05 Runs). Held here with the role, so
   *  it changes with the role set, and the pitch only draws what it reads. */
  run: Run | null;
}

const role = (key: string, name: string, run: Run | null = null): Role => ({ key, name, run });

/** A rough first run (spec/05 Runs) through these points, each [forward, across] in metres. */
const rough = (...points: [forward: number, across: number][]): Run => ({
  path: points.map(([forward, across]) => ({ forward, across })),
  rough: true,
});

/** Into the box from behind the striker. */
const SHADOW_STRIKER = role("shadowStriker", "Shadow striker", rough([18, 8]));

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
  // Each run is a rough one from FM's nearest role (spec/05 Runs), said beside it where it isn't
  // plain. A run straight up or down the pitch ends just past where the rows meet (9 m, 26.5 m
  // from his place: a row is 17.5 m), so its arrowhead shows between two rows' players, not under one.
  GK: [role("shotStopper", "Shot-stopper"), role("sweeperKeeper", "Sweeper keeper", rough([9, 0]))],
  FB: [role("defensiveFullBack", "Defensive full-back"), role("attackingFullBack", "Attacking full-back", rough([26.5, 0]))],
  // A stopper steps out of the line to meet his man.
  CB: [role("stopper", "Stopper", rough([9, 0])), role("ballPlayingDefender", "Ball-playing defender")],
  // Offered in SWEEPER_CELL after the centre-back's, so a back three keeps a CB in the middle. A
  // sweeper sweeps across behind the line; a libero steps out of it with the ball, from his place
  // drawn a little deeper.
  SW: [role("sweeper", "Sweeper", rough([-4, 14])), role("libero", "Libero", rough([28.5, 0]))],
  WB: [role("attackingWingBack", "Attacking wing-back", rough([26.5, 0])), role("holdingWingBack", "Holding wing-back")],
  CDM: [role("anchor", "Anchor"), role("deepPlaymaker", "Deep playmaker")],
  // FM's winger, to the byline; a defensive winger tracks back.
  WM: [role("wideMidfielder", "Winger", rough([26.5, 0])), role("defensiveWinger", "Defensive winger", rough([-9, 0]))],
  // FM's box-to-box, advanced playmaker and ball-winning midfielder.
  CM: [role("boxToBox", "Box-to-box", rough([30, 6])), role("playmaker", "Playmaker", rough([26.5, 0])), role("ballWinner", "Ball-winner", rough([9, 0]))],
  // An inside forward cuts in on the diagonal; a winger goes down the line, then in to cross.
  W: [role("insideForward", "Inside forward", rough([14, 16])), role("winger", "Winger", rough([18, 0], [20, 6]))],
  CAM: [role("numberTen", "Number 10", rough([9, 0])), SHADOW_STRIKER],
  // A poacher runs in behind off the last man's shoulder, a pressing forward harries across the
  // back line, a false 9 drops deep; a target man holds the ball up where he stands.
  ST: [
    role("poacher", "Poacher", rough([6, 8])),
    role("targetMan", "Target man"),
    role("pressingForward", "Pressing forward", rough([4, -10], [6, 10])),
    SHADOW_STRIKER,
    role("falseNine", "False 9", rough([-9, 0])),
  ],
};

const SWEEPER_CELL_ROLES: readonly Role[] = [...DEFAULT_ROLES.CB, ...DEFAULT_ROLES.SW];

/** The roles this slot offers, its first the one a player starts on until stars exist (spec/05). */
export const rolesOfSlot = (cell: Cell): readonly Role[] =>
  sameCell(cell, SWEEPER_CELL) ? SWEEPER_CELL_ROLES : DEFAULT_ROLES[positionOfSlot(cell)];

/** A role where its run isn't drawn, as the matchup sends it (matchupShape.ts's role): its key and
 *  name. */
export const namedRole = ({ key, name }: Role): Pick<Role, "key" | "name"> => ({ key, name });

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
