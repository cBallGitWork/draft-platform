// What joining's server code and screens both read (#73), with no imports so the screens can:
// how long an invite lasts, where joining's sign-in links lead, and what a dead invite link says.

export const DAY_MS = 24 * 60 * 60 * 1000;
/** spec/13: an invite lasts 7 days. */
export const INVITE_DAYS = 7;
export const INVITE_LIFETIME_MS = INVITE_DAYS * DAY_MS;

/** A league's invite link is `/join/<token>`; its sign-in link comes back to it (spec/02). */
export const JOIN_PATH = "/join";
export const joinPath = (token: string) => `${JOIN_PATH}/${token}`;

/** An invite's sign-in link is `/invited/<inviteId>`, which names the invite for its email's
 *  wording; the app has no page there and opens on the person's leagues. */
export const INVITED_PATH = "/invited";
export const invitedPath = (inviteId: string) => `${INVITED_PATH}/${inviteId}`;

/** A replaced or switched-off invite link, as the person who opens it is told. */
export const linkOffWords = "That invite link no longer works. Ask the league's commissioner for a new one.";

/** The invite an invite's sign-in link names, or null for any other link. */
export function inviteIdIn(url: string): string | null {
  const [, first, inviteId, ...rest] = new URL(url).pathname.split("/");
  return `/${first}` === INVITED_PATH && inviteId && rest.length === 0 ? inviteId : null;
}
