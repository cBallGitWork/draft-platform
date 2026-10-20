// One match's commentary as the Premier League writes it, each line with its minute and its men
// as FPL's codes (#37). The feed's own words and event types are kept as they came: the platform's
// CM-terse lines (spec/10) are built from these later, once `/grill live commentary` settles them.
// Men are matched through the bridge in `feedIds.ts`, on the match's own team sheets.

import { matchPlayers, namedMen, type UnmatchedPlayer } from "./feedIds";
import type { RawPlCommentaryLine, RawPlFixture } from "./premierLeague";

export interface CommentaryLine {
  /** The feed's id for the line: the same line keeps it from one read to the next. */
  id: number;
  /** The match minute, as the feed counts it: "45+2" is minute 45 and added minute 2. Both are
   *  null on a line with no time (the lineups'). */
  minute: number | null;
  addedMinute: number | null;
  /** The feed's own: "goal", "secondyellow card" (docs/pl-commentary.md lists those seen). */
  type: string;
  text: string;
  /** Each man the line names as FPL's code, in the feed's order, which gives his part (the
   *  scorer, then the assister). Null for a man FPL does not list; he is in `unmatched`. */
  playerCodes: (number | null)[];
}

/** "62" or "45+2". */
const MINUTE_LABEL = /^(\d+)(?:\+(\d+))?$/;

/** Every line, in the feed's order (newest first). A line naming a man neither sheet names, or with
 *  a minute in another form, is a changed payload: it throws rather than guess. */
export function commentaryLines(
  fixture: RawPlFixture,
  stream: RawPlCommentaryLine[],
  codeByOpta: ReadonlyMap<string, number>,
): { lines: CommentaryLine[]; unmatched: UnmatchedPlayer[] } {
  const { codes, unmatched } = matchPlayers(fixture, codeByOpta);
  const named = new Set(namedMen(fixture).map((man) => man.id));
  const mentioned = new Set<number>();
  const lines = stream.map((line): CommentaryLine => {
    const playerIds = line.playerIds ?? [];
    for (const id of playerIds) {
      if (!named.has(id)) throw new Error(`PL fixture ${fixture.id}'s sheets do not name player ${id} (line ${line.id})`);
      mentioned.add(id);
    }
    return {
      id: line.id,
      ...minuteOf(line),
      type: line.type,
      text: line.text,
      playerCodes: playerIds.map((id) => codes.get(id) ?? null),
    };
  });
  return { lines, unmatched: unmatched.filter((man) => mentioned.has(man.plPlayerId)) };
}

function minuteOf(line: RawPlCommentaryLine): Pick<CommentaryLine, "minute" | "addedMinute"> {
  if (line.time === undefined) return { minute: null, addedMinute: null };
  const found = MINUTE_LABEL.exec(line.time.label);
  if (found === null) throw new Error(`commentary line ${line.id} has the minute ${JSON.stringify(line.time.label)}`);
  return { minute: Number(found[1]), addedMinute: Number(found[2] ?? 0) };
}
