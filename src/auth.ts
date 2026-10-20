// The seam for sign-in (#20): what the screens know of it. Convex Auth's emailed links fill it in
// live (liveApp.tsx); the preview (preview.ts) and the tests hand the screens their own.

/** Who is at the screen. No league exists until #24, so a real session is in none. */
export type Session =
  | { signedIn: false }
  | { signedIn: true; email: string; isAdmin: boolean; inLeague: boolean };

export type AuthActions = {
  /** Asks for a sign-in link for this email, and resolves with what to tell the visitor. It never
   * rejects: a failure resolves too, as the words that say what went wrong. */
  requestSignInLink(email: string): Promise<string>;
  /** Ends this device's session. It never rejects. */
  signOut(): Promise<void>;
};
