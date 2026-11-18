import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TOP_ROWS } from "../../convex/home/glance";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { Choice } from "../ui/Choice";
import { Loading, PageSection, Panel, PanelNote } from "../ui/Panel";
import { MY_TEAM_PATH, TABLE_PATH } from "../frame/menu";
import { MatchupLink } from "../matchup/MatchupLink";
import { Vidiprinter } from "../matchup/Vidiprinter";
import { FormChips } from "../ui/FormChips";
import { MailLine, MailWidget } from "../myTeam/squad/MailWidget";
import type { LatestMail } from "../myTeam/squad/seam";
import { useLastLoaded } from "../shared/useLastLoaded";
import { TOTAL_POINTS_COLUMNS } from "../table/words";
import { useMinute } from "../shared/useMinute";
import { NewsPanel } from "./NewsPanel";
import { PanelLink } from "./PanelLink";
import { RecapPanel } from "./Recap";
import type { HomeSeam, LeagueHome } from "./seam";
import { DeadlineStrip } from "./DeadlineStrip";
import { RecapToCome, RunLeagueToCome } from "./ToCome";
import { YourMatchup } from "./YourMatchup";
import { PremierLeaguePanel, SquadNewsPanel } from "./YourPlayers";
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
  flagOf,
  needsYouCountWords,
  noHeadToHeadsWords,
  nothingNeedsYouWords,
  starterNeedsYouWords,
  noMatchdayLinesWords,
  noResultsWords,
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

/** The columns of each format's table, total points' as the Table page has them. */
const COLUMNS_OF: Record<LeagueHome["format"], readonly Column[]> = {
  headToHead: HEAD_TO_HEAD_COLUMNS,
  totalPoints: TOTAL_POINTS_COLUMNS,
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
 *  Premier League's gameweek with the reader's players, the latest recap, his squad's news, and the
 *  panels still to come, each in its place. */
export function HomePage({ league, seam }: { league: LeagueSummary; seam: HomeSeam }) {
  // The minute is in the query's arguments, and league home mustn't blank every minute (nor its
  // Mail panel's choice reset); another league's loads afresh.
  const now = useMinute();
  const home = useLastLoaded(seam.useLeagueHome(league.leagueId, now), league.leagueId);
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
      ) : (
        <>
          <DeadlineStrip home={home} gameweek={gameweek} now={now} />
          <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-home">
            <div className="flex flex-col gap-2">
              <HomeMail mail={mail} lineup={home.yours?.lineup ?? null} />
              <NewsPanel home={home} />
            </div>
            <div className="flex flex-col gap-2">
              <YourMatchup home={home} />
              <HeadToHeads home={home} />
              <TablePanel home={home} />
            </div>
            <div className="flex flex-col gap-2">
              {home.matchday !== null && <Vidiprinter commentary={home.matchday.commentary} title={VIDIPRINTER_TITLE} noLinesWords={noMatchdayLinesWords} />}
              {gameweek !== null && home.yours !== null && <PremierLeaguePanel gameweek={gameweek} matches={home.yours.premierLeague} />}
              {home.recap !== null ? <RecapPanel recap={home.recap} /> : gameweek !== null && <RecapToCome gameweek={gameweek} />}
              {home.yours !== null && <SquadNewsPanel leagueId={league.leagueId} news={home.yours.squadNews} />}
              <RunLeagueToCome league={league} />
            </div>
          </div>
        </>
      )}
    </PageSection>
  );
}

type MailView = keyof typeof mailViews;
type LineupNow = NonNullable<LeagueHome["yours"]>["lineup"];
const MAIL_VIEWS = Object.keys(mailViews) as MailView[];

/** Overview's Mail, top of the left column and open on Needs you (S12.15): what waits on the
 *  manager, his doubtful or out starters first, each opening Tactics (S16.7), then the letters
 *  waiting on him, each opening in Mail; All is the newest letters. */
function HomeMail({ mail, lineup }: { mail: LatestMail | null | undefined; lineup: LineupNow }) {
  const [view, setView] = useState<MailView>("needsYou");
  const name = useId();
  const starters = (lineup?.flagged ?? []).flatMap((starter) => {
    const flag = flagOf(starter.chanceOfPlaying);
    return flag === null ? [] : [{ playerCode: starter.playerCode, words: starterNeedsYouWords(starter.name, flag) }];
  });
  const letters = mail?.needsYou ?? [];
  const waiting = starters.length + letters.length;
  const words = (option: MailView) => (option === "needsYou" ? needsYouCountWords(waiting) : mailViews[option]);
  const controls = (
    <div className="px-3 py-2">
      <Choice label={mailViewLabel} name={name} options={MAIL_VIEWS} words={words} chosen={view} onChoose={setView} labelShown={false} />
    </div>
  );
  return (
    <MailWidget mail={mail} title={MAIL_TITLE} controls={controls}>
      {view !== "needsYou" ? undefined : waiting === 0 ? (
        <PanelNote>{nothingNeedsYouWords}</PanelNote>
      ) : (
        <ol>
          {starters.map(({ playerCode, words }) => (
            <li key={playerCode} className="border-b border-panel-rule">
              <Link to={MY_TEAM_PATH} className="flex min-h-tap items-center px-3 py-1 font-semibold lg:min-h-0 shadow-event-edge hover:bg-stepper">
                {words}
              </Link>
            </li>
          ))}
          {letters.map((letter) => (
            <MailLine key={letter.letterId} letter={letter} />
          ))}
        </ol>
      )}
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
        {thisGameweek.fixtures.map(({ teamId, game, team, opponent, points }) => (
          <li key={`${team} v ${opponent ?? leagueAverageWords}`} className="grid grid-cols-sides items-center gap-3 border-b border-panel-rule px-3 py-1">
            <span className="font-semibold">{team}</span>
            <span className="flex h-7 w-14 items-center justify-center border border-muted">
              <MatchupLink teamId={teamId} team={team} opponent={opponent} gameweek={thisGameweek.gameweek} game={game} points={points} />
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
