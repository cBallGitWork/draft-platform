import { useState, type FormEvent } from "react";
import { PanelTitle } from "../frame/Panel";
import { PRODUCT_NAME } from "../product";
import { linkProblemWords, type LinkProblem } from "./words";

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
        <p className="flex items-center border-l border-plate-rule px-4 text-lead font-semibold">Invite only</p>
      </header>
      <main className="p-2">
        <section aria-labelledby="sign-in-title" className="max-w-md bg-panel">
          <PanelTitle id="sign-in-title">Sign in</PanelTitle>
          {linkProblem && !outcome && (
            <p role="alert" className="alert-strip">
              {linkProblemWords[linkProblem]}
            </p>
          )}
          {intro && <p className="px-3 pt-2">{intro}</p>}
          <form onSubmit={sendLink} className="flex flex-col gap-2 p-3">
            <label htmlFor="sign-in-email" className="font-semibold">
              Email
            </label>
            <input
              id="sign-in-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="text-box"
            />
            <p className="text-muted">We'll email you a link that signs you in. No password.</p>
            <button type="submit" disabled={sending} className="action self-start">
              Send the link
            </button>
          </form>
          <p role="status" className={outcome ? "alert-strip" : undefined}>
            {outcome}
          </p>
        </section>
      </main>
    </>
  );
}
