import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// Which invites can still be taken up (spec/13, Joining). Its own module so teams.ts can end a
// removed manager's invites (#133) without importing invites.ts, which imports teams.ts.

/** The most invites to one email read at once: far more than anyone is sent in the closed beta.
 *  Past it, the first this many in the index's order are kept and the rest ignored, and a read
 *  that fills it is logged (`warnIfFull`). */
export const INVITES_TO_ONE_EMAIL_READ = 100;

/** Says so when a read of one email's invites filled INVITES_TO_ONE_EMAIL_READ, so those past it
 *  aren't ignored silently. */
export function warnIfFull(invites: readonly Doc<"invites">[], email: string): void {
  if (invites.length >= INVITES_TO_ONE_EMAIL_READ) {
    console.warn(`${email} has ${INVITES_TO_ONE_EMAIL_READ} or more invites: only ${INVITES_TO_ONE_EMAIL_READ} were read`);
  }
}

/** Whether the invite was cancelled, or the person signed in and it was taken up or couldn't be. */
export const hasEnded = (invite: Doc<"invites">) =>
  invite.cancelledAt !== undefined || invite.joined !== undefined || invite.couldNotJoin !== undefined;

/** The invites to this email that can still be taken up at `now`. */
export async function liveInvitesTo(ctx: QueryCtx, email: string, now: number) {
  const unexpired = await ctx.db
    .query("invites")
    .withIndex("by_email_and_expiresAt", (q) => q.eq("email", email).gt("expiresAt", now))
    .take(INVITES_TO_ONE_EMAIL_READ);
  warnIfFull(unexpired, email);
  return unexpired.filter((invite) => !hasEnded(invite));
}

/** Cancels every live invite to this email for this league: a manager who is removed or leaves
 *  loses the league at once (spec/13, Leaving), so an older invite mustn't bring them back at
 *  their next sign-in (#133). A new invite still can. */
export async function cancelLiveInvites(ctx: MutationCtx, leagueId: Id<"leagues">, email: string): Promise<void> {
  const now = Date.now();
  for (const invite of await liveInvitesTo(ctx, email, now)) {
    if (invite.leagueId === leagueId) await ctx.db.patch("invites", invite._id, { cancelledAt: now });
  }
}
