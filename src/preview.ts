// The screens without signing in, for screenshots: `/?preview=manager` (in a league), `newcomer`
// (in none), `admin` (in none, so offered "Create a league") or `visitor` (signed out), on the dev
// server only (the ui-verifier agent's way in). `import.meta.env.DEV` is false in `vite build`, so
// the production bundle drops this and a logged-out visitor can never reach the frame through it.

import type { AuthActions, Session } from "./auth";
import type { TopBarState } from "./frame/topBarState";
import { MAIL_PATH } from "./frame/menu";
import { replyWords } from "./sign-in/words";

const signedIn = { signedIn: true, email: "manager@example.com", isAdmin: false, inLeague: true } as const;

const previewSessions: Record<string, Session> = {
  manager: signedIn,
  newcomer: { ...signedIn, inLeague: false },
  admin: { ...signedIn, email: "admin@example.com", isAdmin: true, inLeague: false },
  visitor: { signedIn: false },
};

/** The session `?preview=` names, on the dev server; otherwise null, and the app signs in for real. */
export function previewSession(): Session | null {
  if (!import.meta.env.DEV) return null;
  const name = new URLSearchParams(window.location.search).get("preview");
  return name !== null && Object.hasOwn(previewSessions, name) ? previewSessions[name] : null;
}

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
