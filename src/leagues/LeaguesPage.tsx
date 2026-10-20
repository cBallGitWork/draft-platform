import { Link } from "@tanstack/react-router";
import type { LeagueSummary } from "../../convex/myLeagues";
import { invitesPath } from "../joining/paths";
import { invitesTitle } from "../joining/words";
import { NEW_LEAGUE_PATH, NEW_LEAGUE_TITLE } from "./paths";
import { adminWords, roleWords, unsentLink, unsentLinkWords } from "./words";

const cellClasses = "px-2 text-left align-top";

/** "Your leagues" (spec/12): each league the person has a part in, or, for the admin, every
 *  league; with none, a page saying so (spec/02). The admin is offered "Create a league", as only
 *  the admin creates leagues in the beta. Switching between leagues is #76. */
export function LeaguesPage({ email, isAdmin, leagues }: { email: string; isAdmin: boolean; leagues: readonly LeagueSummary[] }) {
  return (
    <section aria-labelledby="page-title" className="max-w-3xl bg-panel">
      <h1 id="page-title" className="bg-plate px-4 py-1 text-title font-bold shadow-bevel-plate">
        Your leagues
      </h1>
      <div className="flex flex-col gap-2 px-3 py-2">
        {leagues.length === 0 ? (
          <>
            <p>You're signed in as {email}, and you're not in a league yet.</p>
            {!isAdmin && <p className="text-muted">When a commissioner invites you to one, it will be here.</p>}
          </>
        ) : (
          <LeagueTable leagues={leagues} isAdmin={isAdmin} />
        )}
        {isAdmin && (
          <Link to={NEW_LEAGUE_PATH} className="action self-start">
            {NEW_LEAGUE_TITLE}
          </Link>
        )}
      </div>
    </section>
  );
}

/** Whether the person runs the league: its commissioner, its co-commissioner, or the admin. */
const runs = (league: LeagueSummary, isAdmin: boolean) => isAdmin || league.roles.some((role) => role !== "manager");

function LeagueTable({ leagues, isAdmin }: { leagues: readonly LeagueSummary[]; isAdmin: boolean }) {
  return (
    <table className="w-full border-collapse">
      <thead className="bg-head text-ground">
        <tr>
          <th scope="col" className={cellClasses}>League</th>
          <th scope="col" className={cellClasses}>You</th>
          <th scope="col" className={cellClasses}>Your team</th>
          <th scope="col" className={`${cellClasses} text-right`}>Teams</th>
        </tr>
      </thead>
      {leagues.map((league) => (
        <tbody key={league.leagueId} className="border-t border-panel-rule">
          <tr>
            <th scope="row" className={`${cellClasses} font-semibold`}>
              <span className="block text-lead">{league.name}</span>
              <span className="block font-normal text-muted wrap-anywhere">Commissioner: {league.commissionerEmail}</span>
              {runs(league, isAdmin) && (
                <Link to={invitesPath(league.leagueId)} className="flex min-h-tap items-center font-normal">
                  {invitesTitle}
                </Link>
              )}
            </th>
            <td className={cellClasses}>{league.roles.map((role) => roleWords[role]).join(", ") || adminWords}</td>
            <td className={cellClasses}>{league.teamName ?? <span className="text-muted">None</span>}</td>
            <td className={`${cellClasses} text-right whitespace-nowrap`}>
              <span className="text-figure">{league.teams}</span> of <span className="text-figure">{league.maxTeams}</span>
            </td>
          </tr>
          {league.unsentCommissionerLink && (
            <tr>
              <td colSpan={4} className="alert-strip">
                {unsentLink(league.unsentCommissionerLink.email, unsentLinkWords[league.unsentCommissionerLink.reply])}
              </td>
            </tr>
          )}
        </tbody>
      ))}
    </table>
  );
}
