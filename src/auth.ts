// The seam for sign-in (#20): what the screens know of it. Convex Auth's emailed links fill it in
// live (liveApp.tsx); the preview (preview.ts) and the tests hand the screens their own.

import type { LeagueSummary } from "../convex/myLeagues";

/** Who is at the screen, and their leagues (convex/account.ts): in a league is having a part in
 *  one, as a commissioner, co-commissioner or manager. */
export type Session =
  | { signedIn: false }
  | { signedIn: true; email: string; isAdmin: boolean; inLeague: boolean; leagues: readonly LeagueSummary[] };

export type AuthActions = {
  /** Asks for a sign-in link for this email, and resolves with what to tell the visitor. It never
   * rejects: a failure resolves too, as the words that say what went wrong. */
  requestSignInLink(email: string): Promise<string>;
  /** Ends this device's session. It never rejects. */
  signOut(): Promise<void>;
};
