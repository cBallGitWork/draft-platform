import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { arsenalSquadNumbers, fplPlayerCount, plFixtureCount } from "./football";
import { namedMen } from "./feedIds";
import { readPlCommentary, readPlFixture, readPlTeamStats } from "./premierLeague";
import { feedCheckFields, feedCheckTrigger, feedOutcome } from "./schema";

// Issue #7: can Convex reach the football feeds, and does a timer fire with no browser open?
// Run from the CLI: `npx convex run feeds:check '{"trigger":"manual"}'` now, or
// `npx convex run feeds:checkLater '{"minutes":10}'`, close everything, then `feeds:latest`.

export const MINUTE_MS = 60_000;

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

// Issue #37: does the commentary stream answer Convex's servers during a live match, and move?
// Run during a match, a minute or more apart: `npx convex run feeds:commentaryCheck '{"plFixtureId":128999}'`.
// A refused or changed read throws, naming the URL. Nothing is saved: the answer is the printout.
export const commentaryCheck = internalAction({
  args: { plFixtureId: v.number() },
  handler: async (_ctx, { plFixtureId }) => {
    // One after another, as a browser on the match page would ask.
    const stream = await readPlCommentary(plFixtureId);
    const fixture = await readPlFixture(plFixtureId);
    const teamStats = await readPlTeamStats(plFixtureId);
    const [newest] = stream;
    return {
      readAt: new Date().toISOString(),
      lines: stream.length,
      newest: newest === undefined ? null : { id: newest.id, minute: newest.time?.label ?? null, text: newest.text },
      namedMen: namedMen(fixture).length,
      teamStats: teamStats.data !== undefined,
    };
  },
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
