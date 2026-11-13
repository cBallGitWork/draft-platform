import { Link } from "@tanstack/react-router";
import { leagueOpens } from "../../convex/leagues/leagueOpens";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { ADMIN_PATH } from "../admin/paths";
import { ADMIN_TITLE } from "../admin/words";
import { ColumnHeads } from "../ui/ColumnHeads";
import { Notice, Panel, PANEL_BODY } from "../ui/Panel";
import { gameweeksPath } from "../gameweeks/paths";
import { GAMEWEEKS_TITLE } from "../gameweeks/words";
import { invitesPath } from "../joining/paths";
import type { JoiningSeam } from "../joining/seam";
import { endedInviteWords, INVITES_TITLE, joiningALeagueWords, yourJoinRequestWords } from "../joining/words";
import { settingsPath } from "../leagueSettings/paths";
import { SETTINGS_TITLE } from "../leagueSettings/words";
import { scoringPath } from "../scoring/paths";
import { SCORING_TITLE } from "../scoring/words";
import { squadsPath } from "../squads/paths";
import { SQUADS_TITLE } from "../squads/words";
import { DeletedLeagueStrip, DeleteLeagueRow, type DeletionActions } from "./LeagueDeletion";
import { LEAGUE_DESK, LEAGUE_DESK_MAIN, leagueColumnCount, SIDE_PANEL_LINK } from "./LeagueLinks";
import { NEW_LEAGUE_PATH } from "./paths";
import { deletes, runs } from "./access";
import {
  adminWords,
  commissionerLine,
  leagueColumns,
  leaguesCutWords,
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

/** The ways into a league from its row, for someone who runs it. They stay on the rows until Run
 *  the league is grilled (the picture's placeholder, docs/design/approved/leagues). */
const runnerLinks = (leagueId: string) => [
  { to: gameweeksPath(leagueId), title: GAMEWEEKS_TITLE },
  { to: invitesPath(leagueId), title: INVITES_TITLE },
  { to: squadsPath(leagueId), title: SQUADS_TITLE },
  { to: scoringPath(leagueId), title: SCORING_TITLE },
  { to: settingsPath(leagueId), title: SETTINGS_TITLE },
];

/** The ways into a league from its row, for a manager who doesn't run it. */
const managerLinks = (leagueId: string) => [{ to: scoringPath(leagueId), title: SCORING_TITLE }];

/** "Your leagues" (spec/12), built to its approved pictures (docs/design/approved/leagues): each
 *  league the person has a part in, or, for the admin, every league, with each being deleted as a
 *  strip under them; with none, a page saying so (spec/02), and what became of their newest invite
 *  if it ended without them joining (spec/13, Joining). Beside it, their waiting join requests,
 *  how joining goes when they're in none, and the admin's panel offering "Create a league", as only
 *  the admin creates leagues in the beta. Switching between leagues is the top bar's
 *  (frame/topBar/LeagueSwitcher.tsx). */
export function LeaguesPage({
  email,
  isAdmin,
  leagues,
  leaguesCut,
  actions,
  joining,
}: {
  email: string;
  isAdmin: boolean;
  leagues: readonly LeagueSummary[];
  /** More leagues exist than `leagues` holds. */
  leaguesCut: boolean;
  actions: DeletionActions;
  joining: Pick<JoiningSeam, "useEndedInvite" | "useWaitingRequests">;
}) {
  const listed = leagues.filter(leagueOpens);
  return (
    <div className={LEAGUE_DESK}>
      <div className={`flex flex-col gap-2 ${LEAGUE_DESK_MAIN}`}>
        <Panel title={LEAGUES_TITLE} pageTitle>
          {leaguesCut && <Notice>{leaguesCutWords}</Notice>}
          {leagues.length === 0 ? (
            <div className={PANEL_BODY}>
              <p className="text-lead">{notInALeagueWords(email)}</p>
              <EndedInviteLine useEndedInvite={joining.useEndedInvite} />
            </div>
          ) : (
            listed.length > 0 && <LeagueTable leagues={listed} actions={actions} />
          )}
        </Panel>
        {leagues.map(
          (league) => league.deletion && <DeletedLeagueStrip key={league.leagueId} league={league} deletesAt={league.deletion.deletesAt} actions={actions} />,
        )}
      </div>
      <div className="flex flex-col gap-2">
        <WaitingRequests useWaitingRequests={joining.useWaitingRequests} />
        {leagues.length === 0 && !isAdmin && (
          <Panel title={joiningALeagueWords.title}>
            <p className={PANEL_BODY}>{joiningALeagueWords.how}</p>
          </Panel>
        )}
        {isAdmin && (
          <Panel title={adminWords}>
            <div className={PANEL_BODY}>
              <Link to={NEW_LEAGUE_PATH} className={SIDE_PANEL_LINK}>
                {NEW_LEAGUE_TITLE}
              </Link>
              <Link to={ADMIN_PATH} className={SIDE_PANEL_LINK}>
                {ADMIN_TITLE}
              </Link>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

/** Why the person's newest invite didn't make them a manager, if it didn't: nothing until it loads. */
function EndedInviteLine({ useEndedInvite }: { useEndedInvite: JoiningSeam["useEndedInvite"] }) {
  const ended = useEndedInvite();
  return ended ? <p className="alert-strip">{endedInviteWords(ended)}</p> : null;
}

/** The leagues the person asked to join, each waiting on its commissioner (spec/13, Joining):
 *  nothing while it loads or when there are none. */
function WaitingRequests({ useWaitingRequests }: { useWaitingRequests: JoiningSeam["useWaitingRequests"] }) {
  const waiting = useWaitingRequests();
  if (!waiting?.length) return null;
  return (
    <Panel title={yourJoinRequestWords.title}>
      {waiting.map(({ leagueName }) => (
        <div key={leagueName} className={PANEL_BODY}>
          <p className="font-bold">{leagueName}</p>
          <p className="text-muted">{yourJoinRequestWords.waiting}</p>
        </div>
      ))}
    </Panel>
  );
}

function LeagueTable({ leagues, actions }: { leagues: readonly LeagueSummary[]; actions: DeletionActions }) {
  return (
    <table className="w-full border-collapse">
      <ColumnHeads columns={leagueColumns} classOf={(column) => (column === "teams" ? `${cellClasses} text-right` : cellClasses)} />
      {leagues.map((league) => (
        <tbody key={league.leagueId} className="border-t border-panel-rule">
          <tr>
            <th scope="row" className={`${cellClasses} font-semibold`}>
              <span className="block text-lead">{league.name}</span>
              <span className="block font-normal text-muted wrap-anywhere">{commissionerLine(league.commissionerEmail)}</span>
              {(runs(league) ? runnerLinks : managerLinks)(league.leagueId).map(({ to, title }) => (
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
          {deletes(league) && <DeleteLeagueRow league={league} actions={actions} />}
        </tbody>
      ))}
    </table>
  );
}
