import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { adminOf, callerEmail } from "../shared/leagueAccess";
import { typedText } from "../shared/typedText";
import { FEEDBACK_MAX, FEEDBACK_SHOWN } from "./feedbackLimits";

// Feedback to the admin (#357; spec/12 The frame, spec/15 The admin): anyone signed in sends one
// message from the top bar's Feedback link, and the admin reads them all on his dashboard. No
// email goes with it.

/** Why sending feedback was refused, as the person who sent it is told it. */
export const feedbackRefusals = {
  blank: "Write something first.",
  tooLong: `Feedback is up to ${FEEDBACK_MAX} characters.`,
} as const;

/** One message, by who sent it (their email) and when. */
const feedbackEntry = v.object({
  feedbackId: v.id("feedback"),
  from: v.string(),
  at: v.number(),
  message: v.string(),
});

const feedbackList = v.object({
  /** The newest FEEDBACK_SHOWN, newest first. */
  entries: v.array(feedbackEntry),
  /** Whether more were sent than `entries` lists: the page says so, never a silent cut. */
  more: v.boolean(),
});
export type FeedbackList = Infer<typeof feedbackList>;

/** Sends the admin a message from the signed-in person, trimmed. */
export const send = mutation({
  args: { message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const from = await callerEmail(ctx);
    const message = typedText(args.message, FEEDBACK_MAX, feedbackRefusals);
    await ctx.db.insert("feedback", { from, at: Date.now(), message });
    return null;
  },
});

/** The admin's list of what was sent: his alone. */
export const list = query({
  args: {},
  returns: feedbackList,
  handler: async (ctx) => {
    await adminOf(ctx);
    const rows = await ctx.db.query("feedback").withIndex("by_at").order("desc").take(FEEDBACK_SHOWN + 1);
    return {
      entries: rows.slice(0, FEEDBACK_SHOWN).map((row) => ({ feedbackId: row._id, from: row.from, at: row.at, message: row.message })),
      more: rows.length > FEEDBACK_SHOWN,
    };
  },
});
