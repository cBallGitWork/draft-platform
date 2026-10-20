import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { namedMen } from "./feedIds";
import { arsenalSquadNumbers, fplPlayerCount, plFixtureCount } from "./football";
import { readPlCommentary, readPlFixture, readPlTeamStats } from "./premierLeague";
import { feedCheckFields, feedCheckTrigger, feedOutcome } from "./schema";
import { MINUTE_MS } from "./time";

// Issue #7: can Convex reach the football feeds, and does a timer fire with no browser open?
// Run from the CLI: `npx convex run feeds:check '{"trigger":"manual"}'` now, or
// `npx convex run feeds:checkLater '{"minutes":10}'`, close everything, then `feeds:latest`.

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
// Friday 23 Oct 2026, Ipswich v Nott'm Forest (fixture 128999), kickoff 20:00 BST:
// 1. Before kickoff, push this action to the dev deployment from a checkout that has it: on main
//    once this is merged, `npx convex dev --once`; from this branch's worktree, which has no
//    .env.local, `npm run setup` (it links the dev deployment, then pushes once). The push sends
//    every file in convex/, so an unmerged branch's code runs on dev until main is pushed again;
//    this branch adds no table or cron, but the six-hourly sync then runs its convex/football.ts.
// 2. During play, run `npx convex run feeds:commentaryCheck '{"plFixtureId":128999}'`, then again
//    a minute or more later.
// Good: the second run's `lines` is higher and `newest.id` differs (a quiet minute may add none, so
// try once more); `namedMen` up to 40 once the lineups are out. `teamStats` was false three days
// before kickoff; when it turns true is one of #37's questions, so note it, whichever it is.
// Bad: an error ending `answered 403` (or another status) means Convex is refused; the same `lines`
// and `newest` over several minutes while `scripts/record-match.mjs` on the Mac moves means Convex
// is served a stale stream. Either way the commentary goes back to Craig (ARCHITECTURE.md, the TODO).
// A changed body throws, naming the URL. Nothing is saved: the answer is the printout.
export const commentaryCheck = internalAction({
  args: { plFixtureId: v.number() },
  handler: async (_ctx, { plFixtureId }) => {
    // One after another, to go easy on the feed.
    const stream = await readPlCommentary(plFixtureId);
    const fixture = await readPlFixture(plFixtureId);
    const teamStats = await readPlTeamStats(plFixtureId);
    const [newest] = stream;
    return {
      readAt: new Date().toISOString(),
      lines: stream.length,
      newest: newest === undefined ? null : { id: newest.id, minuteLabel: newest.time?.label ?? null, text: newest.text },
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
