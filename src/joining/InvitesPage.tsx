import { Link } from "@tanstack/react-router";
import { LEAGUES_PATH } from "../leagues/paths";
import { EmailInvites } from "./EmailInvites";
import { InviteLinkPanel } from "./InviteLinkPanel";
import { RequestsPanel } from "./RequestsPanel";
import type { InvitesPageData, JoiningSeam } from "./seam";
import { invitesTitle, notYoursWords, loadingWords, waitingStrip } from "./words";

/** An invite past the day's emails, not yet taken up. */
const waitsForTomorrow = (invite: InvitesPageData["invites"][number]) =>
  invite.delivery === "waiting" && invite.joinedTeamName === null && invite.couldNotJoin === null;

/** A league's invites and join requests (spec/13 Joining, spec/15 Joining a league), for its
 *  runners: invite by email, the invite link, and the requests it made. */
export function InvitesPage({ leagueId, joining }: { leagueId: string; joining: JoiningSeam }) {
  const page = joining.useInvitesPage(leagueId);
  const waiting = page?.invites.filter(waitsForTomorrow).length ?? 0;

  return (
    <div className="flex max-w-5xl flex-col gap-2">
      <section aria-labelledby="page-title" className="bg-panel">
        <h1 id="page-title" className="bg-plate px-4 py-1 text-title font-bold shadow-bevel-plate">
          {invitesTitle}
        </h1>
        {page ? (
          <p className="px-3 py-2 text-lead font-semibold">{page.leagueName}</p>
        ) : (
          <p className="flex flex-wrap items-center gap-4 px-3 py-2 text-muted">
            {page === undefined ? loadingWords : notYoursWords}
            {page === null && (
              <Link to={LEAGUES_PATH} className="flex min-h-tap items-center">
                Back to your leagues
              </Link>
            )}
          </p>
        )}
        {waiting > 0 && (
          <p role="status" className="alert-strip">
            {waitingStrip(waiting)}
          </p>
        )}
      </section>
      {page && (
        <div className="grid items-start gap-2 lg:grid-cols-2">
          <EmailInvites page={page} joining={joining} />
          <div className="flex flex-col gap-2">
            <InviteLinkPanel page={page} joining={joining} />
            <RequestsPanel page={page} joining={joining} />
          </div>
        </div>
      )}
    </div>
  );
}
