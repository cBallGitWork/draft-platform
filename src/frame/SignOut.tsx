import type { AuthActions } from "../signIn/seam";
import { signOutWords } from "./words";

/** The top bar's Sign out (spec/02). Signing out never rejects (signIn/seam.ts), and the signed-out
 *  session then sends the visitor to the sign-in page. */
export function SignOut({ onSignOut }: { onSignOut: AuthActions["signOut"] }) {
  return (
    <button type="button" onClick={() => void onSignOut()} className="secondary-action">
      {signOutWords}
    </button>
  );
}
