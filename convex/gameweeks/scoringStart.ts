import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { latestRules } from "../rules/rulesHistory";
import { refuse, runnerOf } from "../shared/leagueAccess";
import { isLocked, type DeadlineOf } from "./deadline";
import { deadlineOf, leagueDeadlines } from "./leagueDeadlines";
import { nextByDeadlines } from "./nextGameweek";
import { isGameweek, isGameweekUsed, noSuchGameweek, usedGameweeksOf } from "./usedGameweeks";

// The league's scoring start (spec/04, After the draft; #1097): "scoring starts in gameweek N", set
// by the commissioner, defaulting to the next gameweek after the draft ends; squads and lineups
// count from that gameweek's deadline (Craig, 5 Nov 2026). The gameweeks before it score nothing
// and have no head-to-head, and free agency and trades stay open through them, as through an
// unticked gameweek (usedGameweeks.ts's `isGameweekScored`). He can set it any time until its
// deadline, to any ticked gameweek not begun, and once its deadline passes it's fixed. Unticking
// it moves it to the next ticked gameweek. A draft still running at its deadline moves it to the
// next gameweek after the draft ends, and the commissioner is told. A league with none set scores
// every ticked gameweek, as every league did before the rule, so no score moves.

/** Why a change to the scoring start was refused, as the commissioner is told it. */
export const scoringStartRefusals = {
  notAGameweek: noSuchGameweek,
  unticked: (gameweek: number) => `Gameweek ${gameweek} isn't one the league plays, so scoring can't start in it. Tick it first.`,
  begun: (gameweek: number) => `Gameweek ${gameweek} has begun, so scoring can't start in it.`,
  fixed: (gameweek: number) => `Scoring started in gameweek ${gameweek}, whose deadline has passed, so it can't move.`,
  noRules: "This league has no rules yet, so it has no deadline, and its scoring start can't be set. It was made before leagues held their rules.",
  noDeadline: (gameweek: number) =>
    `The app doesn't have a kickoff time for gameweek ${gameweek} yet, so it can't tell whether it has begun. Try again once the season's matches have arrived.`,
} as const;

/** Whether the league's scoring start has passed its deadline, so it's fixed. */
const isFixed = (league: Doc<"leagues">, deadlineIn: DeadlineOf, now: number) =>
  league.scoringStart !== undefined && isLocked(deadlineIn(league.scoringStart), now);

/** Sets the gameweek the league's scoring starts in: a ticked one not begun, while the start
 *  already set hasn't passed its deadline. */
export const setScoringStart = mutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek }) => {
    const { league } = await runnerOf(ctx, leagueId);
    if (!isGameweek(gameweek)) refuse(scoringStartRefusals.notAGameweek(gameweek));
    if ((await latestRules(ctx, leagueId)) === null) refuse(scoringStartRefusals.noRules);
    const deadlineIn = deadlineOf(await leagueDeadlines(ctx, leagueId));
    const now = Date.now();
    if (isFixed(league, deadlineIn, now)) refuse(scoringStartRefusals.fixed(league.scoringStart!));
    if (!isGameweekUsed(league, gameweek)) refuse(scoringStartRefusals.unticked(gameweek));
    const deadline = deadlineIn(gameweek);
    if (deadline === null) refuse(scoringStartRefusals.noDeadline(gameweek));
    if (isLocked(deadline, now)) refuse(scoringStartRefusals.begun(gameweek));
    if (league.scoringStart !== gameweek) await ctx.db.patch("leagues", leagueId, { scoringStart: gameweek });
    return null;
  },
});

/** The scoring start once `gameweek` is unticked: the next ticked gameweek when it was the start,
 *  else the start as it is. With no ticked gameweek after it, it stays: nothing is scored either way. */
export function startAfterUntick(league: Pick<Doc<"leagues">, "unusedGameweeks" | "scoringStart">, gameweek: number): number | undefined {
  if (league.scoringStart !== gameweek) return league.scoringStart;
  return usedGameweeksOf(league).find((each) => each > gameweek) ?? gameweek;
}

/** A scoring start the draft's end moved, because the draft was still running at its deadline. */
export type MovedStart = { from: number; to: number };

/** Sets the scoring start as the draft ends at `now`: left as it is while its deadline is to come,
 *  else the next ticked gameweek after the draft, as is one never set. Says when it moved one set,
 *  so the commissioner can be told; nothing moves once every ticked gameweek has begun. */
export async function startAfterDraft(ctx: MutationCtx, league: Doc<"leagues">, now: number): Promise<MovedStart | null> {
  const deadlineIn = deadlineOf(await leagueDeadlines(ctx, league._id));
  if (league.scoringStart !== undefined && !isFixed(league, deadlineIn, now)) return null;
  const next = nextByDeadlines(usedGameweeksOf(league), deadlineIn, now);
  if (next === undefined) return null;
  await ctx.db.patch("leagues", league._id, { scoringStart: next });
  return league.scoringStart === undefined ? null : { from: league.scoringStart, to: next };
}
