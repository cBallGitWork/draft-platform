import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery, query, type ActionCtx, type QueryCtx } from "../_generated/server";
import { commentaryLine } from "../schema";
import { logFailure } from "../shared/errors";
import { fixtureByCode } from "../shared/fixtures";
import { callerEmail } from "../shared/leagueAccess";
import { FEED_TYPE, writeCommentary } from "./commentary";
import type { RawBootstrap } from "./fpl";
import { clubByCode } from "../shared/players";
import { commentaryLines, type CommentaryLine } from "./plCommentary";
import { readPlCommentary, readPlFixture, type RawPlFixture } from "./premierLeague";
import { plScoreRead, type ScoreRead } from "./scoreReads";

// Each live match's commentary, read by the live tick (#28) with its points, written by
// `commentary.ts` and stored one row a match (#43, spec/10, The commentary). Each read replaces the
// lines whole, so a reworded line is rewritten and a deleted one goes; once the match is no longer
// polled they stay as written. A failed read, a stream behind the clock or an unworded line marks
// the commentary delayed, logged, while the points carry on. The full-time line carries the score
// alone: each league scores its own way (#421), so its points are the matchup's to add.

type CommentaryLineRow = Infer<typeof commentaryLine>;

/** How far the newest timed line may trail the match clock before the stream counts as behind.
 *  The longest gap between timed lines in the five recorded streams (pl-commentary.json's four and
 *  Ipswich v Forest's final read) is 7.7 minutes, measured 26 Oct 2026. Claude's choice. */
export const COMMENTARY_BEHIND_MINUTES = 10;

/** What every live match's commentary is read against, from FPL's bootstrap the tick already holds. */
export interface CommentaryContext {
  codeByOpta: ReadonlyMap<string, number>;
  /** Each man as FPL shows him (`web_name`), by code. */
  nameByCode: ReadonlyMap<number, string>;
}

export function commentaryContext(bootstrap: RawBootstrap, codeByOpta: ReadonlyMap<string, number>): CommentaryContext {
  return { codeByOpta, nameByCode: new Map(bootstrap.elements.map((element) => [element.code, element.web_name])) };
}

const matchClubs = v.object({ home: v.string(), away: v.string() });
type MatchClubs = Infer<typeof matchClubs>;

/** Both clubs' short names ("ARS") for the match's header, as the football sync holds them. */
export const clubsOf = internalQuery({
  args: { fixtureCode: v.number() },
  returns: matchClubs,
  handler: async (ctx, { fixtureCode }): Promise<MatchClubs> => {
    const fixture = await fixtureByCode(ctx, fixtureCode);
    if (fixture === null) throw new Error(`No match with code ${fixtureCode} is held`);
    const [home, away] = await Promise.all([clubByCode(ctx, fixture.homeClubCode), clubByCode(ctx, fixture.awayClubCode)]);
    return { home: home.shortName, away: away.shortName };
  },
});

/** One read's result: the match's lines written, or null to keep the held ones, and why the
 *  commentary is delayed, or null while it keeps up. */
export interface CommentaryRead {
  lines: CommentaryLineRow[] | null;
  delayed: string | null;
}

/** One live match's commentary read and stored. Never throws: a failure is logged and stored as a
 *  delay, so it stops neither the match's points nor another match's commentary. `listed` is the
 *  match in the Premier League's list for its gameweek, read this tick. */
export async function syncCommentary(
  ctx: ActionCtx,
  fixtureCode: number,
  listed: RawPlFixture | undefined,
  context: CommentaryContext,
  readAt: number,
): Promise<void> {
  let read: CommentaryRead;
  try {
    const clubs = await ctx.runQuery(internal.football.matchCommentary.clubsOf, { fixtureCode });
    read = await readCommentary(fixtureCode, listed, clubs, context);
    if (read.delayed !== null) logDelay(fixtureCode, read.delayed);
  } catch (error: unknown) {
    read = { lines: null, delayed: logFailure(`match ${fixtureCode}'s commentary failed`, error) };
  }
  await storeOrLog(ctx, fixtureCode, readAt, read);
}

/** Each match's commentary marked delayed with no read, as when its gameweek's reads failed. */
export async function delayCommentary(ctx: ActionCtx, fixtureCodes: number[], reason: string, readAt: number): Promise<void> {
  for (const fixtureCode of fixtureCodes) await storeOrLog(ctx, fixtureCode, readAt, { lines: null, delayed: reason });
}

async function storeOrLog(ctx: ActionCtx, fixtureCode: number, readAt: number, read: CommentaryRead): Promise<void> {
  try {
    await ctx.runMutation(internal.football.matchCommentary.store, { fixtureCode, readAt, ...read });
  } catch (error: unknown) {
    logFailure(`storing match ${fixtureCode}'s commentary failed`, error);
  }
}

/** One match's sheets and stream read, and its lines written. A line with no wording is left out
 *  and delays the commentary; the writer's throw is the caller's to catch. */
export async function readCommentary(
  fixtureCode: number,
  listed: RawPlFixture | undefined,
  clubs: MatchClubs,
  context: CommentaryContext,
): Promise<CommentaryRead> {
  if (listed === undefined) throw new Error(`the Premier League lists no match ${fixtureCode}`);
  const score = plScoreRead(listed, fixtureCode);
  // The sheets are read again, not shared with the points' read, so neither can fail the other.
  const [sheets, stream] = await Promise.all([readPlFixture(listed.id), readPlCommentary(listed.id)]);
  const { lines } = commentaryLines(sheets, stream, context.codeByOpta);
  const written = writeCommentary(lines, {
    // Goals are null only before kickoff, when no full-time line can be written.
    header: { ...clubs, homeGoals: score.homeGoals ?? 0, awayGoals: score.awayGoals ?? 0 },
    nameByCode: context.nameByCode,
    fullTimePoints: [],
  });
  return { lines: written.lines, delayed: joinedReasons([behind(lines, score), unworded(written.unworded)]) };
}

/** Why the stream counts as behind: its newest timed line trails the clock of a match in play by
 *  more than `COMMENTARY_BEHIND_MINUTES`. Not judged before kickoff, at half-time, when the clock
 *  stops, or at full time. A line's minute and the clock count alike, the second half from 45. */
function behind(stream: readonly CommentaryLine[], score: ScoreRead): string | null {
  if (score.state !== "live" || score.minutes === null) return null;
  const newest = stream.find((line) => line.minute !== null && line.type !== FEED_TYPE.matchEnds);
  const newestMinute = (newest?.minute ?? 0) + (newest?.addedMinute ?? 0);
  // The same words each minute it trails, so the row is not rewritten each tick.
  return score.minutes - newestMinute > COMMENTARY_BEHIND_MINUTES
    ? `the stream is over ${COMMENTARY_BEHIND_MINUTES} minutes behind the clock`
    : null;
}

/** Each reason a commentary is delayed, as one; null with none. */
function joinedReasons(reasons: (string | null)[]): string | null {
  const given = reasons.filter((reason) => reason !== null);
  return given.length === 0 ? null : given.join("; ");
}

/** A delay that is not a thrown failure, logged as `logFailure` logs one. */
function logDelay(fixtureCode: number, reason: string): void {
  console.error(`match ${fixtureCode}'s commentary is delayed: ${reason}`);
}

function unworded(lines: readonly CommentaryLine[]): string | null {
  if (lines.length === 0) return null;
  const types = [...new Set(lines.map((line) => JSON.stringify(line.type)))];
  return `${lines.length} lines of a type with no wording (${types.join(", ")})`;
}

/** A match's stored commentary; null before its first read. */
export function heldOf(ctx: QueryCtx, fixtureCode: number): Promise<Doc<"matchCommentary"> | null> {
  return ctx.db
    .query("matchCommentary")
    .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode))
    .unique();
}

/** What an empty stream delays the commentary with, while lines are held: a feed that drops every
 *  line is not taken at its word, as a match's lines never all go. */
export const EMPTY_STREAM = "the stream sent no lines";

/** One read stored over the match's row. Lines replace the held ones whole, but an empty stream
 *  never wipes held lines. A delay keeps the time it began; a read that changes nothing is not
 *  written, so a screen reading the row is not woken each minute. */
export const store = internalMutation({
  args: { fixtureCode: v.number(), readAt: v.number(), lines: v.union(v.array(commentaryLine), v.null()), delayed: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { fixtureCode, readAt, lines, delayed }) => {
    const held = await heldOf(ctx, fixtureCode);
    const heldLines = held?.lines ?? [];
    const wipes = lines !== null && lines.length === 0 && heldLines.length > 0;
    const nextLines = lines === null || wipes ? heldLines : lines;
    const reason = joinedReasons([wipes ? EMPTY_STREAM : null, delayed]);
    if (wipes) logDelay(fixtureCode, EMPTY_STREAM);
    const next = {
      fixtureCode,
      lines: nextLines,
      delayed: reason === null ? null : { reason, since: held?.delayed?.since ?? readAt },
    };
    if (held === null) {
      await ctx.db.insert("matchCommentary", next);
      return null;
    }
    if (JSON.stringify(next.lines) === JSON.stringify(held.lines) && next.delayed?.reason === held.delayed?.reason) return null;
    await ctx.db.patch("matchCommentary", held._id, next);
    return null;
  },
});

/** A match's commentary for anyone signed in: its lines, newest first, and whether it is delayed
 *  ("Commentary delayed"). Null before the match's first read. */
export const ofMatch = query({
  args: { fixtureCode: v.number() },
  returns: v.union(v.object({ lines: v.array(commentaryLine), delayed: v.boolean() }), v.null()),
  handler: async (ctx, { fixtureCode }) => {
    await callerEmail(ctx);
    const held = await heldOf(ctx, fixtureCode);
    return held === null ? null : { lines: held.lines, delayed: held.delayed !== null };
  },
});
