import type { Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { liveTickFeed } from "../schema";

// The tick's side of a live tick chain (#1999, liveTicks.ts): apart from liveTicks.ts, which reads
// the feeds' matches, so a feed's tick can load this without loading itself back.

/** Runs a tick's `work`, which says whether it had a match to read (null when it couldn't ask), then
 *  schedules its next, even when `work` threw. */
export async function chainedTick(ctx: ActionCtx, feed: Infer<typeof liveTickFeed>, work: () => Promise<boolean | null>): Promise<null> {
  let busy: boolean | null = null;
  try {
    busy = await work();
  } finally {
    await ctx.runMutation(internal.stats.liveTicks.arrange, { feed, ranTick: true, busy });
  }
  return null;
}
