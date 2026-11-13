// The roles a slot offers (spec/05 Roles; #10, #989): the default set's list for the position the
// slot stands for (pitch.ts's positionOfSlot), drafted slot by slot with Craig on 4 and 5 Nov 2026.
// Sweeper and libero are centre-back roles offered only while the formation has three or more
// centre-backs (Craig, 4 Nov 2026). Each role's adjustment comes with the site's scoring (spec/14),
// not here; this is who may be asked to play what, what each role is for, and each role's run
// (spec/05 Runs; #846, #962; Craig, 31 Oct 2026), researched role by role in
// docs/role-runs.md.

import type { Position } from "../positions/positionTables";
import { positionOfSlot, type Cell, type SlotPosition } from "./pitch";

/** A point of a run, in metres from the player's place: forward toward the goal he attacks (back
 *  is negative), and across toward the middle of the pitch (out wide is negative; in the centre
 *  lane, toward his right), so one run serves a role on either side. */
interface RunPoint {
  forward: number;
  across: number;
}

/** Where a player on a role goes as if it were a real match (spec/05 Runs): drawn on the pitch as
 *  a dashed arrow from his place through each point in turn. */
export interface Run {
  path: readonly RunPoint[];
}

export interface Role {
  /** Saved with a lineup, so never renamed: a new name is a new role. */
  key: string;
  /** As managers say it, such as "Overlapping full-back". */
  name: string;
  /** What the pitch shows at every width: at most three characters, one per role (spec/05 What
   *  the pitch shows). */
  code: string;
  /** What he does on the role, and where his run takes him, for the role card (spec/05 Roles:
   *  "Each role's description is held with the role"). */
  description: string;
  /** The categories it scores more for, and the bad actions it scores less for, without values
   *  (spec/05 Roles; Craig, 1 Nov 2026): the values are the site's scoring, by patch (spec/14), first
   *  drafted in docs/roles-first-values.md. */
  rewards: readonly string[];
  costs: readonly string[];
  /** His run, or null for a role that holds its place (spec/05 Runs). Held here with the role, so
   *  it changes with the role set, and the pitch only draws what it reads. */
  run: Run | null;
  /** True while no real Sportmonks read has shown its stats for its position (spec/05 `S05.30`):
   *  the sweeper keeper and the libero. */
  notTested: boolean;
}

const role = (key: string, name: string, code: string, description: string, rewards: readonly string[], costs: readonly string[], run: Run | null = null): Role => ({
  key,
  name,
  code,
  description,
  rewards,
  costs,
  run,
  notTested: false,
});

/** The role, marked not tested (spec/05 `S05.30`). */
const notTested = (each: Role): Role => ({ ...each, notTested: true });

/** A run (spec/05 Runs) through these points, each [forward, across] in metres from his place. The
 *  pitch's rows are 17.5 m apart, from his own goal line to theirs: the goalkeeper's middle is
 *  96 m from their goal line, a defender's 79 m, a defensive midfielder's 61 m, a midfielder's
 *  44 m, an attacking midfielder's 26 m and a striker's 9 m; their box's edge is 16.5 m out. A run
 *  straight up or down ends where two rows meet (9 m, 26.5 m from his place), so its arrowhead shows
 *  between two rows' players, not under one. */
const runOf = (...points: [forward: number, across: number][]): Run => ({
  path: points.map(([forward, across]) => ({ forward, across })),
});

/** The roles only a back of three or more centre-backs offers, last in the centre-back's list so a
 *  back three keeps its first (spec/05 The pitch; Craig, 4 Nov 2026). A sweeper sweeps across behind
 *  the line; a libero steps out of it with the ball. */
const BACK_THREE_ROLES: readonly Role[] = [
  role("sweeper", "Sweeper", "SW", "Drops a few yards behind the line and sweeps across it, mopping up whatever gets past.", ["Recoveries", "Interceptions", "Last-man tackles"], ["Dribbled past"], runOf([-6, 4], [-5, 16])),
  notTested(role("libero", "Libero", "LIB", "Steps out of the back line with the ball and carries it up into midfield.", ["Dribbles won", "Accurate passes"], ["Dispossessed"], runOf([18, 0], [32, 3]))),
];

/** How many centre-backs a formation needs before its centre-backs are offered sweeper and libero. */
export const BACK_THREE = 3;

/** The two roles `takesRole` holds to their own positions (spec/05 `S05.29`). */
const PRESSING_WINGER = "pressingWinger";
const FALSE_NINE = "falseNine";

/** spec/05's default set, by the position each slot stands for: each slot's first is the one a
 *  player starts on until stars are built (spec/05 Roles). */
export const DEFAULT_ROLES: Record<SlotPosition, readonly Role[]> = {
  GK: [
    role("shotStopper", "Shot-stopper", "SHS", "Stays on his line and keeps the shots out, so a busy keeper at a weaker club earns most.", ["Saves", "Saves inside the box", "Penalty saves"], ["Errors leading to a goal"]),
    notTested(role("sweeperKeeper", "Sweeper keeper", "SK", "Plays high, up to the edge of his box, to sweep up balls played in behind his defence.", ["Interceptions", "Tackles won", "Last-man tackles", "Clearances"], ["Errors leading to a shot"], runOf([9, 0]))),
    role("distributor", "Distributor", "DIS", "Starts the attacks, passing and throwing it out long and short.", ["Accurate long balls", "Accurate passes"], ["Failed long balls"]),
    role("commandingKeeper", "Commanding keeper", "CK", "Rules his box, coming for crosses and claiming everything in the air.", ["High claims", "Punches"], ["Aerials lost"]),
  ],
  FB: [
    role("overlappingFullBack", "Overlapping full-back", "OFB", "Bombs on down the touchline, round the outside of his winger, to cross from level with their box.", ["Accurate crosses", "Crosses", "Dribbles won"], ["Dispossessed"], runOf([22, -1], [60, -3])),
    role("invertedFullBack", "Inverted full-back", "IFB", "Steps inside into midfield, next to the holding midfielder, when his side has the ball, and keeps it moving.", ["Accurate passes"], ["Misplaced passes"], runOf([12, 16])),
    role("playmakingFullBack", "Playmaking full-back", "PFB", "Holds his position and plays the long, early ball forward.", ["Accurate long balls", "Key passes"], ["Failed long balls"]),
    role("defensiveFullBack", "Defensive full-back", "DFB", "Stays back and defends first.", ["Tackles won", "Interceptions", "Clearances", "Blocks"], ["Dribbled past"]),
  ],
  CB: [
    role("stopper", "Stopper", "STP", "Steps out of the line into midfield to meet his man before he can turn, and win the ball.", ["Tackles won", "Blocks", "Aerials won"], ["Dribbled past"], runOf([9, 0])),
    role("ballPlayingDefender", "Ball-playing centre-back", "BPD", "Brings the ball out from the back and passes it forward.", ["Accurate long balls", "Accurate passes"], ["Failed long balls"]),
    role("noNonsenseCentreBack", "No-nonsense centre-back", "NNC", "Heads it, kicks it and blocks it: the danger cleared, never played out.", ["Clearances", "Long balls"], ["Errors leading to a shot"]),
    role("attackingCentreBack", "Attacking centre-back", "ACB", "Carries it out of defence through midfield and keeps going into their box, as Keegan's Newcastle played.", ["Shots", "Goals"], ["Dispossessed"], runOf([34, 0], [60, 3])),
    ...BACK_THREE_ROLES,
  ],
  WB: [
    role("attackingWingBack", "Attacking wing-back", "AWB", "Gets right up the flank to the edge of their box to cross and create.", ["Accurate crosses", "Key passes", "Dribbles won"], ["Dispossessed"], runOf([44, -2])),
    role("holdingWingBack", "Holding wing-back", "HWB", "Holds his flank and defends it, getting forward only when it's safe.", ["Tackles won", "Interceptions", "Recoveries"], ["Dribbled past"]),
    role("completeWingBack", "Complete wing-back", "CWB", "Covers the whole flank: carries it up to their box to cross, then gets back past where he started.", ["Accurate crosses", "Dribbles won", "Tackles won", "Interceptions"], ["Possession lost"], runOf([44, -2], [-10, 2])),
    role("invertedWingBack", "Inverted wing-back", "IWB", "Comes inside into central midfield when his side has the ball and keeps it moving.", ["Accurate passes", "Key passes"], ["Fouls"], runOf([10, 16])),
    role("goalscoringWingBack", "Goalscoring wing-back", "GWB", "Runs up the flank, then cuts in on a diagonal to arrive in the box to shoot and score.", ["Shots", "Shots on target", "Goals"], ["Big chances missed"], runOf([24, 0], [46, 18])),
  ],
  CDM: [
    role("metronome", "Metronome", "MET", "Sits in front of the defence and keeps the ball moving, short and simple.", ["Accurate passes"], ["Misplaced passes"]),
    role("quarterback", "Quarterback", "QB", "Sits deep and switches the play with long passes.", ["Accurate long balls"], ["Failed long balls"]),
    // Saved lineups hold its key, so the half-back keeps it as the third centre-back (#1196).
    role("halfBack", "Third centre-back", "TCB", "Drops back between the centre-backs to make a back three when his side has the ball.", ["Clearances", "Blocks", "Interceptions"], ["Errors leading to a shot"], runOf([-16, 6])),
    role("engine", "Engine", "ENG", "Covers every blade of grass, up to support the attack and back to win it, giving it simply.", ["Recoveries", "Interceptions", "Accurate passes"], ["Dribbled past"], runOf([14, 3], [-10, -3])),
    role("tower", "Tower", "TWR", "Wins everything in the air in front of the defence.", ["Aerials won"], ["Aerials lost"]),
    role("destroyer", "Destroyer", "DES", "Gets stuck in, tackling and winning duels to break up their play.", ["Tackles won", "Ground duels won"], ["Fouls"]),
  ],
  WM: [
    role("wideMidfielder", "Wide workhorse", "WW", "Runs up and down his flank all game, from their third back into his own, helping at both ends.", ["Recoveries", "Tackles", "Accurate crosses"], ["Fouls"], runOf([20, -1], [-20, 1])),
    role("defensiveWinger", "Defensive winger", "DW", "Tracks back level with his full-back to help him before he thinks of attacking.", ["Tackles", "Interceptions", "Blocks"], ["Dribbled past"], runOf([-20, 1])),
    role("wideMidfieldPlaymaker", "Wide playmaker", "WMP", "Drifts inside from the flank into the space between the lines to pick the pass.", ["Accurate long balls", "Key passes"], ["Failed long balls"], runOf([10, 16])),
    role("crosser", "Crosser", "CR", "Gets the ball wide and goes down the line to put it into the box early.", ["Accurate crosses", "Crosses"], ["Failed crosses"], runOf([30, -2])),
  ],
  CM: [
    role("boxToBox", "Box-to-box", "BTB", "Gets up to the edge of their box to shoot, then back behind the ball to win it.", ["Recoveries", "Tackles won", "Shots"], ["Dispossessed"], runOf([28, 3], [-10, -3])),
    role("ballWinner", "Ball-winner", "BW", "Hunts the ball across midfield, closing down whoever has it, and wins it back.", ["Tackles won", "Interceptions", "Ground duels won"], ["Fouls"], runOf([8, -8], [10, 8])),
    role("attackingEight", "Attacking 8", "A8", "Carries it forward from midfield through the inside channel and into the box.", ["Dribbles won", "Key passes"], ["Dispossessed"], runOf([18, 6], [30, 8])),
    role("midfieldEngine", "Engine", "EN", "Covers every blade of grass, up to support the attack and back to win it, giving it simply.", ["Recoveries", "Interceptions", "Accurate passes"], ["Dribbled past"], runOf([16, 3], [-12, -3])),
  ],
  W: [
    role("winger", "Touchline winger", "TW", "Goes down the line to the byline, then in along it to cross.", ["Accurate crosses", "Dribbles won"], ["Dispossessed"], runOf([18, -2], [21, 6])),
    role("dribbler", "Dribbler", "DRB", "Runs at his full-back and takes him on, again and again, heading for the box.", ["Dribbles won", "Fouls drawn"], ["Dispossessed"], runOf([10, 4], [16, 12])),
    role("insideForward", "Inside forward", "IF", "Cuts in from the flank on the diagonal into the box to shoot.", ["Shots", "Shots on target", "Goals"], ["Big chances missed"], runOf([8, 6], [14, 18])),
    role("widePlaymaker", "Wide playmaker", "WP", "Drifts inside from the flank into the pocket between their midfield and defence to create.", ["Key passes", "Through balls", "Big chances created"], ["Possession lost"], runOf([-2, 14])),
    role(PRESSING_WINGER, "Pressing winger", "PW", "Curves in on their centre-back to press him, cutting off the pass out to their full-back.", ["Tackles won", "Recoveries"], ["Fouls"], runOf([8, 4], [12, 12])),
    role("trackingWinger", "Tracking winger", "TRW", "Tracks their full-back all the way back into his own third.", ["Tackles won", "Interceptions", "Blocks", "Clearances"], ["Dribbled past"], runOf([-44, -1])),
  ],
  CAM: [
    role("numberTen", "Number 10", "N10", "Drifts into the pocket between their midfield and defence and makes the chances.", ["Key passes", "Big chances created", "Through balls"], ["Shots off target"], runOf([4, 10])),
    role("attackingMidfieldShadowStriker", "Shadow striker", "SSA", "Runs past the striker into the box to shoot.", ["Shots", "Shots on target", "Goals"], ["Offsides"], runOf([10, 2], [18, 10])),
    role("carrier", "Carrier", "CAR", "Picks it up and runs straight at them, through the middle to the edge of the box.", ["Dribbles won", "Fouls drawn"], ["Dispossessed"], runOf([9, 0])),
    role("pressingTen", "Pressing 10", "P10", "Leads the press from behind the striker, onto their holding midfielder and then their centre-back.", ["Tackles won", "Interceptions", "Recoveries"], ["Fouls"], runOf([6, -6], [12, 6])),
  ],
  ST: [
    role("poacher", "Poacher", "PCH", "Lives in the box and attacks the near post, waiting for the chance to finish.", ["Goals", "Shots on target"], ["Big chances missed"], runOf([5, 10])),
    role("targetMan", "Target man", "TM", "Wins it in the air and holds it up for others.", ["Aerials won"], ["Aerials lost"]),
    role("inBehindStriker", "In-behind striker", "IBS", "Runs across and in behind their back line, then carries it at goal.", ["Dribbles won", "Fouls drawn"], ["Offsides"], runOf([3, -8], [6, 8])),
    role("pressingForward", "Pressing forward", "PF", "Harries their back line, pressing from one centre-back across to the other.", ["Tackles won", "Interceptions", "Recoveries"], ["Fouls"], runOf([5, -10], [5, 10])),
    role(FALSE_NINE, "False 9", "F9", "Drops deep from up front into the number 10's space to make the chances.", ["Key passes", "Through balls", "Dribbles won", "Accurate passes"], ["Dispossessed"], runOf([-16, 2])),
  ],
};

/** The cells a lineup's starters stand in: what a slot offers depends on it (sweeper and libero). */
export type Formation = readonly Cell[];

/** How many of the formation's slots are centre-backs'. */
export const centreBacksIn = (formation: Formation): number => formation.filter((cell) => positionOfSlot(cell) === "CB").length;

/** Every role the slot's position holds, whatever the formation: the roles a player is rated for,
 *  and those a bench player, standing in no formation, is shown. */
export const everyRoleOf = (cell: Cell): readonly Role[] => DEFAULT_ROLES[positionOfSlot(cell)];

/** Whether only a back of three or more centre-backs offers the role: sweeper and libero. */
export const needsBackThree = (key: string): boolean => BACK_THREE_ROLES.some((each) => each.key === key);

/** The roles this slot offers in this formation, its first the one a player starts on when none
 *  has more stars (spec/05; stars/bestRole.ts). */
export const rolesOfSlot = (cell: Cell, formation: Formation): readonly Role[] =>
  centreBacksIn(formation) >= BACK_THREE ? everyRoleOf(cell) : everyRoleOf(cell).filter((each) => !needsBackThree(each.key));

/** Whether a player with these positions may take the role (spec/05 `S05.29`; Craig, 9 and 10 Nov
 *  2026, on #1196): the attack's roles go to an ST or SS, the false 9 to a CAM too, so a winger never
 *  takes one; the pressing winger goes to a W only. Any other role goes to whoever stands in its
 *  slot, and so does any role to one with no positions, whom the lineup's own check refuses for
 *  standing outside his areas (lineup.ts's outsideHisAreas). */
export function takesRole(positions: readonly Position[], key: string): boolean {
  if (positions.length === 0) return true;
  if (key === PRESSING_WINGER) return positions.includes("W");
  if (!DEFAULT_ROLES.ST.some((each) => each.key === key)) return true;
  return positions.includes("ST") || positions.includes("SS") || (key === FALSE_NINE &&positions.includes("CAM"));
}

/** The roles this slot offers in this formation that a player with these positions may take, in the
 *  slot's order: the Role ▾ (spec/05 `S05.29`: "A role a player can't take isn't offered to him").
 *  All the slot offers for one who may take none there, as he can't stand in it (pitch.ts). */
export function rolesFor(cell: Cell, formation: Formation, positions: readonly Position[]): readonly Role[] {
  const offered = rolesOfSlot(cell, formation);
  const his = offered.filter(({ key }) => takesRole(positions, key));
  return his.length === 0 ? offered : his;
}

/** A role where its run isn't drawn, as the matchup sends it (matchupShape.ts's role): its key and
 *  name. */
export const namedRole = ({ key, name }: Role): Pick<Role, "key" | "name"> => ({ key, name });

/** Every key a slot offers. */
const ROLE_KEYS: ReadonlySet<string> = new Set(Object.values(DEFAULT_ROLES).flatMap((roles) => roles.map(({ key }) => key)));

/** Whether any slot offers the role with this key: false for one the default set no longer holds,
 *  which a starter saved on it plays as `roleIn` says (spec/05 Roles; #841). */
export const isRole = (key: string): boolean => ROLE_KEYS.has(key);

/** Whether this slot offers the role with this key in this formation. */
export const offersRole = (cell: Cell, key: string, formation: Formation): boolean => rolesOfSlot(cell, formation).some((each) => each.key === key);

/** The role a starter plays: the one he was given, if his slot's position holds it, or the slot's
 *  first. Whether the formation offers it is checked when the lineup is saved (lineup.ts), never
 *  here, so an auto-sub that leaves two centre-backs changes no other starter's role. */
export const roleIn = (cell: Cell, given: string | undefined): Role => everyRoleOf(cell).find(({ key }) => key === given) ?? everyRoleOf(cell)[0];

/** Each slot position as spec/05's list names it, to tell apart two roles of one name. */
const POSITION_WORDS: Record<SlotPosition, string> = {
  GK: "goalkeeper",
  FB: "full-back",
  CB: "centre-back",
  WB: "wing-back",
  CDM: "defensive midfield",
  WM: "wide midfield",
  CM: "centre midfield",
  W: "attacking midfield, wide",
  CAM: "attacking midfield, centre",
  ST: "attack",
};

/** A role's name as managers say it, by its key, with its position where another role shares the
 *  name ("Engine (centre midfield)"); the key itself for one no slot offers. */
export function roleName(key: string): string {
  const entries = Object.entries(DEFAULT_ROLES) as [SlotPosition, readonly Role[]][];
  const found = entries.flatMap(([position, roles]) => roles.filter((each) => each.key === key).map((each) => ({ position, ...each })))[0];
  if (found === undefined) return key;
  const shared = entries.some(([, roles]) => roles.some((each) => each.name === found.name && each.key !== key));
  return shared ? `${found.name} (${POSITION_WORDS[found.position]})` : found.name;
}
