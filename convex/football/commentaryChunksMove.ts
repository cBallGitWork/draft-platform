import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { heldChunks, writeChunks } from "./commentaryChunks";

// The one-off migration for #2004: each match's commentary stored whole on its matchCommentary row
// moves to commentaryChunks, and the row keeps only its delay. A match still read live moves on its
// next store anyway; this moves the finished ones, which are kept after the gameweek (spec/10).
// Each run moves one page of rows and schedules the next, so no run reads more than a page of
// lines; a row already moved is skipped, so running it again does nothing. Run it once on each
// deployment, then the schema's `lines` on matchCommentary can go:
//   npx convex run football/commentaryChunksMove:moveToChunks
//   npx convex run --prod football/commentaryChunksMove:moveToChunks

/** The rows one run reads: each holds at most a match's lines, about 40 KB. Claude's choice. */
const ROWS_A_RUN = 20;

/** Moves one page of rows' lines to chunks and schedules the next page; returns the rows moved. */
export const moveToChunks = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.number(),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("matchCommentary").paginate({ numItems: ROWS_A_RUN, cursor: cursor ?? null });
    let moved = 0;
    for (const row of page.page) {
      if (row.lines === undefined) continue;
      // Chunks already held are newer than the row's lines (matchCommentary.ts reads them first).
      if ((await heldChunks(ctx, row.fixtureCode)).length === 0) await writeChunks(ctx, row.fixtureCode, [], row.lines);
      await ctx.db.patch("matchCommentary", row._id, { lines: undefined });
      moved += 1;
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.football.commentaryChunksMove.moveToChunks, { cursor: page.continueCursor });
    return moved;
  },
});
