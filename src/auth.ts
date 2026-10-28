// The seam for sign-in (#20): what the screens know of it. Convex Auth's emailed links fill it in
// live (liveApp.tsx); the preview (preview.ts) and the tests hand the screens their own.

import type { Id } from "../convex/_generated/dataModel";
import type { LeagueSummary } from "../convex/leagues/myLeagues";

/** Who is at the screen, their leagues, and the one the app is in (convex/signIn/account.ts): in a league
 *  is having a part in one, as a commissioner, co-commissioner or manager. */
export type Session =
  | { signedIn: false }
  | {
      signedIn: true;
      email: string;
      isAdmin: boolean;
      inLeague: boolean;
      leagues: readonly LeagueSummary[];
      /** Only when `leagues` stops short: more exist than it holds. */
      leaguesCut?: true;
      /** Of `leagues`, those the league switcher offers, judged on the server alone (#207). */
      switchableLeagueIds: readonly Id<"leagues">[];
      currentLeagueId: Id<"leagues"> | null;
    };

export type AuthActions = {
  /** Asks for a sign-in link for this email, and resolves with what to tell the visitor. It never
   * rejects: a failure resolves too, as the words that say what went wrong. */
  requestSignInLink(email: string): Promise<string>;
  /** Ends this device's session. It never rejects. */
  signOut(): Promise<void>;
};
