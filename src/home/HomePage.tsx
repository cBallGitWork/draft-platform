import { useId, useState } from "react";
import { TOP_ROWS } from "../../convex/home/glance";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { Choice } from "../ui/Choice";
import { Loading, PageSection, Panel, PanelNote } from "../ui/Panel";
import { TABLE_PATH } from "../frame/menu";
import { MatchupLink } from "../matchup/MatchupLink";
import { Vidiprinter } from "../matchup/Vidiprinter";
import { FormChips } from "../myTeam/header/FormChips";
import { MailWidget } from "../myTeam/squad/MailWidget";
import type { LatestMail } from "../myTeam/squad/seam";
import { useMinute } from "../shared/useMinute";
import { NewsPanel } from "./NewsPanel";
import { PanelLink } from "./PanelLink";
import { RecapPanel } from "./Recap";
import type { HomeSeam, LeagueHome } from "./seam";
import { DeadlineStrip, PremierLeagueToCome, RecapToCome, RunLeagueToCome, SquadNewsToCome } from "./ToCome";
import { YourMatchup } from "./YourMatchup";
import {
  byeWords,
  columns,
  figureWords,
  gameweekShort,
  headToHeadsLabel,
  leagueAverageWords,
  loadingWords,
  MAIL_TITLE,
  mailViewLabel,
  mailViews,
  needsYouToComeWords,
  noHeadToHeadsWords,
  noMatchdayLinesWords,
  noResultsWords,
  noRulesWords,
  partTableWords,
  recordWords,
  TABLE_TITLE,
  THIS_GAMEWEEK_TITLE,
  VIDIPRINTER_TITLE,
  wholeTableLink,
  yourTeamWords,
} from "./words";

/** The table's columns, as the approved picture has them: won, drawn and lost in one, and form. */
const HEAD_TO_HEAD_COLUMNS = ["position", "team", "record", "points", "form"] as const;
type Column = (typeof HEAD_TO_HEAD_COLUMNS)[number] | "played";
type Row = LeagueHome["table"][number];

/** The columns of each format's table: total points has no matchups to win, draw or lose. */
const COLUMNS_OF: Record<LeagueHome["format"], readonly Column[]> = {
  headToHead: HEAD_TO_HEAD_COLUMNS,
  totalPoints: ["position", "team", "played", "points"],
};
/** Columns a phone leaves out, for room: points and form say what they would. */
const DESK_ONLY: readonly Column[] = ["record"];

const cellClasses = (column: Column) =>
  cellClassOf(column === "team" || column === "form", DESK_ONLY.includes(column));

/** League home's Overview (spec/12, League home), built to its approved picture
 *  (docs/design/approved/home/1440.png): the league's hub, laid out by us, never by its managers.
 *  Under the league's title plate, the deadline strip; then Mail and News on the left; Your matchup,
 *  this gameweek's head-to-heads, scored once begun, and the table with each team's form in the
 *  centre; and on the right, the Vidiprinter while a matchday is open (1440-locked.png), the
 *  latest recap, and the panels still to come, each in its place. */
export function HomePage({ league, seam }: { league: LeagueSummary; seam: HomeSeam }) {
  const home = seam.useLeagueHome(league.leagueId, useMinute());
  const mail = seam.useLatestMail();
  const gameweek = home?.thisGameweek?.gameweek ?? null;
  const title = (
    <>
      {league.name}
      {/* Said again in the strip's first box, so read once. */}
      {gameweek !== null && (
        <span aria-hidden="true" className="ml-4 font-sans text-lead font-normal">
          {gameweekShort(gameweek)}
        </span>
      )}
    </>
  );
  return (
    <PageSection title={title} className="flex flex-col gap-2">
      {home === undefined ? (
        <Loading>{loadingWords}</Loading>
      ) : home === null ? (
        <p className="text-muted">{noRulesWords}</p>
      ) : (
        <>
          {gameweek !== null && <DeadlineStrip gameweek={gameweek} />}
          <div className="grid items-start gap-2 lg:grid-cols-home">
            <div className="flex flex-col gap-2">
              <HomeMail mail={mail} />
              <NewsPanel home={home} />
            </div>
            <div className="flex flex-col gap-2">
              <YourMatchup home={home} />
              <HeadToHeads home={home} />
              <TablePanel home={home} />
            </div>
            <div className="flex flex-col gap-2">
              {home.matchday !== null && <Vidiprinter commentary={home.matchday.commentary} title={VIDIPRINTER_TITLE} noLinesWords={noMatchdayLinesWords} />}
              {gameweek !== null && <PremierLeagueToCome gameweek={gameweek} />}
              {home.recap !== null ? <RecapPanel recap={home.recap} /> : gameweek !== null && <RecapToCome gameweek={gameweek} />}
              <SquadNewsToCome />
              <RunLeagueToCome league={league} />
            </div>
          </div>
        </>
      )}
    </PageSection>
  );
}

type MailView = keyof typeof mailViews;
const MAIL_VIEWS = Object.keys(mailViews) as MailView[];

/** Overview's Mail: the newest letters, with Needs you | All; which letters need a manager is still
 *  to grill, so Needs you holds a line saying so. */
function HomeMail({ mail }: { mail: LatestMail | null | undefined }) {
  const [view, setView] = useState<MailView>("all");
  const name = useId();
  const controls = (
    <div className="px-3 py-2">
      <Choice label={mailViewLabel} name={name} options={MAIL_VIEWS} words={mailViews} chosen={view} onChoose={setView} labelShown={false} />
    </div>
  );
  return (
    <MailWidget mail={mail} title={MAIL_TITLE} controls={controls}>
      {view === "needsYou" ? <PanelNote>{needsYouToComeWords}</PanelNote> : undefined}
    </MailWidget>
  );
}

function HeadToHeads({ home: { format, thisGameweek } }: { home: LeagueHome }) {
  if (thisGameweek === null) {
    return (
      <Panel title={THIS_GAMEWEEK_TITLE}>
        <PanelNote>{noHeadToHeadsWords[format]}</PanelNote>
      </Panel>
    );
  }
  return (
    <Panel title={THIS_GAMEWEEK_TITLE}>
      <ul aria-label={headToHeadsLabel(gameweekShort(thisGameweek.gameweek))}>
        {thisGameweek.fixtures.map(({ teamId, team, opponent, points }) => (
          <li key={`${team} v ${opponent ?? leagueAverageWords}`} className="grid grid-cols-sides items-center gap-3 border-b border-panel-rule px-3 py-1">
            <span className="font-semibold">{team}</span>
            <span className="flex h-7 w-14 items-center justify-center border border-muted">
              <MatchupLink teamId={teamId} team={team} opponent={opponent} gameweek={thisGameweek.gameweek} points={points} />
            </span>
            {opponent === null ? <span className="text-derived">{leagueAverageWords}</span> : <span className="font-semibold">{opponent}</span>}
          </li>
        ))}
        {thisGameweek.byes.map((team) => (
          <li key={team} className="border-b border-panel-rule px-3 py-1 text-muted">
            {byeWords(team)}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function TablePanel({ home: { format, table, teams } }: { home: LeagueHome }) {
  const shown = COLUMNS_OF[format];
  const cut = table.length < teams;
  return (
    <Panel title={TABLE_TITLE}>
      {table.every((row) => row.played === 0) && <PanelNote>{noResultsWords}</PanelNote>}
      <table className="w-full border-collapse">
        <ColumnHeads columns={columns} shown={shown} classOf={cellClasses} />
        <tbody>
          {table.map((row) => (
            <tr key={row.teamId} aria-current={row.mine || undefined} className="h-row border-t border-panel-rule aria-current:bg-ground aria-current:shadow-current-edge">
              {shown.map((column) => (
                <TableCell key={column} column={column} row={row} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {cut && <PanelNote>{partTableWords(teams, table.some((row) => row.position > TOP_ROWS))}</PanelNote>}
      <PanelLink to={TABLE_PATH}>{wholeTableLink}</PanelLink>
    </Panel>
  );
}

/** One cell of a team's row: its name heads the row, its points and form are the table's figures. */
function TableCell({ column, row }: { column: Column; row: Row }) {
  const className = cellClasses(column);
  switch (column) {
    case "position":
      return <td className={`${className} text-muted`}>{row.position}</td>;
    case "team":
      return (
        <th scope="row" className={`${className} font-semibold`}>
          {row.mine && <span className="sr-only">{yourTeamWords}: </span>}
          {row.teamName}
        </th>
      );
    case "record":
      return <td className={className}>{recordWords(row)}</td>;
    case "points":
      return <td className={`${className} font-bold text-figure`}>{figureWords(row.points)}</td>;
    case "form":
      return (
        <td className={className}>
          <FormChips form={row.form} />
        </td>
      );
    case "played":
      return <td className={className}>{row.played}</td>;
  }
}
