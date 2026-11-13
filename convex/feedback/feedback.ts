import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { adminOf, callerEmail, refuse } from "../shared/leagueAccess";
import { takeShown } from "../shared/cappedRead";
import { DAY_MS } from "../shared/time";
import { typedText } from "../shared/typedText";
import { FEEDBACK_A_DAY, FEEDBACK_MAX, FEEDBACK_SHOWN } from "./feedbackLimits";

// Feedback to the admin (#357; spec/12 The frame, spec/15 The admin): anyone signed in sends one
// message from the top bar's Feedback link, at most FEEDBACK_A_DAY a day, and the admin reads them
// all on his dashboard, marking one read or deleting it (#395, S15.5). No email goes with it.

/** Why feedback was refused: sending, as the person who sent it is told it, and the admin's. */
export const feedbackRefusals = {
  blank: "Write something first.",
  tooLong: `Feedback is up to ${FEEDBACK_MAX} characters.`,
  tooMany: `You've sent the admin ${FEEDBACK_A_DAY} messages in the last day, the most allowed. Try again tomorrow.`,
  /** The admin's: the message he marked or deleted is gone, deleted in another tab, say. */
  gone: "That feedback has been deleted.",
} as const;

/** One message, by who sent it (their email) and when. */
const feedbackEntry = v.object({
  feedbackId: v.id("feedback"),
  from: v.string(),
  at: v.number(),
  message: v.string(),
  /** Whether the admin marked it read. */
  read: v.boolean(),
});

const feedbackList = v.object({
  /** The newest FEEDBACK_SHOWN, newest first. */
  entries: v.array(feedbackEntry),
  /** Whether more were sent than `entries` lists: the page says so, never a silent cut. */
  more: v.boolean(),
});
export type FeedbackList = Infer<typeof feedbackList>;

/** Sends the admin a message from the signed-in person, trimmed: at most FEEDBACK_A_DAY in any 24
 *  hours. Only what is still kept counts, so a message the admin deleted frees its place. */
export const send = mutation({
  args: { message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const from = await callerEmail(ctx);
    const message = typedText(args.message, FEEDBACK_MAX, feedbackRefusals);
    const now = Date.now();
    const lastDay = await ctx.db
      .query("feedback")
      .withIndex("by_from_and_at", (q) => q.eq("from", from).gt("at", now - DAY_MS))
      .take(FEEDBACK_A_DAY);
    if (lastDay.length >= FEEDBACK_A_DAY) refuse(feedbackRefusals.tooMany);
    await ctx.db.insert("feedback", { from, at: now, message });
    return null;
  },
});

/** The admin's list of what was sent: his alone. */
export const list = query({
  args: {},
  returns: feedbackList,
  handler: async (ctx) => {
    await adminOf(ctx);
    const { rows, more } = await takeShown(ctx.db.query("feedback").withIndex("by_at").order("desc"), FEEDBACK_SHOWN);
    return {
      entries: rows.map((row) => ({ feedbackId: row._id, from: row.from, at: row.at, message: row.message, read: row.readAt !== undefined })),
      more,
    };
  },
});

/** The message, if the caller is the admin and it is still kept. */
async function adminsFeedback(ctx: MutationCtx, feedbackId: Id<"feedback">) {
  await adminOf(ctx);
  return (await ctx.db.get("feedback", feedbackId)) ?? refuse(feedbackRefusals.gone);
}

/** The admin marks a message read; one already read keeps when it was first marked. */
export const markRead = mutation({
  args: { feedbackId: v.id("feedback") },
  returns: v.null(),
  handler: async (ctx, { feedbackId }) => {
    const row = await adminsFeedback(ctx, feedbackId);
    if (row.readAt === undefined) await ctx.db.patch("feedback", feedbackId, { readAt: Date.now() });
    return null;
  },
});

/** The admin deletes a message for good. */
export const remove = mutation({
  args: { feedbackId: v.id("feedback") },
  returns: v.null(),
  handler: async (ctx, { feedbackId }) => {
    await adminsFeedback(ctx, feedbackId);
    await ctx.db.delete("feedback", feedbackId);
    return null;
  },
});
