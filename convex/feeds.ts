import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { arsenalSquadNumbers, fplPlayerCount, plFixtureCount } from "./football";
import { feedCheckFields, feedCheckTrigger, feedOutcome } from "./schema";

// Issue #7: can Convex reach the football feeds, and does a timer fire with no browser open?
// Run from the CLI: `npx convex run feeds:check '{"trigger":"manual"}'` now, or
// `npx convex run feeds:checkLater '{"minutes":10}'`, close everything, then `feeds:latest`.

const MINUTE_MS = 60_000;

export const check = internalAction({
  args: { trigger: feedCheckTrigger, scheduledFor: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const [fplPlayers, plFixtures, squadNumbers] = await Promise.all([
      outcome(fplPlayerCount),
      outcome(plFixtureCount),
      outcome(arsenalSquadNumbers),
    ]);
    await ctx.runMutation(internal.feeds.record, {
      ...args,
      ranAt: Date.now(),
      fplPlayers,
      plFixtures,
      arsenalSquadNumbers: squadNumbers,
    });
  },
});

export const checkLater = internalMutation({
  args: { minutes: v.number() },
  handler: async (ctx, { minutes }) => {
    const delay = minutes * MINUTE_MS;
    await ctx.scheduler.runAfter(delay, internal.feeds.check, {
      trigger: "timer",
      scheduledFor: Date.now() + delay,
    });
  },
});

export const record = internalMutation({
  args: feedCheckFields,
  handler: async (ctx, row) => {
    await ctx.db.insert("feedChecks", row);
  },
});

export const latest = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("feedChecks").order("desc").take(5),
});

/** A refusal is the answer this check exists to find, so it is recorded and logged, not thrown. */
async function outcome(read: () => Promise<number>): Promise<Infer<typeof feedOutcome>> {
  try {
    return { ok: true, count: await read() };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`feed check failed: ${message}`);
    return { ok: false, error: message };
  }
}
