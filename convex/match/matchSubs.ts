import { v, type Infer } from "convex/values";
import { FEED_TYPE, minuteOf } from "../football/commentary";
import type { StoredCommentary } from "../football/matchCommentary";
import type { PlayerCode } from "../shared/players";

// Who came on for whom, and when, for the match page's pitch (#2525; spec/10 S10.9; the approved
// picture `1440-pitch.png`): a substitute who came on stands in the place of the man he replaced,
// who joins his side's list marked "Off 62'". Read from the match's commentary, whose substitution
// line names the man coming on first and the man going off second (commentary.ts).

/** A man's substitution: the minute he came on and whom for, the minute he went off; each null
 *  while the commentary holds no line for it. */
export const matchSub = v.object({
  cameOn: v.union(v.object({ minute: v.string(), replaced: v.number() }), v.null()),
  wentOff: v.union(v.object({ minute: v.string() }), v.null()),
});
export type MatchSub = Infer<typeof matchSub>;

export const NO_SUB: MatchSub = { cameOn: null, wentOff: null };

/** Each man the substitution lines name, from the stored lines (newest first, as the feed's). A line
 *  naming fewer than two men or with no minute is left out rather than guessed, and logged under
 *  `match` ("Match 7"). */
export function subsOf(lines: StoredCommentary["lines"], match: string): Map<PlayerCode, MatchSub> {
  const subs = new Map<PlayerCode, MatchSub>();
  const subOf = (code: PlayerCode) => subs.get(code) ?? NO_SUB;
  for (const line of lines.toReversed()) {
    if (line.type !== FEED_TYPE.substitution) continue;
    const [on = null, off = null] = line.playerCodes ?? [];
    if (on === null || off === null || line.minute === undefined || line.minute === null) {
      console.warn(`${match}'s substitution at line ${line.sourceId} is left off the pitch: it names no minute or not both men`);
      continue;
    }
    const minute = minuteOf(line.minute, line.addedMinute ?? null);
    subs.set(on, { ...subOf(on), cameOn: { minute, replaced: off } });
    subs.set(off, { ...subOf(off), wentOff: { minute } });
  }
  return subs;
}
