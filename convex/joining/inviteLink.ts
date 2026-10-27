import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalMutation, mutation, type QueryCtx } from "../_generated/server";
import { admitEmail } from "../signIn/allowedEmails";
import { joinPath } from "./joiningShared";
import { joiningRefusals } from "./joining";
import { namedEmail, refuse, runnerOf } from "../shared/leagueAccess";
import { recordEvent } from "../mail/letters";
import { askForLink } from "../signIn/signInLinks";
import { signInReply } from "../signIn/signInReplies";

// A league's one invite link (#73, spec/13 Joining): opening it only asks to join. Its runners
// make it, replace it or switch it off, and the old one then stops working. A beta: a leaked link
// needs no guarding, since the commissioner approves each request.

/** The live link with this token, or null when it was replaced or switched off. */
export function linkWithToken(ctx: QueryCtx, token: string) {
  return ctx.db
    .query("inviteLinks")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

/** The league's live link, or null when it has none. */
export function linkOf(ctx: QueryCtx, leagueId: Id<"leagues">) {
  return ctx.db
    .query("inviteLinks")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
    .unique();
}

/** Makes the league's invite link, replacing any it has. */
export const make = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { email: by } = await runnerOf(ctx, leagueId);
    const old = await linkOf(ctx, leagueId);
    if (old) await ctx.db.delete("inviteLinks", old._id);
    await ctx.db.insert("inviteLinks", { leagueId, token: crypto.randomUUID() });
    await recordEvent(ctx, leagueId, by, { kind: "inviteLinkMade", replacedOne: old !== null });
    return null;
  },
});

/** Switches the league's invite link off: it stops working, and the league has none. */
export const switchOff = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { email: by } = await runnerOf(ctx, leagueId);
    const link = await linkOf(ctx, leagueId);
    if (!link) refuse(joiningRefusals.noLink);
    await ctx.db.delete("inviteLinks", link._id);
    await recordEvent(ctx, leagueId, by, { kind: "inviteLinkSwitchedOff" });
    return null;
  },
});

/** What asking for a sign-in link from the invite link answers: the sign-in page's answers, or
 *  that the link no longer works. */
export const signInToJoinReply = v.union(...signInReply.members, v.literal("linkOff"));
export type SignInToJoinReply = Infer<typeof signInToJoinReply>;

/** Asks for a sign-in link that leads back to the invite link. Anyone opening a live one may
 *  sign in, on the allowed list or not, to ask to join (spec/02). */
export const signInToJoin = action({
  args: { token: v.string(), email: v.string() },
  returns: signInToJoinReply,
  handler: async (ctx, { token, email }): Promise<SignInToJoinReply> => {
    const admitted: boolean = await ctx.runMutation(internal.joining.inviteLink.admitToAsk, { token, email });
    return admitted ? await askForLink(ctx, email, joinPath(token)) : "linkOff";
  },
});

/** Puts the email on the allowed list while the link is live; false when it isn't. */
export const admitToAsk = internalMutation({
  args: { token: v.string(), email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { token, email }) => {
    if (!(await linkWithToken(ctx, token))) return false;
    await admitEmail(ctx, namedEmail(email));
    return true;
  },
});
