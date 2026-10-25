import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, query, type ActionCtx, type MutationCtx } from "../_generated/server";
import { clubRecord, scoreFeed, scoreRead, type matchState, type scoreWrites } from "../schema";
import { takeAllOrThrow } from "../shared/cappedRead";
import { callerEmail } from "../shared/leagueAccess";
import { clubByCode } from "../shared/players";
import { BATCH_SIZE } from "../shared/syncRuns";
import type { ScoreRead, ScoreReads } from "./scoreReads";

// Each match's score and clock, stored (#49, #50; spec/18). Two feeds write it: the football sync
// every match FPL lists, and the live tick (#28) each match it polls, from the Premier League's
// list. The newest read wins, with one exception: a feed never moves a match back a state (full
// time to live, say) that the other feed moved it on to, since a feed lagging a minute behind would
// otherwise flicker it. A feed may move its own reads back: a match abandoned and reset.
// Not a field on `fixtures`: a fixture row is FPL's record, rewritten whole by the football sync.

type ScoreFeed = Infer<typeof scoreFeed>;
type ScoreWrites = Infer<typeof scoreWrites>;

/** How far on each state is; a half-time is no further on than play. */
const STATE_ORDER: Record<Infer<typeof matchState>, number> = { upcoming: 0, live: 1, halfTime: 1, fullTime: 2 };

/** One read's scores written in batches of `BATCH_SIZE`, and its problems kept for the run row. */
export async function writeScores(ctx: ActionCtx, feed: ScoreFeed, readAt: number, { reads, problems }: ScoreReads): Promise<ScoreWrites> {
  let written = 0;
  for (let start = 0; start < reads.length; start += BATCH_SIZE) {
    written += await ctx.runMutation(internal.football.matchScores.upsertScores, {
      feed,
      readAt,
      reads: reads.slice(start, start + BATCH_SIZE),
    });
  }
  return { received: reads.length + problems.length, written, problems };
}

/** Each read written over the match's held score where it wins; returns how many rows it wrote. A
 *  read that changes nothing held is not written. */
export const upsertScores = internalMutation({
  args: { feed: scoreFeed, readAt: v.number(), reads: v.array(scoreRead) },
  handler: async (ctx, { feed, readAt, reads }): Promise<number> => {
    const written = await Promise.all(reads.map((read) => upsertScore(ctx, { ...read, feed, readAt })));
    return written.filter(Boolean).length;
  },
});

type HeldScore = Omit<Doc<"matchScores">, "_id" | "_creationTime">;

async function upsertScore(ctx: MutationCtx, sent: HeldScore): Promise<boolean> {
  const held = await ctx.db
    .query("matchScores")
    .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", sent.fixtureCode))
    .unique();
  if (held === null) {
    await ctx.db.insert("matchScores", sent);
    return true;
  }
  if (!wins(sent, held) || sameScore(sent, held)) return false;
  await ctx.db.patch("matchScores", held._id, sent);
  return true;
}

/** The read is no older than the held one, and does not move the other feed's state back. */
function wins(sent: HeldScore, held: HeldScore): boolean {
  if (sent.readAt < held.readAt) return false;
  return sent.feed === held.feed || STATE_ORDER[sent.state] >= STATE_ORDER[held.state];
}

function sameScore(sent: ScoreRead, held: ScoreRead): boolean {
  return (
    sent.state === held.state &&
    sent.homeGoals === held.homeGoals &&
    sent.awayGoals === held.awayGoals &&
    sent.minutes === held.minutes &&
    sent.clockLabel === held.clockLabel
  );
}

/** The most matches one gameweek holds: ten, or more with a match moved into it, with room. More
 *  throws, never a silent cut. */
export const GAMEWEEK_MATCHES_MOST = 40;

const gameweekMatch = v.object({
  fixtureCode: v.number(),
  /** Null while the match has no kickoff time. */
  kickoff: v.union(v.number(), v.null()),
  home: clubRecord,
  away: clubRecord,
  /** Null until a feed's read has given its score. */
  score: v.union(scoreRead.omit("fixtureCode"), v.null()),
});

/** A gameweek's matches the feed still sends, in kickoff order (those with no time last), each with
 *  its clubs and its newest score, for anyone signed in. */
export const ofGameweek = query({
  args: { gameweek: v.number() },
  returns: v.array(gameweekMatch),
  handler: async (ctx, { gameweek }) => {
    await callerEmail(ctx);
    const fixtures = await takeAllOrThrow(
      ctx.db
        .query("fixtures")
        .withIndex("by_gameweek_and_droppedAt", (q) => q.eq("gameweek", gameweek).eq("droppedAt", undefined)),
      GAMEWEEK_MATCHES_MOST,
      `More than ${GAMEWEEK_MATCHES_MOST} matches are held for gameweek ${gameweek}, so they would be cut short`,
    );
    const inOrder = fixtures.toSorted((a, b) => (a.kickoff ?? Infinity) - (b.kickoff ?? Infinity));
    return Promise.all(
      inOrder.map(async ({ code, kickoff, homeClubCode, awayClubCode }) => {
        const held = await ctx.db
          .query("matchScores")
          .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", code))
          .unique();
        return {
          fixtureCode: code,
          kickoff,
          home: clubOf(await clubByCode(ctx, homeClubCode)),
          away: clubOf(await clubByCode(ctx, awayClubCode)),
          score:
            held === null
              ? null
              : { state: held.state, homeGoals: held.homeGoals, awayGoals: held.awayGoals, minutes: held.minutes, clockLabel: held.clockLabel },
        };
      }),
    );
  },
});

function clubOf({ code, name, shortName }: Doc<"clubs">) {
  return { code, name, shortName };
}
