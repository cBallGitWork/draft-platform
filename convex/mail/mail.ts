import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { callerEmail, refuse, runnerOf, signedInEmail } from "../shared/leagueAccess";
import { fileLetter, wholeLeague } from "./letters";
import { BODY_MAX, LETTERS_SHOWN, SUBJECT_MAX, UNREAD_COUNTED } from "./mailLimits";

// A manager's Mail (#26, spec/16): their letters, newest first, each unread until they open it,
// and the commissioner's one-way letter to the whole league.

/** Why a Mail change was refused, as the person who asked is told it. */
export const mailRefusals = {
  noLetter: "That letter isn't in your Mail.",
  blankSubject: "Give the letter a subject.",
  blankBody: "Write something in the letter.",
  subjectTooLong: `A letter's subject is up to ${SUBJECT_MAX} characters.`,
  bodyTooLong: `A letter is up to ${BODY_MAX} characters.`,
} as const;

export const letterSummary = v.object({
  letterId: v.id("letters"),
  leagueName: v.string(),
  at: v.number(),
  from: v.union(v.string(), v.null()),
  subject: v.string(),
  body: v.string(),
  read: v.boolean(),
});
export type LetterSummary = Infer<typeof letterSummary>;

/** The signed-in person's letters, newest first: the latest LETTERS_SHOWN. None when signed out. */
export const letters = query({
  args: {},
  returns: v.array(letterSummary),
  handler: async (ctx) => {
    const email = await signedInEmail(ctx);
    if (email === null) return [];
    const rows = await ctx.db
      .query("letters")
      .withIndex("by_to_and_at", (q) => q.eq("to", email))
      .order("desc")
      .take(LETTERS_SHOWN);
    return rows.map((row) => ({
      letterId: row._id,
      leagueName: row.leagueName,
      at: row.at,
      from: row.from ?? null,
      subject: row.subject,
      body: row.body,
      read: row.readAt !== undefined,
    }));
  },
});

/** How many of the signed-in person's letters are unread, counted up to one past UNREAD_COUNTED. */
export const unreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const email = await signedInEmail(ctx);
    if (email === null) return 0;
    const unread = await ctx.db
      .query("letters")
      .withIndex("by_to_and_readAt", (q) => q.eq("to", email).eq("readAt", undefined))
      .take(UNREAD_COUNTED + 1);
    return unread.length;
  },
});

/** Opening a letter marks it read, once. Only the person it's to may. */
export const open = mutation({
  args: { letterId: v.id("letters") },
  returns: v.null(),
  handler: async (ctx, { letterId }) => {
    const email = await callerEmail(ctx);
    const letter = await ctx.db.get("letters", letterId);
    if (letter === null || letter.to !== email) refuse(mailRefusals.noLetter);
    if (letter.readAt === undefined) await ctx.db.patch("letters", letterId, { readAt: Date.now() });
    return null;
  },
});

/** spec/16: the commissioner's one-way letter to the whole league. The co-commissioner and the
 *  admin may send one too, as they may do anything the commissioner does (spec/15). */
export const writeToLeague = mutation({
  args: { leagueId: v.id("leagues"), subject: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { email, league } = await runnerOf(ctx, args.leagueId);
    const subject = args.subject.trim();
    const body = args.body.trim();
    if (!subject) refuse(mailRefusals.blankSubject);
    if (!body) refuse(mailRefusals.blankBody);
    if ([...subject].length > SUBJECT_MAX) refuse(mailRefusals.subjectTooLong);
    if ([...body].length > BODY_MAX) refuse(mailRefusals.bodyTooLong);
    await fileLetter(ctx, league, await wholeLeague(ctx, league), { subject, body, from: email }, email);
    return null;
  },
});
