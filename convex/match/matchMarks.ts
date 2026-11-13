import { v, type Infer } from "convex/values";
import { EVENT_STATS } from "../stats/matchRecords";

// The marks after a man's name on the match page's sheets (#1032; spec/10 S10.9: "We probably need
// an assist icon somewhere too"): a ball for each goal, a boot for each assist, a yellow and a red
// card, counted from his record for the match.

export const matchMarks = v.object({ goals: v.number(), assists: v.number(), yellowCards: v.number(), redCards: v.number() });
export type MatchMarks = Infer<typeof matchMarks>;

/** A man's marks from his record's stats: none before his record, and 0 for a stat it leaves out. */
export function marksOf(stats: Readonly<Record<string, number>> | undefined): MatchMarks {
  const count = (stat: string) => stats?.[stat] ?? 0;
  return { goals: count(EVENT_STATS.goals), assists: count(EVENT_STATS.assists), yellowCards: count(EVENT_STATS.yellowCards), redCards: count(EVENT_STATS.redCards) };
}
