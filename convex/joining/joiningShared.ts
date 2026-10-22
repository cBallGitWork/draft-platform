// What joining's server code and screens both read (#73), importing only time.ts's units so the
// screens can: how long an invite lasts, where joining's sign-in links lead, and what a dead
// invite link says.

import { DAY_MS } from "../shared/time";

/** spec/13: an invite's lifetime, in days. */
export const INVITE_DAYS = 7;
export const INVITE_LIFETIME_MS = INVITE_DAYS * DAY_MS;

/** A league's invite link is `/join/<token>`; its sign-in link comes back to it (spec/02). */
export const JOIN_PATH = "/join";
export const joinPath = (token: string) => `${JOIN_PATH}/${token}`;

/** An invite's sign-in link is `/invited/<inviteId>`, which names the invite for its email's
 *  wording; the app has no page there and opens where `/` does, on My team once they've joined. */
export const INVITED_PATH = "/invited";
export const invitedPath = (inviteId: string) => `${INVITED_PATH}/${inviteId}`;

/** The team an invite is for, when it isn't a vacated one. */
export const aNewTeamWords = "a new team";

/** A replaced or switched-off invite link, as the person who opens it is told. */
export const linkOffWords = "That invite link no longer works. Ask the league's commissioner for a new one.";
/** A league with no invite link, as its commissioner is told. */
export const noLinkWords = "The league has no invite link.";

/** The invite an invite's sign-in link names, or null for any other link. */
export function inviteIdIn(url: string): string | null {
  const [, first, inviteId, ...rest] = new URL(url).pathname.split("/");
  return `/${first}` === INVITED_PATH && inviteId && rest.length === 0 ? inviteId : null;
}
