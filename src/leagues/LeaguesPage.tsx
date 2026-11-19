import { Link, useNavigate } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { leagueOpens } from "../../convex/leagues/leagueOpens";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { ADMIN_PATH } from "../admin/paths";
import { ADMIN_TITLE } from "../admin/words";
import { ColumnHeads } from "../ui/ColumnHeads";
import { Notice, Panel, PANEL_BODY, Problem } from "../ui/Panel";
import { HOME_PATH } from "../frame/menu";
import { useChange } from "../shared/useChange";
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
import type { LeaguesSeam } from "./seam";
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
 *  strip under them; with none, a page saying so (spec/02), or the admin's empty table, and what
 *  became of their newest invite if it ended without them joining (spec/13, Joining). Beside it, their waiting join requests,
 *  how joining goes when they're in none, and the admin's panel offering "Create a league", as only
 *  the admin creates leagues in the beta. A league's name opens its League home and makes it the
 *  current league (spec/13, S13.10), as the top bar's switcher (frame/topBar/LeagueSwitcher.tsx) does. */
export function LeaguesPage({
  email,
  isAdmin,
  leagues,
  leaguesCut,
  switchableLeagueIds,
  currentLeagueId,
  actions,
  joining,
}: {
  email: string;
  isAdmin: boolean;
  leagues: readonly LeagueSummary[];
  /** More leagues exist than `leagues` holds. */
  leaguesCut: boolean;
  /** The leagues the person can make current, the server's list (#207): only these names link. */
  switchableLeagueIds: readonly Id<"leagues">[];
  currentLeagueId: Id<"leagues"> | null;
  actions: LeagueActions;
  joining: Pick<JoiningSeam, "useEndedInvite" | "useWaitingRequests">;
}) {
  const listed = leagues.filter(leagueOpens);
  return (
    <div className={LEAGUE_DESK}>
      <div className={`flex flex-col gap-2 ${LEAGUE_DESK_MAIN}`}>
        <Panel title={LEAGUES_TITLE} pageTitle>
          {leaguesCut && <Notice>{leaguesCutWords}</Notice>}
          {/* The admin in no league sees his leagues, none yet, and Create a league instead of the
              words (spec/02, S02.4). */}
          {(listed.length > 0 || isAdmin) && <LeagueTable leagues={listed} switchableLeagueIds={switchableLeagueIds} currentLeagueId={currentLeagueId} actions={actions} />}
          {leagues.length === 0 && (
            <div className={PANEL_BODY}>
              {!isAdmin && <p className="text-lead">{notInALeagueWords(email)}</p>}
              <EndedInviteLine useEndedInvite={joining.useEndedInvite} />
            </div>
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

type LeagueActions = DeletionActions & Pick<LeaguesSeam, "switchLeague">;

/** A league's name, opening its League home once the app is in it (S13.10); plain words when it
 *  isn't the person's to switch to. A refused switch is said under it, and the page stays. */
function LeagueName({
  league,
  switchable,
  isCurrent,
  switchLeague,
}: {
  league: LeagueSummary;
  switchable: boolean;
  isCurrent: boolean;
  switchLeague: LeaguesSeam["switchLeague"];
}) {
  const { busy, problem, run } = useChange();
  const navigate = useNavigate();
  if (!switchable) return <span className="block text-lead">{league.name}</span>;
  return (
    <>
      <Link
        to={HOME_PATH}
        disabled={busy}
        onClick={async (event) => {
          if (isCurrent) return;
          event.preventDefault();
          if (await run(() => switchLeague(league.leagueId))) await navigate({ to: HOME_PATH });
        }}
        className="flex min-h-tap items-center text-lead lg:min-h-0"
      >
        {league.name}
      </Link>
      <Problem problem={problem} />
    </>
  );
}

function LeagueTable({
  leagues,
  switchableLeagueIds,
  currentLeagueId,
  actions,
}: {
  leagues: readonly LeagueSummary[];
  switchableLeagueIds: readonly Id<"leagues">[];
  currentLeagueId: Id<"leagues"> | null;
  actions: LeagueActions;
}) {
  return (
    <table className="w-full border-collapse">
      <ColumnHeads columns={leagueColumns} classOf={(column) => (column === "teams" ? `${cellClasses} text-right` : cellClasses)} />
      {leagues.map((league) => (
        <tbody key={league.leagueId} className="border-t border-panel-rule">
          <tr>
            <th scope="row" className={`${cellClasses} font-semibold`}>
              <LeagueName
                league={league}
                switchable={switchableLeagueIds.includes(league.leagueId)}
                isCurrent={league.leagueId === currentLeagueId}
                switchLeague={actions.switchLeague}
              />
              <span className="block font-normal text-muted wrap-anywhere">{commissionerLine(league.commissionerEmail)}</span>
              {/* A way into one of the league's pages: a full tap on a phone, a plain line on a desktop. */}
              {(runs(league) ? runnerLinks : managerLinks)(league.leagueId).map(({ to, title }) => (
                <Link key={to} to={to} className="flex min-h-tap items-center font-normal lg:min-h-0">
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
