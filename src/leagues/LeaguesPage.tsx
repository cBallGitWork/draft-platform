import { Link } from "@tanstack/react-router";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { ADMIN_PATH } from "../admin/paths";
import { ADMIN_TITLE } from "../admin/words";
import { PageSection } from "../frame/Panel";
import { gameweeksPath } from "../gameweeks/paths";
import { GAMEWEEKS_TITLE } from "../gameweeks/words";
import { invitesPath } from "../joining/paths";
import { INVITES_TITLE } from "../joining/words";
import { settingsPath } from "../leagueSettings/paths";
import { SETTINGS_TITLE } from "../leagueSettings/words";
import { scoringPath } from "../scoring/paths";
import { SCORING_TITLE } from "../scoring/words";
import { squadsPath } from "../squads/paths";
import { SQUADS_TITLE } from "../squads/words";
import { LeagueDeletionRow, type DeletionActions } from "./LeagueDeletion";
import { leagueColumnCount } from "./LeagueLinks";
import { NEW_LEAGUE_PATH } from "./paths";
import { deletes, runs } from "./roles";
import {
  adminWords,
  commissionerLine,
  invitedHereWords,
  leagueColumns,
  LEAGUES_TITLE,
  NEW_LEAGUE_TITLE,
  noTeamCellWords,
  notInALeagueWords,
  rolesWords,
  teamsOfMostWords,
  unsentLink,
  unsentLinkWords,
} from "./words";

const cellClasses = "px-2 text-left align-top";

/** A way into one of a league's pages from its row: a full tap on a phone, a plain line on a
 *  desktop. */
const leagueRowLinkClasses = "flex min-h-tap items-center font-normal lg:min-h-0";

/** The ways into a league from its row, for someone who runs it. */
const runnerLinks = (leagueId: string) => [
  { to: gameweeksPath(leagueId), title: GAMEWEEKS_TITLE },
  { to: invitesPath(leagueId), title: INVITES_TITLE },
  { to: squadsPath(leagueId), title: SQUADS_TITLE },
  { to: scoringPath(leagueId), title: SCORING_TITLE },
  { to: settingsPath(leagueId), title: SETTINGS_TITLE },
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
    <PageSection title={LEAGUES_TITLE} className="max-w-3xl bg-panel">
      <div className="flex flex-col gap-2 px-3 py-2">
        {leagues.length === 0 ? (
          <>
            <p>{notInALeagueWords(email)}</p>
            {!isAdmin && <p className="text-muted">{invitedHereWords}</p>}
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
    </PageSection>
  );
}

function LeagueTable({ leagues, isAdmin, actions }: { leagues: readonly LeagueSummary[]; isAdmin: boolean; actions: DeletionActions }) {
  return (
    <table className="w-full border-collapse">
      <thead className="bg-head text-ground">
        <tr>
          <th scope="col" className={cellClasses}>{leagueColumns.league}</th>
          <th scope="col" className={cellClasses}>{leagueColumns.you}</th>
          <th scope="col" className={cellClasses}>{leagueColumns.team}</th>
          <th scope="col" className={`${cellClasses} text-right`}>{leagueColumns.teams}</th>
        </tr>
      </thead>
      {leagues.map((league) => (
        <tbody key={league.leagueId} className="border-t border-panel-rule">
          <tr>
            <th scope="row" className={`${cellClasses} font-semibold`}>
              <span className="block text-lead">{league.name}</span>
              <span className="block font-normal text-muted wrap-anywhere">{commissionerLine(league.commissionerEmail)}</span>
              {!league.deletion &&
                runs(league, isAdmin) &&
                runnerLinks(league.leagueId).map(({ to, title }) => (
                  <Link key={to} to={to} className={leagueRowLinkClasses}>
                    {title}
                  </Link>
                ))}
            </th>
            <td className={cellClasses}>{rolesWords(league.roles) || adminWords}</td>
            <td className={cellClasses}>{league.teamName ?? <span className="text-muted">{noTeamCellWords}</span>}</td>
            <td className={`${cellClasses} text-right whitespace-nowrap`}>
              <span className="text-figure">{league.teams}</span>
              {teamsOfMostWords}
              <span className="text-figure">{league.maxTeams}</span>
            </td>
          </tr>
          {league.unsentCommissionerLink && (
            <tr>
              <td colSpan={leagueColumnCount} className="alert-strip">
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
