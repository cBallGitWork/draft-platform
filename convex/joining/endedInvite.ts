import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { leagueOpens } from "../leagues/leagueOpens";
import { signedInEmail } from "../shared/leagueAccess";
import { INVITES_TO_ONE_EMAIL_READ, warnIfFull } from "./liveInvites";

// What became of an invite that let someone sign in but not join (spec/13, Joining): their leagues
// page says it expired, was cancelled, or couldn't be used and why, instead of only that they're in
// no league (Craig, 22 Oct 2026).

export const endedInvite = v.union(
  v.null(),
  v.object({
    leagueName: v.string(),
    ended: v.union(v.literal("expired"), v.literal("cancelled"), v.literal("couldNotJoin")),
    /** Why it couldn't be used, in the refusal's own words; null otherwise. */
    reason: v.union(v.string(), v.null()),
  }),
);
export type EndedInvite = NonNullable<Infer<typeof endedInvite>>;

/** How it ended, or null while it can still be taken up or once it was. */
function howEnded(invite: Doc<"invites">, now: number): EndedInvite["ended"] | null {
  if (invite.joined !== undefined) return null;
  if (invite.cancelledAt !== undefined) return "cancelled";
  if (invite.couldNotJoin !== undefined) return "couldNotJoin";
  return now >= invite.expiresAt ? "expired" : null;
}

/** The signed-in person's newest invite, if it ended without them joining; otherwise null. `now`
 *  is the screen's minute, as a query may not read the clock. A league being deleted is hidden
 *  from them, so its invite isn't told of. */
export const mine = query({
  args: { now: v.number() },
  returns: endedInvite,
  handler: async (ctx, { now }) => {
    const email = await signedInEmail(ctx);
    if (email === null) return null;
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_email_and_expiresAt", (q) => q.eq("email", email))
      .order("desc")
      .take(INVITES_TO_ONE_EMAIL_READ);
    warnIfFull(invites, email);
    const newest = invites.reduce<Doc<"invites"> | null>((found, invite) => (found && found._creationTime > invite._creationTime ? found : invite), null);
    const ended = newest && howEnded(newest, now);
    if (!newest || !ended) return null;
    // deleteForGood (leagueDeletion.ts) removes a league's invites before the league itself, so an
    // invite whose league is gone is a broken database, not a league deleted a moment ago.
    const league = await ctx.db.get("leagues", newest.leagueId);
    if (!league) throw new Error(`Invite ${newest._id} is to league ${newest.leagueId}, which doesn't exist`);
    if (!leagueOpens(league)) return null;
    return { leagueName: league.name, ended, reason: newest.couldNotJoin ?? null };
  },
});
