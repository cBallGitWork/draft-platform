import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { begunGameweeks } from "../gameweekScorer/gameweekScores";
import { recordEvent } from "../mail/letters";
import { refuse, runnerOf } from "../shared/leagueAccess";
import { isLocked, type DeadlineOf } from "./deadline";
import { deadlineOf, leagueDeadlines } from "./leagueDeadlines";
import { nextByDeadlines } from "./nextGameweek";
import { seasonGameweekCount } from "./seasonGameweeks";
import { begunRefusal, isGameweek, isGameweekUsed, noKickoffRefusal, noSuchGameweek, shownDeadline, usedGameweeksOf } from "./usedGameweeks";

// The league's scoring start (spec/04, After the draft; #1097): "scoring starts in gameweek N", set
// by the commissioner, defaulting to the next gameweek after the draft ends; squads and lineups
// count from that gameweek's deadline (Craig, 5 Nov 2026). The gameweeks before it score nothing
// and have no head-to-head, and free agency and trades stay open through them, as through an
// unticked gameweek (usedGameweeks.ts's `isGameweekScored`). He can set it any time until its
// deadline, to any ticked gameweek not begun, and once its deadline passes it's fixed. Unticking
// it moves it to the next ticked gameweek. A draft still running at its deadline moves it to the
// next gameweek after the draft ends, and the commissioner is told. A league with none set scores
// every ticked gameweek, as every league did before the rule, so no score moves; once it has scored
// one, none set is fixed too, so a start can't wipe the gameweeks it has played (Craig, 11 Nov 2026,
// on #1588).

/** Why a change to the scoring start was refused, as the commissioner is told it. */
export const scoringStartRefusals = {
  notAGameweek: noSuchGameweek,
  unticked: (gameweek: number) => `Gameweek ${gameweek} isn't one the league plays, so scoring can't start in it. Tick it first.`,
  begun: (gameweek: number) => begunRefusal(gameweek, "scoring can't start in it"),
  fixed: (gameweek: number) => `Scoring started in gameweek ${gameweek}, whose deadline has passed, so it can't move.`,
  seasonBegun: "The league has already scored a gameweek, so its season has started and every ticked gameweek scores: scoring can't start later now.",
  noDeadline: (gameweek: number) => noKickoffRefusal(gameweek, "whether it has begun"),
} as const;

/** Whether the league's scoring start has passed its deadline, so it's fixed. */
const isFixed = (league: Doc<"leagues">, deadlineIn: DeadlineOf, now: number) =>
  league.scoringStart !== undefined && isLocked(deadlineIn(league.scoringStart), now);

/** Whether the league, with no scoring start set, has already scored a gameweek, so none set is
 *  fixed (#1588): a start now would drop the gameweeks it has played from its table. */
const scoredWithNone = async (ctx: QueryCtx, league: Doc<"leagues">) =>
  league.scoringStart === undefined && (await begunGameweeks(ctx, league)).length > 0;

const scoringStartView = v.object({
  /** The gameweek scoring starts in, or null for none set: every ticked gameweek scores. */
  start: v.union(v.number(), v.null()),
  /** The league's ticked gameweeks, each with its deadline (null while its kickoff isn't known). */
  ticked: v.array(v.object({ gameweek: v.number(), deadline: shownDeadline })),
  /** With none set, whether the league has already scored a gameweek, so none set is fixed. */
  seasonBegun: v.boolean(),
});
export type ScoringStartView = Infer<typeof scoringStartView>;

/** The league's scoring start and the ticked gameweeks it can be set to, for League settings
 *  (#1190). Which have begun is for the screen to work out from their deadlines: a query doesn't
 *  read the clock. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues") },
  returns: scoringStartView,
  handler: async (ctx, { leagueId }) => {
    const { league } = await runnerOf(ctx, leagueId);
    const deadlineIn = deadlineOf(await leagueDeadlines(ctx, leagueId));
    return {
      start: league.scoringStart ?? null,
      ticked: usedGameweeksOf(league, await seasonGameweekCount(ctx)).map((gameweek) => ({ gameweek, deadline: deadlineIn(gameweek) })),
      seasonBegun: await scoredWithNone(ctx, league),
    };
  },
});

/** Sets the gameweek the league's scoring starts in: a ticked one not begun, while the start
 *  already set hasn't passed its deadline, or, with none set, the league hasn't scored a gameweek. */
export const setScoringStart = mutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek }) => {
    const { email, league } = await runnerOf(ctx, leagueId);
    const count = await seasonGameweekCount(ctx);
    if (!isGameweek(gameweek, count)) refuse(scoringStartRefusals.notAGameweek(gameweek, count));
    const deadlineIn = deadlineOf(await leagueDeadlines(ctx, leagueId));
    const now = Date.now();
    if (isFixed(league, deadlineIn, now)) refuse(scoringStartRefusals.fixed(league.scoringStart!));
    if (await scoredWithNone(ctx, league)) refuse(scoringStartRefusals.seasonBegun);
    if (!isGameweekUsed(league, gameweek, count)) refuse(scoringStartRefusals.unticked(gameweek));
    const deadline = deadlineIn(gameweek);
    if (deadline === null) refuse(scoringStartRefusals.noDeadline(gameweek));
    if (isLocked(deadline, now)) refuse(scoringStartRefusals.begun(gameweek));
    if (league.scoringStart === gameweek) return null;
    await ctx.db.patch("leagues", leagueId, { scoringStart: gameweek });
    await recordEvent(ctx, leagueId, email, { kind: "scoringStartSet", from: league.scoringStart ?? null, to: gameweek });
    return null;
  },
});

/** The scoring start once `gameweek` is unticked, in a season of `count`: the next ticked gameweek
 *  when it was the start, else the start as it is. With no ticked gameweek after it, it stays:
 *  nothing is scored either way. */
export function startAfterUntick(league: Pick<Doc<"leagues">, "unusedGameweeks" | "scoringStart">, gameweek: number, count: number): number | undefined {
  if (league.scoringStart !== gameweek) return league.scoringStart;
  return usedGameweeksOf(league, count).find((each) => each > gameweek) ?? gameweek;
}

/** A scoring start the draft's end moved, because the draft was still running at its deadline. */
export type MovedStart = { from: number; to: number };

/** Sets the scoring start as the draft ends at `now`: left as it is while its deadline is to come,
 *  else the next ticked gameweek after the draft, as is one never set. Says when it moved one set,
 *  so the commissioner can be told; nothing moves once every ticked gameweek has begun. */
export async function startAfterDraft(ctx: MutationCtx, league: Doc<"leagues">, now: number): Promise<MovedStart | null> {
  const deadlineIn = deadlineOf(await leagueDeadlines(ctx, league._id));
  if (league.scoringStart !== undefined && !isFixed(league, deadlineIn, now)) return null;
  const next = nextByDeadlines(usedGameweeksOf(league, await seasonGameweekCount(ctx)), deadlineIn, now);
  if (next === undefined) return null;
  await ctx.db.patch("leagues", league._id, { scoringStart: next });
  return league.scoringStart === undefined ? null : { from: league.scoringStart, to: next };
}
