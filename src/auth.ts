// The seam for sign-in (#20). Convex Auth's emailed links (spec/02) replace both of these; until
// then nobody is signed in, and asking for a link says so rather than failing quietly.

import { previewing } from "./preview";

export function isSignedIn(): boolean {
  return previewing;
}

/** Asks for a sign-in link for this email, and resolves with what to tell the visitor. It never
 * rejects: a failure resolves too, as the words that say what went wrong. */
export async function requestSignInLink(_email: string): Promise<string> {
  return "Sign-in isn't switched on yet, so no link was sent.";
}
