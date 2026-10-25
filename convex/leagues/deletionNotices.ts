import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, type ActionCtx } from "../_generated/server";
import { sendEmail } from "../outbound/email";
import { takeTodaysEmail as takeOne } from "../outbound/emailLimit";
import { unemailedReason } from "../schema";

// The email each person with a part in a league gets once leagueDeletion.deleteForGood has removed
// it (#320, spec/13, Deleting): "just delay the deletion email until its actually gone". Each
// counts against the day's emails as a sign-in link does (emailLimit.ts). One the limit or the
// email service stops is logged and kept in unemailedDeletions, as there is no league left to
// keep it on.

/** Wording for Craig to change in the pull request. */
function deletionEmail(leagueName: string, by: string) {
  return {
    subject: `${leagueName} has been deleted`,
    text: `${by} deleted ${leagueName}. It is gone for good, with its teams, Mail and history.`,
  };
}

/** What the log says when one person wasn't emailed, before why. */
export const notEmailedLog = (to: string) => `The email saying a league has been deleted wasn't sent to ${to}:`;
/** Why, when the day's limit stopped it. */
export const PAUSED_LOG = "today's emails have all been sent";

export const send = internalAction({
  args: { leagueName: v.string(), by: v.string(), emails: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { leagueName, by, emails }) => {
    const email = deletionEmail(leagueName, by);
    for (const to of emails) {
      const reason = await sendOne(ctx, to, email);
      if (reason) await ctx.runMutation(internal.leagues.deletionNotices.recordUnemailed, { leagueName, by, email: to, reason });
    }
    return null;
  },
});

/** Sends one email if the day has one left: null once sent, or why it wasn't, logged. */
async function sendOne(
  ctx: ActionCtx,
  to: string,
  email: ReturnType<typeof deletionEmail>,
): Promise<Infer<typeof unemailedReason> | null> {
  if (!(await ctx.runMutation(internal.leagues.deletionNotices.takeTodaysEmail, {}))) {
    console.error(notEmailedLog(to), PAUSED_LOG);
    return "paused";
  }
  try {
    await sendEmail(to, email);
    return null;
  } catch (error) {
    console.error(notEmailedLog(to), error);
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
  args: { leagueName: v.string(), by: v.string(), email: v.string(), reason: unemailedReason },
  returns: v.null(),
  handler: async (ctx, row) => {
    await ctx.db.insert("unemailedDeletions", { ...row, at: Date.now() });
    return null;
  },
});
