import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { delayedFrom, heldOf, type StoredCommentary } from "../football/matchCommentary";
import type { HeldCommentary } from "../matchup/matchupShape";
import { thresholdStepsOf } from "../matchup/thresholdSteps";
import { shownLine, storedLineKey, vidiprinter, type VidiprinterPlayer } from "../matchup/vidiprinter";
import type { ScoringSet } from "../scoring/scoringSet";
import { logFailure } from "../shared/errors";
import type { PlayerCode } from "../shared/players";

// The match page's commentary (spec/10, The commentary), read for matchPage.ts.

/** The match's stored lines, newest first, priced for the `players` once the gameweek has begun;
 *  or why they can't be read, while the rest still shows. Delayed from the moment the match's held
 *  `score` gives (`delayedFrom`). With them the lines as stored, which the scorers' line reads
 *  (matchScorers.ts); none while they can't be read. */
export async function commentaryOf(
  ctx: QueryCtx,
  fixture: Doc<"fixtures">,
  set: ScoringSet | null,
  players: ReadonlyMap<PlayerCode, VidiprinterPlayer>,
  score: Doc<"matchScores"> | null,
): Promise<{ commentary: HeldCommentary; lines: StoredCommentary["lines"] }> {
  try {
    const row = await heldOf(ctx, fixture.code);
    if (row === null) return { commentary: { kind: "read", lines: [], delayedFrom: null }, lines: [] };
    const lines =
      set === null
        ? row.lines.map((line) => ({ key: storedLineKey(fixture.code, line.sourceId), text: line.text, points: null }))
        : vidiprinter([{ fixtureCode: fixture.code, kickoff: fixture.kickoff, lines: row.lines, steps: await thresholdStepsOf(ctx, fixture.code) }], players, set).map(shownLine);
    return { commentary: { kind: "read", lines, delayedFrom: delayedFrom(row, score) }, lines: row.lines };
  } catch (error) {
    return { commentary: { kind: "unread", reason: logFailure(`Match ${fixture.code}'s commentary can't be read`, error) }, lines: [] };
  }
}
