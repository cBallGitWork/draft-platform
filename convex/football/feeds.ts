import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { namedMen } from "./feedIds";
import { arsenalSquadNumbers, plFixtureCount } from "./football";
import { fplPlayerCount } from "./fpl";
import { logFailure } from "../shared/errors";
import { readPlCommentary, readPlFixture, readPlTeamStats } from "./premierLeague";
import { feedCheckFields, feedCheckTrigger, feedOutcome } from "../schema";
import { LATEST_RUNS } from "../shared/syncRuns";
import { MINUTE_MS } from "../shared/time";

// Two one-off probes of the feeds, not the admin's feeds page (spec/15): `check` and `checkLater`
// for #7, `commentaryCheck` below for #37.

// Issue #7: can Convex reach the football feeds, and does a timer fire with no browser open?
// Run from the CLI: `npx convex run football/feeds:check '{"trigger":"manual"}'` now, or
// `npx convex run football/feeds:checkLater '{"minutes":10}'`, close everything, then `football/feeds:latest`.

export const check = internalAction({
  args: { trigger: feedCheckTrigger, scheduledFor: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [fplPlayers, plFixtures, squadNumbers] = await Promise.all([
      outcome(fplPlayerCount),
      outcome(plFixtureCount),
      outcome(arsenalSquadNumbers),
    ]);
    await ctx.runMutation(internal.football.feeds.record, {
      ...args,
      ranAt: Date.now(),
      fplPlayers,
      plFixtures,
      arsenalSquadNumbers: squadNumbers,
    });
    return null;
  },
});

export const checkLater = internalMutation({
  args: { minutes: v.number() },
  returns: v.null(),
  handler: async (ctx, { minutes }) => {
    const delay = minutes * MINUTE_MS;
    await ctx.scheduler.runAfter(delay, internal.football.feeds.check, {
      trigger: "timer",
      scheduledFor: Date.now() + delay,
    });
    return null;
  },
});

export const record = internalMutation({
  args: feedCheckFields,
  returns: v.null(),
  handler: async (ctx, row) => {
    await ctx.db.insert("feedChecks", row);
    return null;
  },
});

export const latest = internalQuery({
  args: {},
  returns: v.array(v.object({ _id: v.id("feedChecks"), _creationTime: v.number(), ...feedCheckFields })),
  handler: async (ctx) => ctx.db.query("feedChecks").order("desc").take(LATEST_RUNS),
});

// Issue #37: does the commentary stream answer Convex's servers during a live match, and move?
// It did for Ipswich v Nott'm Forest on 23 Oct 2026 (ARCHITECTURE.md, the #37 note). To check a
// match again: push to the dev deployment from main (`npx convex dev --once`), then during play run
// `npx convex run football/feeds:commentaryCheck '{"plFixtureId":<id>}'` twice, a minute or more apart.
// Good: the second run's `lines` is higher and `newest.id` differs (a quiet minute may add none, so
// try once more); `namedMen` up to 40 once the lineups are out.
// Bad: an error ending `answered 403` (or another status) means Convex is refused; the same `lines`
// and `newest` over several minutes while `scripts/record-match.mjs` on the Mac moves means Convex
// is served a stale stream. Either way the commentary goes back to Craig.
// A changed body throws, naming the URL. Nothing is saved: the answer is the printout.
export const commentaryCheck = internalAction({
  args: { plFixtureId: v.number() },
  returns: v.object({
    readAt: v.string(),
    lines: v.number(),
    newest: v.union(v.object({ id: v.number(), minuteLabel: v.union(v.string(), v.null()), text: v.string() }), v.null()),
    namedMen: v.number(),
    teamStats: v.boolean(),
  }),
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
    return { ok: false, error: logFailure("feed check failed", error) };
  }
}
