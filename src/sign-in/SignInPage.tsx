import { useState, type FormEvent } from "react";
import { requestSignInLink } from "../auth";
import { PRODUCT_NAME } from "../product";

/** All a logged-out visitor sees (spec/12): the name, "Invite only", and an email box for the link. */
export function SignInPage() {
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
          <h2 id="sign-in-title" className="bg-plate px-3 py-1 font-bold shadow-bevel-plate">
            Sign in
          </h2>
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
              className="min-h-tap border border-soft bg-ground px-2 text-lead text-fact"
            />
            <p className="text-muted">We'll email you a link that signs you in. No password.</p>
            <button type="submit" disabled={sending} className="action self-start">
              Send the link
            </button>
          </form>
          <p role="status" className={outcome ? "bg-name-plate px-3 py-2 text-event shadow-event-edge" : undefined}>
            {outcome}
          </p>
        </section>
      </main>
    </>
  );
}
