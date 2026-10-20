// The screens without signing in, for screenshots: `/?preview=manager` (in two leagues),
// `newcomer` (in none), `admin` (in none, seeing every league and offered "Create a league") or
// `visitor` (signed out), on the dev server only (the ui-verifier agent's way in).
// `import.meta.env.DEV` is false in `vite build`, so the production bundle drops this and a
// logged-out visitor can never reach the frame through it.

import type { Id } from "../convex/_generated/dataModel";
import type { LeagueSummary } from "../convex/myLeagues";
import type { AuthActions, Session } from "./auth";
import type { TopBarState } from "./frame/topBarState";
import { MAIL_PATH } from "./frame/menu";
import type { LeagueActions } from "./leagues/actions";
import { replyWords } from "./sign-in/words";

/** Made-up leagues, in the shape account:signedInAs sends. */
const proLeague: LeagueSummary = {
  leagueId: "preview-pro-league" as Id<"leagues">,
  name: "Tim Hortons Pro League",
  commissionerEmail: "commish@example.com",
  roles: ["manager"],
  teamName: "Saka Potatoes",
  teams: 9,
  maxTeams: 12,
  unsentCommissionerLink: null,
};
const miniBeta: LeagueSummary = {
  leagueId: "preview-mini-beta" as Id<"leagues">,
  name: "Mini beta",
  commissionerEmail: "first.commissioner@example.com",
  roles: [],
  teamName: null,
  teams: 0,
  maxTeams: 4,
  unsentCommissionerLink: { email: "first.commissioner@example.com", reply: "paused" },
};

const manager = {
  signedIn: true,
  email: "manager@example.com",
  isAdmin: false,
  inLeague: true,
  leagues: [proLeague, { ...miniBeta, roles: ["commissioner", "manager"], teamName: "Team 1", teams: 1, unsentCommissionerLink: null }],
} as const satisfies Session;

const previewSessions: Record<string, Session> = {
  manager,
  newcomer: { ...manager, inLeague: false, leagues: [] },
  admin: { ...manager, email: "admin@example.com", isAdmin: true, inLeague: false, leagues: [miniBeta, { ...proLeague, roles: [], teamName: null }] },
  visitor: { signedIn: false },
};

/** The session `?preview=` names, on the dev server; otherwise null, and the app signs in for real. */
export function previewSession(): Session | null {
  if (!import.meta.env.DEV) return null;
  const name = new URLSearchParams(window.location.search).get("preview");
  return name !== null && Object.hasOwn(previewSessions, name) ? previewSessions[name] : null;
}

/** Creating a league makes nothing, and says so. */
export const previewLeagues: LeagueActions = {
  createLeague: async () => "This is a preview: no league was made.",
};

/** Asking for a link gets the reply everyone gets; nothing is sent, and signing out does nothing. */
export const previewAuth: AuthActions = {
  requestSignInLink: async () => replyWords.checkYourEmail,
  signOut: async () => {},
};

const unreadMail = 3;

/** Made-up figures, so the shot shows Mail's count and Continue in use. */
export const previewTopBar: TopBarState = {
  unreadMail,
  next: { path: MAIL_PATH, reason: `${unreadMail} unread letters` },
};
