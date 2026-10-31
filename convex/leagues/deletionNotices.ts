import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { sendEmail } from "../outbound/email";
import { startOfNextDay, takeTodaysEmail as takeOne } from "../outbound/emailLimit";
import { unemailedReason } from "../schema";

// The email each person with a part in a league gets once leagueDeletion.deleteForGood has removed
// it (#320, spec/13, Deleting): "just delay the deletion email until its actually gone". Each
// counts against the day's emails as a sign-in link does (emailLimit.ts). Those past the day's
// limit wait for the next day, as invites do (spec/13, #837): `send` runs again then with the
// emails left, a job carrying its own arguments, so nothing waiting is saved anywhere else. One the
// email service refuses is logged and kept in unemailedDeletions, as there is no league left to
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
/** What the log says when the day's limit leaves `count` of them for the next day. */
export const waitingLog = (count: number) =>
  `${count} of the emails saying a league has been deleted wait for tomorrow: today's have all been sent`;

// Its path is saved with each run waiting for tomorrow: renaming it is its own PR (docs/REFACTORING.md).
export const send = internalAction({
  args: { leagueName: v.string(), by: v.string(), emails: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { leagueName, by, emails }) => {
    const email = deletionEmail(leagueName, by);
    for (const [index, to] of emails.entries()) {
      if (!(await ctx.runMutation(internal.leagues.deletionNotices.takeTodaysEmail, {}))) {
        const waiting = emails.slice(index);
        console.log(waitingLog(waiting.length));
        await ctx.scheduler.runAt(startOfNextDay(Date.now()), internal.leagues.deletionNotices.send, { leagueName, by, emails: waiting });
        return null;
      }
      if (!(await sent(to, email))) await ctx.runMutation(internal.leagues.deletionNotices.recordUnemailed, { leagueName, by, email: to });
    }
    return null;
  },
});

/** Sends one email, already counted: whether the email service took it, a refusal logged. */
async function sent(to: string, email: ReturnType<typeof deletionEmail>): Promise<boolean> {
  try {
    await sendEmail(to, email);
    return true;
  } catch (error) {
    console.error(notEmailedLog(to), error);
    return false;
  }
}

/** Counts one of today's emails, or says none is left (emailLimit.ts): an action's way in. */
export const takeTodaysEmail = internalMutation({
  args: {},
  returns: v.boolean(),
  handler: (ctx) => takeOne(ctx),
});

/** Keeps one the email service refused. Rows with reason "paused" were kept before #837, when the
 *  day's limit dropped an email rather than waiting: none is written now. `reason` is taken only
 *  from a run started before #837 deployed, so it can finish; drop it after one release (#856). */
export const recordUnemailed = internalMutation({
  args: { leagueName: v.string(), by: v.string(), email: v.string(), reason: v.optional(unemailedReason) },
  returns: v.null(),
  handler: async (ctx, { reason = "notSent", ...row }) => {
    await ctx.db.insert("unemailedDeletions", { ...row, reason, at: Date.now() });
    return null;
  },
});
