// The roles a slot offers (spec/05 Roles; #10, #989): the default set's list for the position the
// slot stands for (pitch.ts's positionOfSlot), drafted slot by slot with Craig on 4 and 5 Nov 2026.
// Sweeper and libero are centre-back roles offered only while the formation has three or more
// centre-backs (Craig, 4 Nov 2026). Each role's adjustment comes with the site's scoring (spec/14),
// not here; this is who may be asked to play what, what each role is for, and each role's run
// (spec/05 Runs; #846, #962; Craig, 31 Oct 2026), researched role by role in
// docs/role-runs.md.

import { positionOfSlot, type Cell, type SlotPosition } from "./pitch";

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
}

const role = (key: string, name: string, code: string, description: string, rewards: readonly string[], costs: readonly string[], run: Run | null = null): Role => ({
  key,
  name,
  code,
  description,
  rewards,
  costs,
  run,
});

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
  role("sweeper", "Sweeper", "SW", "Drops a few yards behind the line and sweeps across it, mopping up whatever gets past.", ["Interceptions", "Recoveries", "Clearances off the line"], ["Errors leading to a shot or goal"], runOf([-6, 4], [-5, 16])),
  role("libero", "Libero", "LIB", "Steps out of the back line with the ball and carries it up into midfield.", ["Progressive carries", "Accurate passes", "Final third entries"], ["Heavy touches"], runOf([18, 0], [32, 3])),
];

/** How many centre-backs a formation needs before its centre-backs are offered sweeper and libero. */
export const BACK_THREE = 3;

/** spec/05's default set, by the position each slot stands for: each slot's first is the one a
 *  player starts on until stars are built (spec/05 Roles). */
export const DEFAULT_ROLES: Record<SlotPosition, readonly Role[]> = {
  GK: [
    role("shotStopper", "Shot-stopper", "SHS", "Stays on his line and keeps the shots out, so a busy keeper at a weaker club earns most.", ["Saves", "Big-chance saves", "Penalty saves"], ["Goals let in from outside the box"]),
    role("sweeperKeeper", "Sweeper keeper", "SK", "Plays high, up to the edge of his box, to sweep up balls played in behind his defence.", ["Sweeps off his line", "Smothers", "Clearances", "Progressive carries"], ["Errors leading to a shot or goal"], runOf([9, 0])),
    role("distributor", "Distributor", "DIS", "Starts the attacks, passing and throwing it out long and short.", ["Passes into their half", "Forward passes", "Accurate throws"], ["Failed launches"]),
    role("commandingKeeper", "Commanding keeper", "CK", "Rules his box, coming for crosses and claiming everything in the air.", ["Crosses claimed", "Punches", "Aerials won", "Diving catches"], ["Crosses dropped", "Goals let in inside the box"]),
  ],
  FB: [
    role("overlappingFullBack", "Overlapping full-back", "OFB", "Bombs on down the touchline, round the outside of his winger, to cross from by the byline.", ["Accurate crosses", "Crosses attempted", "Take-ons won"], ["Dispossessed"], runOf([22, -1], [50, -3])),
    role("underlappingFullBack", "Underlapping full-back", "UFB", "Runs up and then inside his winger, into the channel between their full-back and centre-back, and on into the box.", ["Box entries", "Progressive carries", "Final third entries"], ["Heavy touches", "Offsides"], runOf([24, 2], [44, 14])),
    role("invertedFullBack", "Inverted full-back", "IFB", "Steps inside into midfield, next to the holding midfielder, when his side has the ball, and keeps it moving.", ["Accurate passes", "Final third passes"], ["Misplaced passes"], runOf([12, 16])),
    role("playmakingFullBack", "Playmaking full-back", "PFB", "Holds his position and plays the long, early ball forward.", ["Long passes into their half", "Accurate long balls", "Big chances created"], ["Failed long balls"]),
    role("defensiveFullBack", "Defensive full-back", "DFB", "Stays back and defends first.", ["Tackles won", "Interceptions", "Clearances"], ["Dribbled past"]),
  ],
  CB: [
    role("stopper", "Stopper", "STP", "Steps out of the line into midfield to meet his man before he can turn, and win the ball.", ["Tackles won", "Aerials won", "Interceptions"], ["Dribbled past"], runOf([9, 0])),
    role("ballPlayingDefender", "Ball-playing centre-back", "BPD", "Brings the ball out from the back and passes it forward.", ["Long passes into their half", "Forward passes", "Accurate long balls"], ["Failed long balls"]),
    role("noNonsenseCentreBack", "No-nonsense centre-back", "NNC", "Heads it, kicks it and blocks it: the danger cleared, never played out.", ["Clearances", "Headed clearances", "Blocks"], ["Errors leading to a shot or goal"]),
    role("attackingCentreBack", "Attacking centre-back", "ACB", "Carries it out of defence through midfield and keeps going into their box, as Keegan's Newcastle played.", ["Headed shots", "Box entries", "Progressive carries"], ["Dispossessed"], runOf([34, 0], [60, 3])),
    ...BACK_THREE_ROLES,
  ],
  WB: [
    role("attackingWingBack", "Attacking wing-back", "AWB", "Gets right up the flank to the edge of their box to cross and create.", ["Accurate crosses", "Box entries", "Chances created"], ["Dispossessed"], runOf([40, -2])),
    role("holdingWingBack", "Holding wing-back", "HWB", "Holds his flank and defends it, getting forward only when it's safe.", ["Tackles won", "Interceptions", "Recoveries"], ["Dribbled past"]),
    role("completeWingBack", "Complete wing-back", "CWB", "Covers the whole flank: carries it up to their box to cross, then gets back past where he started.", ["Progressive carries", "Accurate crosses", "Recoveries"], ["Heavy touches"], runOf([44, -2], [-10, 2])),
    role("invertedWingBack", "Inverted wing-back", "IWB", "Comes inside into central midfield when his side has the ball and keeps it moving.", ["Accurate passes", "Final third passes", "Take-ons won"], ["Fouls"], runOf([10, 16])),
    role("goalscoringWingBack", "Goalscoring wing-back", "GWB", "Runs up the flank, then cuts in on a diagonal to arrive in the box to shoot and score.", ["Shots on target", "Touches in their box", "Box entries", "Goals"], ["Big chances missed"], runOf([24, 0], [46, 18])),
  ],
  CDM: [
    role("metronome", "Metronome", "MET", "Sits in front of the defence and keeps the ball moving, short and simple.", ["Accurate passes", "Forward passes"], ["Misplaced passes"]),
    role("quarterback", "Quarterback", "QB", "Sits deep and switches the play with long passes.", ["Long passes into their half", "Accurate long balls", "Accurate chipped passes"], ["Failed long balls"]),
    role("halfBack", "Half-back", "HB", "Drops back between the centre-backs to make a back three when his side has the ball.", ["Clearances", "Aerials won", "Possession won in his own third"], ["Errors leading to a shot or goal"], runOf([-16, 6])),
    role("engine", "Engine", "ENG", "Covers every blade of grass, up to support the attack and back to win it, giving it simply.", ["Recoveries", "Interceptions", "Accurate passes"], ["Dribbled past"], runOf([14, 3], [-10, -3])),
    role("tower", "Tower", "TWR", "Wins everything in the air in front of the defence.", ["Aerials won", "Headed clearances", "Headed passes"], ["Aerials lost"]),
    role("destroyer", "Destroyer", "DES", "Gets stuck in, tackling and winning duels to break up their play.", ["Tackles won", "Duels won"], ["Fouls"]),
  ],
  WM: [
    role("wideMidfielder", "Wide workhorse", "WW", "Runs up and down his flank all game, from their third back into his own, helping at both ends.", ["Recoveries", "Passes into the final third", "Tackles"], ["Fouls"], runOf([20, -1], [-20, 1])),
    role("defensiveWinger", "Defensive winger", "DW", "Tracks back level with his full-back to help him before he thinks of attacking.", ["Tackles", "Interceptions", "Blocks"], ["Dribbled past"], runOf([-20, 1])),
    role("wideMidfieldPlaymaker", "Wide playmaker", "WMP", "Drifts inside from the flank into the space between the lines to pick the pass.", ["Accurate long balls", "Key passes"], ["Failed long balls"], runOf([10, 16])),
    role("crosser", "Crosser", "CR", "Gets the ball wide and goes down the line to put it into the box early.", ["Accurate crosses", "Crosses attempted", "Big chances created"], ["Failed crosses"], runOf([30, -2])),
    role("wideMidfieldWinger", "Touchline winger", "TLW", "Hugs the touchline all the way to the byline and takes his man on.", ["Take-ons won", "Times fouled", "Accurate crosses"], ["Dispossessed"], runOf([20, -2], [38, -2])),
  ],
  CM: [
    role("boxToBox", "Box-to-box", "BTB", "Gets up to the edge of their box to shoot, then back behind the ball to win it.", ["Box entries", "Recoveries", "Tackles won", "Shots on target"], ["Heavy touches"], runOf([28, 3], [-10, -3])),
    role("ballWinner", "Ball-winner", "BW", "Hunts the ball across midfield, closing down whoever has it, and wins it back.", ["Tackles won", "Interceptions", "Possession won in midfield"], ["Fouls"], runOf([8, -8], [10, 8])),
    role("attackingEight", "Attacking 8", "A8", "Carries it forward from midfield through the inside channel and into the box.", ["Progressive carries", "Box entries", "Take-ons won"], ["Dispossessed"], runOf([18, 6], [30, 8])),
    role("midfieldEngine", "Engine", "EN", "Covers every blade of grass, up to support the attack and back to win it, giving it simply.", ["Recoveries", "Interceptions", "Accurate passes"], ["Dribbled past"], runOf([16, 3], [-12, -3])),
    role("lateRunner", "Late runner", "LR", "Arrives late in the box, round the penalty spot, unmarked, to finish.", ["Shots on target", "Box entries", "Goals"], ["Big chances missed"], runOf([20, 2], [32, 6])),
  ],
  W: [
    role("winger", "Touchline winger", "TW", "Goes down the line to the byline, then in along it to cross.", ["Accurate crosses", "Take-ons won", "Chances created"], ["Dispossessed"], runOf([18, -2], [21, 6])),
    role("dribbler", "Dribbler", "DRB", "Runs at his full-back and takes him on, again and again, heading for the box.", ["Take-ons won", "Progressive carries", "Fouled in the final third"], ["Dispossessed"], runOf([10, 4], [16, 12])),
    role("insideForward", "Inside forward", "IF", "Cuts in from the flank on the diagonal into the box to shoot.", ["Shots on target", "Shots in the box", "Goals"], ["Big chances missed"], runOf([8, 6], [14, 18])),
    role("widePlaymaker", "Wide playmaker", "WP", "Drifts inside from the flank into the pocket between their midfield and defence to create.", ["Shots created", "Through balls", "Final third passes"], ["Possession lost"], runOf([-2, 14])),
    role("wideForward", "Wide forward", "WF", "Plays off the striker, running in behind their full-back toward goal on the break.", ["Counter-attack shots", "Open-play box entries", "Fouled in the final third"], ["Offsides"], runOf([12, 4], [20, 12])),
    role("pressingWinger", "Pressing winger", "PW", "Curves in on their centre-back to press him, cutting off the pass out to their full-back.", ["Possession won in the attacking third", "Tackles won"], ["Fouls"], runOf([8, 4], [12, 12])),
    role("trackingWinger", "Tracking winger", "TRW", "Tracks their full-back all the way back into his own third.", ["Tackles won", "Interceptions", "Possession won in midfield and his own third"], ["Fouls", "Dribbled past"], runOf([-48, -1])),
  ],
  CAM: [
    role("numberTen", "Number 10", "N10", "Drifts into the pocket between their midfield and defence and makes the chances.", ["Chances created", "Big chances created", "Through balls"], ["Shots off target"], runOf([4, 10])),
    role("attackingMidfieldShadowStriker", "Shadow striker", "SSA", "Runs past the striker into the box to shoot.", ["Box entries", "Shots on target", "Shots from outside the box"], ["Offsides"], runOf([10, 2], [18, 6])),
    role("maverick", "Maverick", "MAV", "Tries the pass or the shot nobody else would.", ["Through balls tried", "Accurate long balls", "Accurate chipped passes", "Shots on target"], ["Heavy touches"]),
    role("carrier", "Carrier", "CAR", "Picks it up and runs straight at them, through the middle to the edge of the box.", ["Take-ons won", "Progressive carries", "Fouled in the final third"], ["Dispossessed"], runOf([15, 3])),
    role("pressingTen", "Pressing 10", "P10", "Leads the press from behind the striker, onto their holding midfielder and then their centre-back.", ["Possession won in the attacking third", "Tackles won", "Recoveries"], ["Fouls"], runOf([6, -6], [12, 6])),
  ],
  ST: [
    role("poacher", "Poacher", "PCH", "Lives in the box and attacks the near post, waiting for the chance to finish.", ["Goals in the box", "Shots on target in the box"], ["Big chances missed"], runOf([4, 6])),
    role("targetMan", "Target man", "TM", "Wins it in the air and holds it up for others.", ["Aerials won", "Accurate flick-ons", "Accurate layoffs"], ["Aerials lost"]),
    role("inBehindStriker", "In-behind striker", "IBS", "Runs across and in behind their back line, then carries it at goal.", ["Counter-attack shots", "Progressive carries", "Open-play box entries", "Fouled in the final third"], ["Offsides"], runOf([3, -6], [5, 4])),
    role("pressingForward", "Pressing forward", "PF", "Harries their back line, pressing from one centre-back across to the other.", ["Possession won in the attacking third", "Possession won in midfield", "Tackles won"], ["Fouls"], runOf([5, -10], [5, 10])),
    role("shadowStriker", "Shadow striker", "SS", "Drops off the main striker, then gets into the box around him.", ["Final third entries", "Box entries", "Shots from outside the box"], ["Heavy touches", "Offsides"], runOf([-8, 4], [2, 8])),
    role("falseNine", "False 9", "F9", "Drops deep from up front into the number 10's space to make the chances.", ["Through balls", "Shots created", "Progressive carries", "Big chances created"], ["Dispossessed"], runOf([-16, 2])),
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
