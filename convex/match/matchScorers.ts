import { v, type Infer } from "convex/values";
import { FEED_TYPE, minuteOf } from "../football/commentary";
import type { StoredCommentary } from "../football/matchCommentary";
import type { PlayerCode } from "../shared/players";

// The scorers' line under the match page's scoreboard (#1032; spec/10 S10.7: "Under the
// scoreboard, each side's scorers"): each goal the match's commentary holds, under the side it
// counted for, oldest first. An own goal counts for the other side and says so. A goal VAR took
// away goes, as the score does.

/** One goal: who scored it and when ("23'", "45+2'"). */
export const matchGoal = v.object({ name: v.string(), minute: v.string(), ownGoal: v.boolean() });
export type MatchGoal = Infer<typeof matchGoal>;
export const matchScorers = v.object({ home: v.array(matchGoal), away: v.array(matchGoal) });
export type MatchScorers = Infer<typeof matchScorers>;

/** A man the page names: his name and the side he plays for, null for neither. */
export type ScorerMan = { name: string; side: "home" | "away" | null };

const SCORING = new Set<string>([FEED_TYPE.goal, FEED_TYPE.penaltyGoal, FEED_TYPE.ownGoal]);

/** Each side's goals from the stored lines (newest first, as the feed's). A goal whose man the page
 *  can't place on a side, or a line with no minute, is left off the line rather than guessed. */
export function scorersOf(lines: StoredCommentary["lines"], menByCode: ReadonlyMap<PlayerCode, ScorerMan>): MatchScorers {
  const goals: { scorer: PlayerCode; minute: string; ownGoal: boolean }[] = [];
  for (const line of lines.toReversed()) {
    const scorer = line.playerCodes?.[0];
    if (line.type === undefined || scorer === undefined || scorer === null) continue;
    if (line.type === FEED_TYPE.varCancelledGoal) {
      const cancelled = goals.findLastIndex((goal) => goal.scorer === scorer);
      if (cancelled >= 0) goals.splice(cancelled, 1);
      continue;
    }
    if (!SCORING.has(line.type) || line.minute === undefined || line.minute === null) continue;
    goals.push({ scorer, minute: minuteOf(line.minute, line.addedMinute ?? null), ownGoal: line.type === FEED_TYPE.ownGoal });
  }
  const scorers: MatchScorers = { home: [], away: [] };
  for (const { scorer, minute, ownGoal } of goals) {
    const man = menByCode.get(scorer);
    if (man === undefined || man.side === null) continue;
    const countsFor = ownGoal ? (man.side === "home" ? "away" : "home") : man.side;
    scorers[countsFor].push({ name: man.name, minute, ownGoal });
  }
  return scorers;
}
