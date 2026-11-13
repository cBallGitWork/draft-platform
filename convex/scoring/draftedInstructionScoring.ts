import { UP_FRONT_AREAS, type FirstInstructionKey } from "../lineup/instructions";
import { AREA_OF_POSITION, SLOT_POSITIONS, type SlotPosition } from "../lineup/pitch";
import type { StoredScoringSet } from "./scoringSetShape";
import {
  ACCURATE_CROSSES,
  ACCURATE_PASSES,
  AERIALS_WON,
  ASSISTS,
  BLOCKS,
  CLEAN_SHEET_MINUTES,
  CLEAN_SHEETS,
  DUELS_WON,
  ERRORS_TO_A_GOAL,
  ERRORS_TO_A_SHOT,
  FAILED_CROSSES,
  FAILED_LONG_BALLS,
  FOULS,
  GOALS,
  GOALS_CONCEDED,
  INTERCEPTIONS,
  POSSESSION_LOST,
  RED_CARDS,
  SHOTS,
  SHOTS_OFF_TARGET,
  TACKLES_WON,
  YELLOW_CARDS,
} from "./statKeys";

// The team instructions' first values (spec/05 Team instructions; #990): docs/roles-first-values.md's
// Team instructions, Claude's draft fitted on 5 Nov 2026, as the site's scoring holds them. Like the
// roles' (draftedRoleAdjustments.ts), this file is only where they start: they go into the site's
// set by firstInstructionsVersion.ts (Craig, 9 Nov 2026, on #990: "as roles: into the site's set
// from the next gameweek that hasn't begun, no letter, changed by patch after that"). Each stat is
// the live feed's own key (statCatalogueList.ts); failed long balls and crosses are the roles' own
// stats (FIRST_ROLE_OWN_STATS).
// Keep it tight early scores his club's half-time score, for starters only (Craig, 9 Nov 2026):
// the two half-time stats only a starter's record holds (plMatch.ts's HALF_TIME_STATS).

type InstructionScoring = NonNullable<StoredScoringSet["instructions"]>[number];
type InstructionLine = InstructionScoring["lines"][number];

/** GK/DEF (Craig, 9 Nov 2026, on #990): keeper, full-back, centre-back and wing-back slots. */
const KEEPER_AND_DEFENDERS: SlotPosition[] = ["GK", "FB", "CB", "WB"];
/** DEF: GK/DEF but the keeper. */
const DEFENDERS: SlotPosition[] = ["FB", "CB", "WB"];
/** Up front (S05.42): the slots of the attack row and the attacking midfield row behind it. */
const UP_FRONT: SlotPosition[] = SLOT_POSITIONS.filter((position) => UP_FRONT_AREAS.includes(AREA_OF_POSITION[position]));
/** ATT: the forwards, the attack row's. */
const ATTACKERS: SlotPosition[] = ["ST"];

/** `points` for each whole `every` of the stats added up, for the `positions` given or every slot. */
function line(every: number, points: number, stats: string[], options: Pick<InstructionLine, "positions" | "most" | "minMinutes"> = {}): InstructionLine {
  return { ...options, stats: stats.map((stat) => ({ stat, weight: 1 })), every, points };
}

const instruction = (key: FirstInstructionKey,...lines: InstructionLine[]): InstructionScoring => ({ instruction: key, lines });

/** Every instruction the page fits, in spec/05's order. */
export const FIRST_INSTRUCTION_SCORING: readonly InstructionScoring[] = [
  // GK/DEF +1 per 30 accurate passes; errors leading to a shot or goal −3 each.
  instruction(
    "playOutFromTheBack",
    line(30, 1, [ACCURATE_PASSES], { positions: KEEPER_AND_DEFENDERS }),
    line(1, -3, [ERRORS_TO_A_SHOT, ERRORS_TO_A_GOAL]),
  ),
  // Headed goals +2; ATT +1 per 2 aerials won; GK/DEF −1 per 8 failed long balls.
  instruction(
    "bootItToTheBigMan",
    line(1, 2, ["att_hd_goal"]),
    line(2, 1, [AERIALS_WON], { positions: ATTACKERS }),
    line(8, -1, [FAILED_LONG_BALLS], { positions: KEEPER_AND_DEFENDERS }),
  ),
  // +1 per accurate cross; −1 per 2 failed crosses.
  instruction("getItWide", line(1, 1, [ACCURATE_CROSSES]), line(2, -1, [FAILED_CROSSES])),
  // +1 per shot, any range; −1 per 2 shots off target (Craig, 10 Nov 2026, S05.37; not refitted yet).
  instruction("shootOnSight", line(1, 1, [SHOTS]), line(2, -1, [SHOTS_OFF_TARGET])),
  // Goals and assists +1; GK/DEF −1 per 2 goals conceded.
  instruction("gungHo", line(1, 1, [GOALS, ASSISTS]), line(2, -1, [GOALS_CONCEDED], { positions: KEEPER_AND_DEFENDERS })),
  // Up front +1 per 2 tackles won and interceptions; −1 per foul (Craig, 10 and 12 Nov 2026,
  // S05.37 and S05.42; not refitted yet).
  instruction(
    "pressHigh",
    line(2, 1, [TACKLES_WON, INTERCEPTIONS], { positions: UP_FRONT }),
    line(1, -1, [FOULS]),
  ),
  // DEF +1 per 2 offsides won and interceptions, up to 3; GK/DEF −1 per 2 goals conceded.
  instruction(
    "holdAHighLine",
    line(2, 1, ["offside_provoked", INTERCEPTIONS], { positions: DEFENDERS, most: 3 }),
    line(2, -1, [GOALS_CONCEDED], { positions: KEEPER_AND_DEFENDERS }),
  ),
  // DEF +1 per 3 clearances and blocks; −1 per 6 possession lost: spec/05's cost is "defenders
  // losing the ball", so it scores defenders too.
  instruction(
    "clearIt",
    line(3, 1, ["effective_clearance", BLOCKS], { positions: DEFENDERS }),
    line(6, -1, [POSSESSION_LOST], { positions: DEFENDERS }),
  ),
  // +1 per 5 tackles and duels won; yellow −2, red −5, −1 per 2 fouls.
  instruction(
    "getStuckIn",
    line(5, 1, [TACKLES_WON, DUELS_WON]),
    line(1, -2, [YELLOW_CARDS]),
    line(1, -5, [RED_CARDS]),
    line(2, -1, [FOULS]),
  ),
  // +1 if his club kept a clean sheet at half-time; −1 per goal his club let in before half-time.
  instruction("keepItTightEarly", line(1, 1, ["clean_sheet_half_time"]), line(1, -1, ["goals_conceded_half_time"])),
  // GK/DEF clean sheet +1, at base scoring's 60 minutes; goals and assists −1 (all players).
  instruction(
    "parkTheBus",
    line(1, 1, [CLEAN_SHEETS], { positions: KEEPER_AND_DEFENDERS, minMinutes: CLEAN_SHEET_MINUTES }),
    line(1, -1, [GOALS, ASSISTS]),
  ),
];
