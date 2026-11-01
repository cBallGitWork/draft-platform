// The pitch the Tactics tab draws, to scale: a real pitch's measurements in metres, the one home
// every marking is drawn from (plate.md, Marks: the pitch; Craig, 31 Oct 2026: "that pitch ratio
// is well off"). They are the Laws of the Game's, the same for every league, so they are constants.

import { AREAS, LANES } from "../../../../convex/lineup/pitch";

/** Across the pitch, and from goal line to goal line. */
export const PITCH_SIZE = { width: 68, length: 105 } as const;
/** The penalty area and the goal area: across, and out from the goal line. */
export const PENALTY_AREA = { width: 40.32, depth: 16.5 } as const;
export const GOAL_AREA = { width: 18.32, depth: 5.5 } as const;
/** The penalty spot, out from the goal line. */
export const PENALTY_SPOT_DISTANCE = 11;
/** The centre circle's radius, and the penalty arc's (the D's) from the spot. */
export const CIRCLE_RADIUS = 9.15;
export const CORNER_ARC_RADIUS = 1;
/** A spot is 0.22m across, under a pixel on a phone's pitch, so it is drawn this big to show. */
export const SPOT_DRAWN_RADIUS = 0.4;

/** A row of players' share of the length, a stripe, and a lane's of the width: the cells the
 *  players stand in share the pitch equally (plate.md, Marks: the pitch). */
export const ROW_LENGTH = PITCH_SIZE.length / AREAS.length;
export const LANE_WIDTH = PITCH_SIZE.width / LANES.length;

/** Width over length, for the pitch's CSS `aspect-ratio`: portrait, as it is drawn attack at the top. */
export const PITCH_ASPECT = PITCH_SIZE.width / PITCH_SIZE.length;

const middle = PITCH_SIZE.width / 2;

/** A box centred across the pitch at the top goal line, in metres from the top-left corner. */
const atGoal = ({ width, depth }: { width: number; depth: number }) => ({ x: middle - width / 2, y: 0, width, height: depth });

/** The top end's markings, in metres from the top-left corner; the bottom end is the same turned
 *  half round about the centre spot. */
export const END_MARKINGS = {
  penaltyArea: atGoal(PENALTY_AREA),
  goalArea: atGoal(GOAL_AREA),
  penaltySpot: { x: middle, y: PENALTY_SPOT_DISTANCE },
  /** Where the D meets the penalty area's front line, either side of the middle. */
  arcHalfWidth: Math.sqrt(CIRCLE_RADIUS ** 2 - (PENALTY_AREA.depth - PENALTY_SPOT_DISTANCE) ** 2),
} as const;

export const CENTRE_SPOT = { x: middle, y: PITCH_SIZE.length / 2 } as const;
