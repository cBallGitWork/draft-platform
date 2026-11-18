// A classic league's five lines, back to front (spec/22, `S22.3`), which rules, lineup and scoring
// all name. Which positions each holds, and how a player's line is judged, stay with positions
// (../positions/lines.ts).

export const LINE_NAMES = ["GK", "DEF", "CM", "AM", "FWD"] as const;
export type Line = (typeof LINE_NAMES)[number];
