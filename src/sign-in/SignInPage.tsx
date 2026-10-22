import { useState, type FormEvent } from "react";
import { PANEL_BODY, PanelTitle, Problem } from "../frame/Panel";
import { PRODUCT_NAME } from "../../convex/shared/product";
import { linkProblemWords, signInWords, type LinkProblem } from "./words";

const TITLE_ID = "sign-in-title";
const EMAIL_ID = "sign-in-email";

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
      <header className="flex flex-wrap items-stretch bg-plate shadow-bevel-plate">
        <h1 className="px-4 py-1 text-title font-bold">{PRODUCT_NAME}</h1>
        <p className="flex items-center border-l border-plate-rule px-4 text-lead font-semibold">{signInWords.inviteOnly}</p>
      </header>
      <main className="p-2">
        <section aria-labelledby={TITLE_ID} className="max-w-md bg-panel">
          <PanelTitle id={TITLE_ID}>{signInWords.title}</PanelTitle>
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
              className="text-box"
            />
            <p className="text-muted">{signInWords.hint}</p>
            <button type="submit" disabled={sending} className="action self-start">
              {signInWords.send}
            </button>
          </form>
          {/* Not a Notice: it stays in the page while empty, so the live region announces the outcome. */}
          <p role="status" className={outcome ? "alert-strip" : undefined}>
            {outcome}
          </p>
        </section>
      </main>
    </>
  );
}
