import type { Infer } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { DAY_MS, linkOffWords, noLinkWords } from "./joiningShared";
import type { delivery } from "./schema";
import { EMAILS_PER_DAY, dayOf, type SignInReply } from "./signInLinks";

// What emailed invites, the invite link and join requests share (#73, spec/13 Joining).

export type Delivery = Infer<typeof delivery>;

/** Why a joining change was refused, as the person who asked is told it. */
export const joiningRefusals = {
  noInvite: "That invite doesn't exist.",
  inviteEnded: "That invite has ended: the person signed in, or it was cancelled.",
  alreadyInvited: (email: string) => `${email} already has an invite to this league: resend it instead.`,
  inviteWaiting: "That invite waits for tomorrow, when it goes by itself.",
  noLink: noLinkWords,
  linkOff: linkOffWords,
  alreadyIn: "You already run a team in this league.",
  noRequest: "That join request doesn't exist.",
  requestDecided: "That join request has already been approved or refused.",
} as const;

/** The start of the UTC day after `time`'s, when Resend's daily limit starts again. */
export function startOfNextDay(time: number): number {
  return Date.parse(dayOf(time)) + DAY_MS;
}

/** Where an email stands after asking for a sign-in link (signInLinks.ts) to carry it. */
export function deliveryOf(reply: SignInReply): Delivery {
  switch (reply) {
    case "checkYourEmail":
      return "sent";
    case "paused":
      return "waiting";
    case "tryLater":
    case "notSent":
      return reply;
  }
}

/** Counts one more of today's emails, as signInLinks:recordAsk counts a link; false, counting
 *  nothing, when the day's are all gone. */
export async function takeTodaysEmail(ctx: MutationCtx): Promise<boolean> {
  const day = dayOf(Date.now());
  const sentToday = await ctx.db
    .query("emailSends")
    .withIndex("by_day", (q) => q.eq("day", day))
    .unique();
  if ((sentToday?.count ?? 0) >= EMAILS_PER_DAY) return false;
  if (sentToday) await ctx.db.patch("emailSends", sentToday._id, { count: sentToday.count + 1 });
  else await ctx.db.insert("emailSends", { day, count: 1 });
  return true;
}
