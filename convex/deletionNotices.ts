import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, type ActionCtx } from "./_generated/server";
import { takeTodaysEmail as takeOne } from "./emailLimit";
import { londonTime } from "./londonTime";
import { unemailedReason } from "./schema";
import { sendEmail } from "./signInEmail";

// The email each person with a part in a league gets when it is deleted (#75, spec/13, Deleting):
// that it will be deleted, and when. Each counts against the day's emails as a sign-in link does
// (emailLimit.ts); one the limit or the email service stops is kept on the league, so whoever
// deleted it sees who wasn't told.

/** Wording for Craig to change in the pull request. */
export function deletionEmail(leagueName: string, by: string, deletesAt: number) {
  return {
    subject: `${leagueName} will be deleted`,
    text: [
      `${by} deleted ${leagueName}. It will be gone for good, with its teams, Mail and history, on ${londonTime(deletesAt)}.`,
      "",
      "Until then it is frozen, and only whoever deleted it, or the admin, can undo it.",
    ].join("\n"),
  };
}

export const send = internalAction({
  args: { leagueId: v.id("leagues"), leagueName: v.string(), by: v.string(), deletesAt: v.number(), emails: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { leagueId, leagueName, by, deletesAt, emails }) => {
    const email = deletionEmail(leagueName, by, deletesAt);
    for (const to of emails) {
      const reason = await sendOne(ctx, to, email);
      if (reason) await ctx.runMutation(internal.deletionNotices.recordUnemailed, { leagueId, email: to, reason });
    }
    return null;
  },
});

/** Sends one email if the day has one left: null once sent, or why it wasn't. */
async function sendOne(
  ctx: ActionCtx,
  to: string,
  email: ReturnType<typeof deletionEmail>,
): Promise<Infer<typeof unemailedReason> | null> {
  if (!(await ctx.runMutation(internal.deletionNotices.takeTodaysEmail, {}))) return "paused";
  try {
    await sendEmail(to, email);
    return null;
  } catch (error) {
    console.error(`The email saying a league will be deleted wasn't sent to ${to}:`, error);
    return "notSent";
  }
}

/** Counts one of today's emails, or says none is left (emailLimit.ts): an action's way in. */
export const takeTodaysEmail = internalMutation({
  args: {},
  returns: v.boolean(),
  handler: (ctx) => takeOne(ctx),
});

export const recordUnemailed = internalMutation({
  args: { leagueId: v.id("leagues"), email: v.string(), reason: unemailedReason },
  returns: v.null(),
  handler: async (ctx, { leagueId, email, reason }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (!league) throw new Error(`League ${leagueId} is gone, so that ${email} wasn't told of its deletion can't be kept on it`);
    // Undone already: nobody is waiting to hear who wasn't told.
    if (!league.deletion) return null;
    const unemailed = [...league.deletion.unemailed, { email, reason }];
    await ctx.db.patch("leagues", leagueId, { deletion: { ...league.deletion, unemailed } });
    return null;
  },
});
