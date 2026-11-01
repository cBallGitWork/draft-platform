import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { matchRecordsOf } from "../gameweekScorer/heldMatches";
import { logFailure } from "../shared/errors";
import { heldSeason } from "../shared/fixtures";
import { seasonStartYear } from "../shared/time";
import { queueRefresh } from "./seasonPointsQueue";

// Season points when a played match moves (#525): the football sync hands over each match it
// marks dropped, sends again or moves gameweek, as his card's matches change with it.

/** Queues the re-pricing of everyone with a record in these matches, those of the season held
 *  only, as refresh sets no other season's row: so a rollover dropping last season's matches
 *  re-prices nobody. Never throws for a match, so the sync always commits: one whose records can't
 *  be read is logged and left to a rebuild. */
export async function repriceMatches(ctx: MutationCtx, fixtures: readonly Pick<Doc<"fixtures">, "code" | "kickoff">[]): Promise<void> {
  if (fixtures.length === 0) return;
  const season = await heldSeason(ctx);
  const inSeason = fixtures.filter(({ kickoff }) => kickoff !== null && seasonStartYear(kickoff) === season);
  const playerCodes: number[] = [];
  for (const { code } of inSeason) {
    try {
      for (const { playerCode } of await matchRecordsOf(ctx, code, "its players' season points")) playerCodes.push(playerCode);
    } catch (error) {
      logFailure(`match ${code}'s players' season points weren't re-priced`, error);
    }
  }
  await queueRefresh(ctx, playerCodes);
}
