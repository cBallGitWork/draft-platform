// The match page's points for a man no lineup held at the deadline (#771; spec/10, The match page):
// "Just because they aren't a team doesn't mean they don't get points" (Craig, 31 Oct 2026). He is
// priced as his player card opens (spec/12), so the two agree: his base points at the first of his
// positions back to front under the gameweek's set, with no role (basePoints), or the league's
// override of his points in the match where it holds one. Display only: no team's points include
// them.

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { overridesIn } from "../gameweekScorer/heldMatches";
import { basePoints } from "../playerCard/cardPoints";
import type { Position } from "../positions/positionTables";
import type { ScoringSet } from "../scoring/scoringSet";
import { isWhole } from "../stats/matchRecords";

type PlayerCode = number;

/** A man's points in the match from his positions; null while they can't be priced. */
export type UnownedPoints = (playerCode: PlayerCode, positions: readonly Position[]) => number | null;

/** The pricer for the match's men `owners` doesn't name, under `set`: null for every man while the
 *  match isn't priced (no set) or none of its records is unowned. Reads the match's overrides once,
 *  by its index, and never the league's lineups (#770). */
export async function unownedPointsOf(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  fixtureCode: number,
  records: readonly Doc<"playerMatchStats">[],
  owners: ReadonlyMap<PlayerCode, unknown>,
  set: ScoringSet | null,
): Promise<UnownedPoints> {
  if (set === null || records.every(({ playerCode }) => owners.has(playerCode))) return () => null;
  const overrides = await overridesIn(ctx, leagueId, fixtureCode);
  const recordOf = new Map(records.map((record) => [record.playerCode, record]));
  return (playerCode, positions) => {
    const record = recordOf.get(playerCode);
    return overrides.get(playerCode) ?? basePoints(record !== undefined && isWhole(record) ? record.stats : null, set, positions)[0].total;
  };
}
