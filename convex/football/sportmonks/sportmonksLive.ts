import { v, type Infer } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction, internalMutation, internalQuery, type ActionCtx, type QueryCtx } from "../../_generated/server";
import { errorMessage, logFailure } from "../../shared/errors";
import { withHeartbeat } from "../../heartbeats/heartbeat";
import { emailIfFailed } from "../../admin/feedFailureEmails";
import { LIVE_WINDOW_MS } from "../../shared/dueMatches";
import { scoreRead, sideRunFields, sportmonksEvent, sportmonksLineupMan, sportmonksTickFields, type sideMatchOutcome } from "../../schema";
import { getData, liveFixturesUrl, MULTI_FIXTURES_MAX, sportmonksToken } from "./sportmonks";
import { mapSportmonksMatch } from "./sportmonksMatch";
import { SPORTMONKS, type RawFixture } from "./sportmonksRaw";
import { competitionNamed, competitionsHeld, scoreOf, writeScore } from "./sportmonksSync";
import { noteFirstMinutes } from "./fplLinksSync";

// Sportmonks' live tick (#1391), run every minute by crons.ts as `liveStatsSync` is: each match of
// a competition that is on (#1414), from kickoff to full time, read with its competition's others
// in one call, with its lineups (starters, bench, formation places), each man's running totals
// (`lineups.details`) and its events timeline, written over the last read. No match on, no call
// and no row; otherwise a row a tick for each competition with a match on, each match read or why
// not, which the feeds page judges and a failure of emails the admin. Where the deployment has no
// `SPORTMONKS_API_TOKEN` it does nothing.

type MatchOutcome = Infer<typeof sideMatchOutcome>;

/** What the log says, before the error, when a tick fails whole. */
export const SPORTMONKS_TICK_FAILED_LOG = "Sportmonks live tick failed";

const liveMatch = v.object({ fixtureCode: v.number(), kickoff: v.number(), competition: v.number() });

/** The matches of the competitions that are on being played at `now`: kicked off within the live
 *  window, not dropped, and not yet read at full time. The read that finds full time is a match's
 *  last. A match held under no competition yet waits for the six-hourly read to name one. */
export async function sportmonksLiveMatches(ctx: QueryCtx, now: number): Promise<Infer<typeof liveMatch>[]> {
  const on = new Set((await competitionsHeld(ctx)).filter((each) => each.on).map(({ competition }) => competition));
  const kickedOff = ctx.db
    .query("sportmonksFixtures")
    .withIndex("by_kickoff", (q) => q.gt("kickoff", now - LIVE_WINDOW_MS).lte("kickoff", now));
  const found = [];
  // Uncapped: matches kicked off within one window, at most a round's few in each competition.
  for await (const { code, kickoff, droppedAt, competition } of kickedOff) {
    if (droppedAt !== undefined || kickoff === null || competition === undefined || !on.has(competition)) continue;
    const score = await scoreOf(ctx, code);
    if (score?.state !== "fullTime") found.push({ fixtureCode: code, kickoff, competition });
  }
  return found;
}

export const live = internalQuery({
  args: { now: v.number() },
  returns: v.array(liveMatch),
  handler: (ctx, { now }) => sportmonksLiveMatches(ctx, now),
});

export const tick = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const token = sportmonksToken();
    if (token === null) return null;
    return withHeartbeat("sportmonksLiveTick", async () => {
      const ranAt = Date.now();
      let live: Infer<typeof liveMatch>[];
      try {
        live = await ctx.runQuery(internal.football.sportmonks.sportmonksLive.live, { now: ranAt });
      } catch (error: unknown) {
        // Before any competition is known, a failure is the tick's own, on no competition's row.
        const outcome = { ok: false as const, error: logFailure(SPORTMONKS_TICK_FAILED_LOG, error) };
        await ctx.runMutation(internal.football.sportmonks.sportmonksLive.recordTick, { ranAt, outcome });
        return null;
      }
      // Each competition with a match on is its own row: one the plan refuses fails alone.
      for (const competition of new Set(live.map((match) => match.competition))) {
        const codes = live.filter((match) => match.competition === competition).map(({ fixtureCode }) => fixtureCode);
        const outcome = await tickCompetition(ctx, token, codes, ranAt);
        await ctx.runMutation(internal.football.sportmonks.sportmonksLive.recordTick, { competition, ranAt, outcome });
      }
      return null;
    });
  },
});

/** One competition's live matches read, `MULTI_FIXTURES_MAX` to a call, and written. */
async function tickCompetition(ctx: ActionCtx, token: string, live: number[], ranAt: number): Promise<Infer<typeof sideRunFields.outcome>> {
  try {
    const matches: MatchOutcome[] = [];
    for (let start = 0; start < live.length; start += MULTI_FIXTURES_MAX) {
      const codes = live.slice(start, start + MULTI_FIXTURES_MAX);
      const { data } = await getData<RawFixture[]>(liveFixturesUrl(codes), token);
      for (const fixtureCode of codes) matches.push(await writeLiveMatch(ctx, fixtureCode, data, ranAt));
    }
    return { ok: true, matches };
  } catch (error: unknown) {
    return { ok: false, error: logFailure(SPORTMONKS_TICK_FAILED_LOG, error) };
  }
}

/** One match from a live read, written; a match the read left out, or one it couldn't map, is
 *  that match's failure on the row, and the rest go on. */
async function writeLiveMatch(ctx: ActionCtx, fixtureCode: number, read: RawFixture[], readAt: number): Promise<MatchOutcome> {
  try {
    const raw = read.find((match) => match.id === fixtureCode);
    if (raw === undefined) throw new Error(`${SPORTMONKS} sent no match ${fixtureCode}`);
    const { score, men, events } = mapSportmonksMatch(raw);
    await ctx.runMutation(internal.football.sportmonks.sportmonksLive.writeMatch, { score, men, events, readAt });
    return { fixtureCode, ok: true };
  } catch (error: unknown) {
    return { fixtureCode, ok: false, error: errorMessage(error) };
  }
}

/** One match's live read: its score, and its lineups and events replaced whole, each man playing
 *  his first minute of its competition noted (#1421). */
export const writeMatch = internalMutation({
  args: { score: scoreRead, men: v.array(sportmonksLineupMan), events: v.array(sportmonksEvent), readAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { score, men, events, readAt }) => {
    await writeScore(ctx, score, readAt, "live");
    const { fixtureCode } = score;
    const held = await ctx.db
      .query("sportmonksMatches")
      .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode))
      .unique();
    await noteFirstMinutes(ctx, fixtureCode, men, held?.men ?? [], readAt);
    if (held === null) await ctx.db.insert("sportmonksMatches", { fixtureCode, men, events, readAt });
    else await ctx.db.replace("sportmonksMatches", held._id, { fixtureCode, men, events, readAt });
    return null;
  },
});

export const recordTick = internalMutation({
  args: sportmonksTickFields,
  returns: v.null(),
  handler: async (ctx, row) => {
    await ctx.db.insert("sportmonksLiveTicks", row);
    await emailIfFailed(ctx, "sportmonksLive", row, await competitionNamed(ctx, row.competition));
    return null;
  },
});
