import { v, type Infer } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalMutation, type ActionCtx, type MutationCtx } from "./_generated/server";
import { isAllowed, normaliseEmail } from "./allowedEmails";
import { anEmailLeftToday, countTodaysEmail } from "./emailLimit";
import { HOUR_MS, MINUTE_MS } from "./time";

// Asking for a sign-in link (spec/02, #20). The sign-in page asks through `ask`, which applies the
// hourly limit, the day's email limit and the allowed list before Convex Auth makes a link, so a
// refused ask never replaces the link an earlier email carries. Convex Auth's `auth:signIn` is
// public too, so the mutation that makes a link first claims the ask that let this email through
// a moment ago (`claimAsk`, from convex/auth.ts): called directly, it is refused with nothing
// written, so no earlier link is replaced and no account is made.

/** spec/02: one email asks for at most this many links an hour. */
export const ASKS_PER_HOUR = 3;
/** How long after `ask` lets an email through its link may take that ask. */
const CLAIM_WINDOW_MS = MINUTE_MS;

/** The replies that mean no link went. */
export const noLinkReply = v.union(v.literal("tryLater"), v.literal("paused"), v.literal("notSent"));
export type NoLinkReply = Infer<typeof noLinkReply>;
/** What the sign-in page tells the visitor. `checkYourEmail` goes to listed and unlisted alike. */
export const signInReply = v.union(v.literal("checkYourEmail"), ...noLinkReply.members);
export type SignInReply = Infer<typeof signInReply>;

const askOutcome = v.union(
  v.object({ outcome: v.literal("send"), askId: v.id("signInAsks") }),
  v.object({ outcome: v.union(v.literal("unlisted"), v.literal("tryLater"), v.literal("paused")) }),
);

export const ask = action({
  args: { email: v.string() },
  returns: signInReply,
  handler: (ctx, { email }) => askForLink(ctx, email),
});

/** `ask`'s work, for the server's own sends too: a newly named commissioner's link (leagues.ts),
 *  and joining's (#73), whose links lead back to `redirectTo`, a path in the app. */
export async function askForLink(ctx: ActionCtx, typedEmail: string, redirectTo?: string): Promise<SignInReply> {
  const email = normaliseEmail(typedEmail);
  const asked: Infer<typeof askOutcome> = await ctx.runMutation(internal.signInLinks.recordAsk, { email });
  switch (asked.outcome) {
    case "tryLater":
    case "paused":
      return asked.outcome;
    case "unlisted":
      return "checkYourEmail";
    case "send":
      try {
        // Convex Auth's own action makes the link and sends it: only it holds its config.
        await ctx.runAction(api.auth.signIn, { provider: "resend", params: { email, redirectTo } });
        return "checkYourEmail";
      } catch (error) {
        const sendError = error instanceof Error ? error.message : String(error);
        console.error(`The sign-in link to ${email} wasn't sent: ${sendError}`);
        await ctx.runMutation(internal.signInLinks.recordSendError, { askId: asked.askId, sendError });
        return "notSent";
      }
  }
}

export const recordAsk = internalMutation({
  args: { email: v.string() },
  returns: askOutcome,
  handler: async (ctx, { email }) => {
    const now = Date.now();
    const lastHour = await ctx.db
      .query("signInAsks")
      .withIndex("by_email_and_askedAt", (q) => q.eq("email", email).gt("askedAt", now - HOUR_MS))
      .take(ASKS_PER_HOUR);
    if (lastHour.length >= ASKS_PER_HOUR) return { outcome: "tryLater" as const };

    // Before the list is read, so a paused day reads the same for every email.
    if (!(await anEmailLeftToday(ctx))) return { outcome: "paused" as const };

    const listed = await isAllowed(ctx, email);
    const askId = await ctx.db.insert("signInAsks", { email, askedAt: now, listed });
    if (!listed) return { outcome: "unlisted" as const };

    // Counted before it is sent, as every email is (emailLimit.ts).
    await countTodaysEmail(ctx);
    return { outcome: "send" as const, askId };
  },
});

/** Claims the oldest ask that let this email through in the last minute and that no link has
 *  claimed yet, so two asks at once each get theirs; throws with none. The email must match as
 *  `ask` stored it, trimmed and lower-cased. */
export async function claimAsk(ctx: MutationCtx, email: string): Promise<void> {
  const now = Date.now();
  const lastMinute = await ctx.db
    .query("signInAsks")
    .withIndex("by_email_and_askedAt", (q) => q.eq("email", email).gt("askedAt", now - CLAIM_WINDOW_MS))
    .take(ASKS_PER_HOUR);
  const unclaimed = lastMinute.find((asked) => asked.listed && asked.claimedAt === undefined);
  if (!unclaimed) throw new Error(`No ask let ${email} through: a sign-in link is sent only by signInLinks:ask`);
  await ctx.db.patch("signInAsks", unclaimed._id, { claimedAt: now });
}

export const recordSendError = internalMutation({
  args: { askId: v.id("signInAsks"), sendError: v.string() },
  returns: v.null(),
  handler: async (ctx, { askId, sendError }) => {
    await ctx.db.patch("signInAsks", askId, { sendError });
    return null;
  },
});
