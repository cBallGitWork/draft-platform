import { Link } from "@tanstack/react-router";
import { NEW_LEAGUE_PATH } from "./paths";

/** Signed in, in no league (spec/02): a page saying so. The admin is offered "Create a league"
 *  instead, as only the admin creates leagues in the beta (its form is #24). */
export function NoLeaguePage({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  return (
    <section aria-labelledby="page-title" className="max-w-xl bg-panel">
      <h1 id="page-title" className="bg-plate px-4 py-1 text-title font-bold shadow-bevel-plate">
        Your leagues
      </h1>
      <div className="flex flex-col gap-2 px-3 py-2">
        <p>You're signed in as {email}, and you're not in a league yet.</p>
        {isAdmin ? (
          <Link to={NEW_LEAGUE_PATH} className="action self-start">
            Create a league
          </Link>
        ) : (
          <p className="text-muted">When a commissioner invites you to one, it will be here.</p>
        )}
      </div>
    </section>
  );
}
