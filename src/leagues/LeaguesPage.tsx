import { Link } from "@tanstack/react-router";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { ADMIN_PATH } from "../admin/paths";
import { ADMIN_TITLE } from "../admin/words";
import { PageTitle } from "../frame/Panel";
import { gameweeksPath } from "../gameweeks/paths";
import { GAMEWEEKS_TITLE } from "../gameweeks/words";
import { invitesPath } from "../joining/paths";
import { invitesTitle } from "../joining/words";
import { squadsPath } from "../squads/paths";
import { SQUADS_TITLE } from "../squads/words";
import { LeagueDeletionRow, type DeletionActions } from "./LeagueDeletion";
import { leagueRowLinkClasses } from "./LeagueLinks";
import { LEAGUES_TITLE, NEW_LEAGUE_PATH, NEW_LEAGUE_TITLE } from "./paths";
import { deletes, runs } from "./roles";
import { adminWords, roleWords, unsentLink, unsentLinkWords } from "./words";

const cellClasses = "px-2 text-left align-top";

/** The ways into a league from its row, for someone who runs it. */
const runnerLinks = (leagueId: string) => [
  { to: gameweeksPath(leagueId), title: GAMEWEEKS_TITLE },
  { to: invitesPath(leagueId), title: invitesTitle },
  { to: squadsPath(leagueId), title: SQUADS_TITLE },
];

/** "Your leagues" (spec/12): each league the person has a part in, or, for the admin, every
 *  league; with none, a page saying so (spec/02). The admin is offered "Create a league", as only
 *  the admin creates leagues in the beta. Switching between leagues is the top bar's
 *  (frame/LeagueSwitcher.tsx). */
export function LeaguesPage({
  email,
  isAdmin,
  leagues,
  actions,
}: {
  email: string;
  isAdmin: boolean;
  leagues: readonly LeagueSummary[];
  actions: DeletionActions;
}) {
  return (
    <section aria-labelledby="page-title" className="max-w-3xl bg-panel">
      <PageTitle>{LEAGUES_TITLE}</PageTitle>
      <div className="flex flex-col gap-2 px-3 py-2">
        {leagues.length === 0 ? (
          <>
            <p>You're signed in as {email}, and you're not in a league yet.</p>
            {!isAdmin && <p className="text-muted">When a commissioner invites you to one, it will be here.</p>}
          </>
        ) : (
          <LeagueTable leagues={leagues} isAdmin={isAdmin} actions={actions} />
        )}
        {isAdmin && (
          <span className="flex flex-wrap gap-2">
            <Link to={NEW_LEAGUE_PATH} className="action">
              {NEW_LEAGUE_TITLE}
            </Link>
            <Link to={ADMIN_PATH} className="secondary-action">
              {ADMIN_TITLE}
            </Link>
          </span>
        )}
      </div>
    </section>
  );
}

function LeagueTable({ leagues, isAdmin, actions }: { leagues: readonly LeagueSummary[]; isAdmin: boolean; actions: DeletionActions }) {
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
              {!league.deletion &&
                runs(league, isAdmin) &&
                runnerLinks(league.leagueId).map(({ to, title }) => (
                  <Link key={to} to={to} className={leagueRowLinkClasses}>
                    {title}
                  </Link>
                ))}
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
          <LeagueDeletionRow league={league} canDelete={deletes(league, isAdmin)} actions={actions} />
        </tbody>
      ))}
    </table>
  );
}
