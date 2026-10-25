import { v, type Infer } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { callerEmail, refuse, runnerOf, signedInEmail } from "../shared/leagueAccess";
import { PRODUCT_NAME } from "../shared/product";
import { fileLetter, wholeLeague } from "./letters";
import { BODY_MAX, LETTERS_SHOWN, SUBJECT_MAX } from "./mailLimits";

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
  /** Where it came from: its league's name, or the product's for a letter from the site. */
  leagueName: v.string(),
  at: v.number(),
  from: v.union(v.string(), v.null()),
  subject: v.string(),
  body: v.string(),
  read: v.boolean(),
});
export type LetterSummary = Infer<typeof letterSummary>;

/** The letters Mail lists for someone: their latest LETTERS_SHOWN, newest first. */
const listedLetters = (ctx: QueryCtx, email: string) =>
  ctx.db
    .query("letters")
    .withIndex("by_to_and_at", (q) => q.eq("to", email))
    .order("desc")
    .take(LETTERS_SHOWN);

/** The signed-in person's `listedLetters`. None when signed out. */
export const letters = query({
  args: {},
  returns: v.array(letterSummary),
  handler: async (ctx) => {
    const email = await signedInEmail(ctx);
    if (email === null) return [];
    const rows = await listedLetters(ctx, email);
    return rows.map((row) => ({
      letterId: row._id,
      leagueName: row.leagueName ?? PRODUCT_NAME,
      at: row.at,
      from: row.from ?? null,
      subject: row.subject,
      body: row.body,
      read: row.readAt !== undefined,
    }));
  },
});

/** How many of the letters `letters` lists are unread, so opening every one clears it. At most
 *  LETTERS_SHOWN; the screens show anything past UNREAD_COUNTED as that number and a "+". */
export const unreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const email = await signedInEmail(ctx);
    if (email === null) return 0;
    return (await listedLetters(ctx, email)).filter((row) => row.readAt === undefined).length;
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

/** spec/16: the commissioner's one-way letter to the whole league, pinned on league home until a
 *  newer one (spec/12). The co-commissioner and the admin may send one too, as they may do anything
 *  the commissioner does (spec/15). */
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
    await ctx.db.patch("leagues", league._id, { pinnedLetter: { at: Date.now(), from: email, subject, body } });
    return null;
  },
});
