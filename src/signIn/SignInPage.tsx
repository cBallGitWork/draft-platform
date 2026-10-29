import { useState, type FormEvent } from "react";
import { PANEL_BODY, Panel, Problem, Status, TOP_BAR, TOP_BAR_ROW } from "../ui/Panel";
import { PRODUCT_NAME } from "../../convex/shared/product";
import { linkProblemWords, signInWords, type LinkProblem } from "./words";

const EMAIL_ID = "sign-in-email";
const EMAIL_HINT_ID = "sign-in-email-hint";

/** All a logged-out visitor sees (spec/12): the name, "Invite only", and an email box for the link.
 *  Opened from a link that didn't sign them in, it says so first (spec/02); `intro` says why
 *  they're here, as from a league's invite link (#73). */
export function SignInPage({
  requestSignInLink,
  linkProblem,
  intro,
}: {
  requestSignInLink: (email: string) => Promise<string>;
  linkProblem?: LinkProblem;
  intro?: string;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setOutcome(await requestSignInLink(email));
    setSending(false);
  }

  return (
    <>
      <header className={`${TOP_BAR_ROW} ${TOP_BAR}`}>
        <h1 className="px-4 py-1 text-title font-bold">{PRODUCT_NAME}</h1>
        <p className="flex items-center border-l border-plate-rule px-4 text-lead font-semibold">{signInWords.inviteOnly}</p>
      </header>
      <main className="p-2">
        <Panel title={signInWords.title} className="max-w-md">
          <Problem problem={linkProblem && !outcome ? linkProblemWords[linkProblem] : null} />
          {intro && <p className="px-3 pt-2">{intro}</p>}
          <form onSubmit={sendLink} className={PANEL_BODY}>
            <label htmlFor={EMAIL_ID} className="font-semibold">
              {signInWords.emailLabel}
            </label>
            <input
              id={EMAIL_ID}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={EMAIL_HINT_ID}
              className="text-box"
            />
            <p id={EMAIL_HINT_ID} className="text-muted">
              {signInWords.hint}
            </p>
            <button type="submit" disabled={sending} className="action self-start">
              {signInWords.send}
            </button>
          </form>
          <Status words={outcome} className="alert-strip" />
        </Panel>
      </main>
    </>
  );
}
