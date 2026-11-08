// The screens without signing in, for screenshots: `/?preview=manager` (in two leagues),
// `commissioner` (running the same two, so Mail offers a letter to either, and deleting a third),
// `newcomer` (in none), `admin` (in none, seeing every league and offered "Create a league") or
// `visitor` (signed out), on the dev server only (the ui-verifier agent's way in). The made-up
// leagues every feature's preview shares are src/shared/preview.ts's.
// The production bundle leaves this file out (main.tsx), and previewSession's own
// `import.meta.env.DEV` guard holds if something imports it anyway, so a logged-out visitor can
// never reach the frame through it.

import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { HOUR_MS } from "../../convex/shared/time";
import type { AuthActions, Session } from "../signIn/seam";
import type { LeaguesSeam } from "../leagues/seam";
import { replyWords } from "../signIn/words";
import { adminPowers, coCommissionerPowers, commissionerPowers, manager, miniBeta, previewSays, proLeague } from "../shared/preview";

/** A league the preview's commissioner deleted an hour ago, whose last two
 *  managers weren't told: the day's emails had gone. */
const sundayLeague: LeagueSummary = {
  ...miniBeta,
  leagueId: "preview-sunday-league" as Id<"leagues">,
  name: "Sunday League",
  commissionerEmail: "manager@example.com",
  roles: ["commissioner"],
  powers: commissionerPowers,
  teams: 6,
  maxTeams: 8,
  unsentCommissionerLink: null,
  deletion: { deletesAt: Date.now() + 23 * HOUR_MS },
};

/** The manager, as co-commissioner of the Pro League and commissioner of Mini beta, deleting Sunday
 *  League, which, being deleted, isn't one to switch to. */
const commissioner: Session = {
  ...manager,
  leagues: [
    { ...proLeague, roles: ["co-commissioner", "manager"], powers: coCommissionerPowers },
    { ...manager.leagues[1], commissionerEmail: manager.email, roles: ["commissioner", "manager"], powers: commissionerPowers },
    sundayLeague,
  ],
};

const previewSessions: Record<string, Session> = {
  manager,
  commissioner,
  newcomer: { ...manager, inLeague: false, leagues: [], switchableLeagueIds: [], currentLeagueId: null },
  admin: {
    ...manager,
    email: "admin@example.com",
    isAdmin: true,
    inLeague: false,
    leagues: [miniBeta, { ...proLeague, roles: [], powers: adminPowers, teamName: null }],
    switchableLeagueIds: [],
    currentLeagueId: null,
  },
  visitor: { signedIn: false },
};

/** Each name `?preview=` takes, so a test can check every preview person's leagues against the
 *  server's rule, which this file can't import (#488). */
export const previewNames = Object.keys(previewSessions);

/** The session `?preview=` names, on the dev server; otherwise null, and the app signs in for real. */
export function previewSession(): Session | null {
  if (!import.meta.env.DEV) return null;
  const name = new URLSearchParams(window.location.search).get("preview");
  return name !== null && Object.hasOwn(previewSessions, name) ? previewSessions[name] : null;
}

/** Creating or deleting a league, or undoing that, does nothing, and switching or leaving a league
 *  stays put, each saying so. */
export const previewLeagues: LeaguesSeam = {
  createLeague: previewSays("no league was made"),
  deleteLeague: previewSays("no league was deleted"),
  undoDeletion: previewSays("nothing was undone"),
  switchLeague: previewSays("you're still in this league"),
  leaveLeague: previewSays("you didn't leave"),
};

/** Asking for a link gets the reply everyone gets; nothing is sent, and signing out does nothing. */
export const previewAuth: AuthActions = {
  requestSignInLink: async () => replyWords.checkYourEmail,
  signOut: async () => {},
};
