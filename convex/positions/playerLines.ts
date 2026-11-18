import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { mutation, type QueryCtx } from "../_generated/server";
import { line } from "../schema";
import { adminOf } from "../shared/leagueAccess";
import { findRow, heldRow, patchRow } from "./playerPositions";
import { lineOf, type PlayerLine } from "./lines";
import type { HowPositionsCount } from "./positionSettings";

// Each player's line in a classic league (spec/22, Lines), worked out from his positions row on
// every read, as his positions are (playerPositions.ts), and the admin's override of it (`S22.7`).

/** His line from his row, as `how` judges his starts. */
export function lineFrom(row: Pick<Doc<"playerPositions">, "starts" | "line">, how: HowPositionsCount): PlayerLine {
  return lineOf({ starts: row.starts, adminLine: row.line ?? null, thresholds: how.thresholds, judgedBefore: how.judgedBefore });
}

/** His line now, as `how` judges it; a player no feed has named yet has none unless the admin set one. */
export async function lineNow(ctx: QueryCtx, code: number, how: HowPositionsCount): Promise<PlayerLine> {
  return lineFrom((await findRow(ctx, code)) ?? { starts: [] }, how);
}

/** Sets the line a player plays in every classic league, whatever his starts say, or with null
 *  hands it back to his starts (`S22.7`). The admin's alone. */
export const setLine = mutation({
  args: { code: v.number(), line: v.union(line, v.null()) },
  returns: v.null(),
  handler: async (ctx, { code, line: given }) => {
    await adminOf(ctx);
    await patchRow(ctx, await heldRow(ctx, code), { line: given ?? undefined });
    await ctx.runMutation(internal.positions.positionWarnings.warnEveryLeagueSoon, {});
    return null;
  },
});
