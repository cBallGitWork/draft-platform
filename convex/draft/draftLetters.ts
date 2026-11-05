import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, type MutationCtx } from "../_generated/server";
import { draftNotStartedLetter, draftOverLetter, draftPausedLetter, upNextLetter } from "../mail/letterWords";
import { bylineOf, fileLetter, wholeLeague } from "../mail/letters";
import { sendEmail } from "../outbound/email";
import { takeTodaysEmail } from "../outbound/emailLimit";
import { MINUTE_MS } from "../shared/time";
import { zoneOf } from "../signIn/timeZone";
import type { Clocked } from "./draftClock";

// The draft's letters (spec/04, Mail; #1102), Craig's "Up next + draft over" (4 Nov 2026): the
// manager whose pick's clock starts gets "you're up next", with no letter to everyone for every
// pick; the whole league gets one letter when the draft ends, and one when the commissioner pauses
// it, none when he resumes; and the commissioner gets one when a start date comes and the draft
// can't start. A team with no manager has no one to tell. "You're up next" also goes
// by email when the clock is over 10 minutes (spec/11): in a live draft managers are on the draft
// page. It counts against the day's emails (emailLimit.ts); with none left it isn't sent, as a
// clock can't wait for tomorrow, and that is logged. The letter for the commissioner's undo and his
// pick for a manager come with them (#1095).

/** How long a pick's clock must be, at the least, for "you're up next" to go by email too (spec/11:
 *  "over 10 minutes"). */
export const UP_NEXT_EMAIL_OVER_MS = 10 * MINUTE_MS;

/** Tells the manager of the team on `clocked`'s clock, which runs `pickMs`, that he is up next. */
export async function tellUpNext(ctx: MutationCtx, league: Doc<"leagues">, clocked: Clocked, pickMs: number): Promise<void> {
  const to = clocked.team.managerEmail;
  if (to === undefined) return;
  const news = { round: clocked.round, pick: clocked.pick, teamName: clocked.team.name, endsAt: clocked.endsAt };
  await fileLetter(ctx, league, [to], (zone) => upNextLetter(news, zone));
  if (pickMs <= UP_NEXT_EMAIL_OVER_MS) return;
  if (!(await takeTodaysEmail(ctx))) {
    console.warn(`${to} wasn't emailed that they're up next in ${league.name}'s draft: the day's emails are all gone`);
    return;
  }
  const { subject, body } = upNextLetter(news, await zoneOf(ctx, to));
  await ctx.scheduler.runAfter(0, internal.draft.draftLetters.sendUpNext, { to, subject, text: body });
}

/** Tells the whole league the draft is over, after its `picks` picks. */
export async function tellDraftOver(ctx: MutationCtx, league: Doc<"leagues">, picks: number): Promise<void> {
  await fileLetter(ctx, league, await wholeLeague(ctx, league), draftOverLetter(picks));
}

/** Tells the whole league `by`, the commissioner, paused the draft. */
export async function tellPaused(ctx: MutationCtx, league: Doc<"leagues">, by: string): Promise<void> {
  await fileLetter(ctx, league, await wholeLeague(ctx, league), draftPausedLetter(bylineOf(by)), by);
}

/** Tells the commissioner the draft didn't start at its date, `startsAt`, for `refusal`. */
export async function tellNotStarted(ctx: MutationCtx, league: Doc<"leagues">, startsAt: number, refusal: string): Promise<void> {
  await fileLetter(ctx, league, [league.commissionerEmail], (zone) => draftNotStartedLetter(startsAt, refusal, zone));
}

/** Sends the "you're up next" email, already counted; a refusal is logged. */
export const sendUpNext = internalAction({
  args: { to: v.string(), subject: v.string(), text: v.string() },
  returns: v.null(),
  handler: async (_ctx, { to, ...words }) => {
    try {
      await sendEmail(to, words);
    } catch (error) {
      console.error(`The email saying ${to} is up next in the draft wasn't sent:`, error);
    }
    return null;
  },
});
