// A player's line in a classic league (spec/22, Lines): one of five, on top of his positions,
// which stay the same in every league (`S22.5`). He is hard-locked to it (`S22.4`): it starts as
// the line he has most starts in, and a run of starts in another line warns his manager, then
// moves him there (`S22.6`), as a run elsewhere does a position (positionChanges.ts). The admin's
// line wins (`S22.7`). Pure: the same starts always give the same line.

import { formationPosition, SQUAD_GROUPS, type Position } from "./positionTables";
import { START_WINDOW, type PositionInputs, type Start } from "./positions";

/** The lines, back to front, and the positions each holds (`S22.3`): Scouting's squad groups, the
 *  middle one named CM. */
export const LINES = {
  GK: SQUAD_GROUPS.GK,
  DEF: SQUAD_GROUPS.DEF,
  CM: SQUAD_GROUPS.MID,
  AM: SQUAD_GROUPS.AM,
  FWD: SQUAD_GROUPS.FWD,
} as const satisfies Record<string, readonly Position[]>;
export type Line = keyof typeof LINES;
export const LINE_NAMES = Object.keys(LINES) as Line[];

/** The one line a position is in (`S22.3`). */
export const lineOfPosition = (position: Position): Line =>
  LINE_NAMES.find((line) => (LINES[line] as readonly Position[]).includes(position))!;

export interface PlayerLine {
  /** Null while no judged start places him and the admin has set none. */
  line: Line | null;
  source: "starts" | "admin" | null;
  /** The line he left when a run of starts last moved him to `line`; null if none in his window has. */
  movedFrom: Line | null;
  /** His newest starts in a row in another line, once they warn his manager; null otherwise. */
  flagged: { line: Line; startsThere: number } | null;
}

export type LineInputs = Pick<PositionInputs, "thresholds" | "judgedBefore"> & {
  starts: readonly Start[];
  /** The admin's line for him, which no start overrides; null for none. */
  adminLine: Line | null;
};

/** His line. Only starts kicked off before `judgedBefore` count, so it changes only between
 *  gameweeks, from each league's own deadline (`S22.6`), and only his newest `START_WINDOW` of
 *  them. His line starts as the one he has most of them in, a tie going to the line he started
 *  in last (`S22.5`; "recent starts win"); then, oldest first, a run of `flagAfter` starts in a
 *  row in one other line flags him, and `removeAfter` moves him there. A start that places him
 *  nowhere neither adds to a run nor ends it. */
export function lineOf({ starts, adminLine, thresholds, judgedBefore }: LineInputs): PlayerLine {
  if (adminLine !== null) return { line: adminLine, source: "admin", movedFrom: null, flagged: null };
  const judged = starts.filter((start) => judgedBefore === null || start.kickoff < judgedBefore);
  const lines = judged
    .toSorted((a, b) => a.kickoff - b.kickoff)
    .slice(-START_WINDOW)
    .flatMap((start) => {
      const position = formationPosition(start);
      return position === null ? [] : [lineOfPosition(position)];
    });
  const mostStarted = mostStartedLine(lines);
  if (mostStarted === null) return { line: null, source: null, movedFrom: null, flagged: null };
  let line = mostStarted;
  let movedFrom: Line | null = null;
  let run = 0;
  let runLine: Line = line;
  for (const playedAs of lines) {
    run = playedAs === line ? 0 : playedAs === runLine ? run + 1 : 1;
    runLine = playedAs;
    if (run < thresholds.removeAfter) continue;
    [movedFrom, line, run] = [line, playedAs, 0];
  }
  const flagged = run >= thresholds.flagAfter ? { line: runLine, startsThere: run } : null;
  return { line, source: "starts", movedFrom, flagged };
}

/** The line most of `lines` (oldest first) are in, a tie going to the newest; null for none. */
function mostStartedLine(lines: readonly Line[]): Line | null {
  const count = new Map<Line, number>();
  for (const line of lines) count.set(line, (count.get(line) ?? 0) + 1);
  let most: Line | null = null;
  for (const line of lines) if (most === null || count.get(line)! >= count.get(most)!) most = line;
  return most;
}
