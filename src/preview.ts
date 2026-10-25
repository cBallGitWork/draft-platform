// The screens without signing in, for screenshots: `/?preview=manager` (in two leagues),
// `commissioner` (running the same two, so Mail offers a letter to either, and deleting a third),
// `newcomer` (in none), `admin` (in none, seeing every league and offered "Create a league") or
// `visitor` (signed out), on the dev server only (the ui-verifier agent's way in).
// The production bundle leaves this file out (main.tsx), and previewSession's own
// `import.meta.env.DEV` guard holds if something imports it anyway, so a logged-out visitor can
// never reach the frame through it.

import type { Id } from "../convex/_generated/dataModel";
import type { LeagueSummary } from "../convex/leagues/myLeagues";
import { HOUR_MS } from "../convex/shared/time";
import type { AuthActions, Session } from "./auth";
import type { LeaguesSeam } from "./leagues/seam";
import { replyWords } from "./sign-in/words";

/** Made-up leagues, in the shape signIn/account:signedInAs sends. */
const unreachedCommissioner = "first.commissioner@example.com";
export const proLeague: LeagueSummary = {
  leagueId: "preview-pro-league" as Id<"leagues">,
  name: "Tim Hortons Pro League",
  commissionerEmail: "commish@example.com",
  roles: ["manager"],
  teamName: "Saka Potatoes",
  teams: 9,
  maxTeams: 12,
  unsentCommissionerLink: null,
};
export const miniBeta: LeagueSummary = {
  leagueId: "preview-mini-beta" as Id<"leagues">,
  name: "Mini beta",
  commissionerEmail: unreachedCommissioner,
  roles: [],
  teamName: null,
  teams: 0,
  maxTeams: 4,
  unsentCommissionerLink: { email: unreachedCommissioner, reply: "paused" },
};

/** A league the preview's commissioner deleted an hour ago, whose last two
 *  managers weren't told: the day's emails had gone. */
const sundayLeague: LeagueSummary = {
  ...miniBeta,
  leagueId: "preview-sunday-league" as Id<"leagues">,
  name: "Sunday League",
  commissionerEmail: "manager@example.com",
  roles: ["commissioner"],
  teams: 6,
  maxTeams: 8,
  unsentCommissionerLink: null,
  deletion: { deletesAt: Date.now() + 23 * HOUR_MS },
};

export const manager = {
  signedIn: true,
  email: "manager@example.com",
  isAdmin: false,
  inLeague: true,
  leagues: [
    proLeague,
    { ...miniBeta, roles: ["manager"], teamName: "Team 1", teams: 1, unsentCommissionerLink: null },
  ],
  currentLeagueId: proLeague.leagueId,
} as const satisfies Session;

/** The manager, as co-commissioner of the Pro League and commissioner of Mini beta, deleting Sunday League. */
const commissioner: Session = {
  ...manager,
  leagues: [
    { ...proLeague, roles: ["co-commissioner", "manager"] },
    { ...manager.leagues[1], commissionerEmail: manager.email, roles: ["commissioner", "manager"] },
    sundayLeague,
  ],
};

const previewSessions: Record<string, Session> = {
  manager,
  commissioner,
  newcomer: { ...manager, inLeague: false, leagues: [], currentLeagueId: null },
  admin: {
    ...manager,
    email: "admin@example.com",
    isAdmin: true,
    inLeague: false,
    leagues: [miniBeta, { ...proLeague, roles: [], teamName: null }],
    currentLeagueId: null,
  },
  visitor: { signedIn: false },
};

/** The gameweeks the preview's league leaves unticked: a Christmas break. */
export const previewChristmasBreak: readonly number[] = [17, 18, 19];

/** A change the preview doesn't make, saying what that left. */
export const previewSays = (outcome: string) => async () => `This is a preview: ${outcome}.`;

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
