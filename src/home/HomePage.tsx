import { Link } from "@tanstack/react-router";
import { TOP_ROWS } from "../../convex/home/glance";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { ColumnHeads } from "../frame/ColumnHeads";
import { DateBlock } from "../frame/DateBlock";
import { Loading, PageSection, Panel, PanelNote } from "../frame/Panel";
import { MAIL_PATH, TABLE_PATH } from "../frame/menu";
import { MatchupLink } from "../matchup/MatchupLink";
import { useMinute } from "../shared/useMinute";
import type { HomeSeam, LeagueHome } from "./seam";
import {
  byeWords,
  columns,
  formLabel,
  fromWords,
  gameweekWords,
  HEAD_TO_HEADS_TITLE,
  headToHeadsLabel,
  HOME_TITLE,
  inMailLink,
  leagueAverageWords,
  LETTER_TITLE,
  loadingWords,
  MOVES_TITLE,
  moveWords,
  noFormWords,
  noHeadToHeadsWords,
  noLetterWords,
  noMovesWords,
  noResultsWords,
  noRulesWords,
  partTableWords,
  resultWords,
  TABLE_TITLE,
  versusWords,
  wholeTableLink,
  yourTeamWords,
} from "./words";

/** The table's columns: the table screen's, less points for and against, and with form. */
const HEAD_TO_HEAD_COLUMNS = ["position", "team", "played", "won", "drawn", "lost", "points", "form"] as const;
type Column = (typeof HEAD_TO_HEAD_COLUMNS)[number];
type Row = LeagueHome["table"][number];

/** The columns of each format's table: total points has no matchups to win, draw or lose. */
const COLUMNS_OF: Record<LeagueHome["format"], readonly Column[]> = {
  headToHead: HEAD_TO_HEAD_COLUMNS,
  totalPoints: ["position", "team", "played", "points"],
};
/** Columns a phone leaves out, for room: points and form say what they would. */
const DESK_ONLY: readonly Column[] = ["won", "drawn", "lost"];

const cellClasses = (column: Column) =>
  `px-2 align-middle ${column === "team" || column === "form" ? "text-left" : "text-right"} ${DESK_ONLY.includes(column) ? "hidden sm:table-cell" : ""}`;

/** League home (spec/12, League home): the league's hub, laid out by us, never by its managers. The
 *  glance (this gameweek's head-to-heads, the table and each team's form), the commissioner's
 *  latest letter, pinned, and the latest claims, drops and trades. */
export function HomePage({ league, seam }: { league: LeagueSummary; seam: HomeSeam }) {
  const home = seam.useLeagueHome(league.leagueId, useMinute());
  return (
    <PageSection title={HOME_TITLE} className="flex max-w-6xl flex-col gap-2">
      {home === undefined ? (
        <Loading>{loadingWords}</Loading>
      ) : home === null ? (
        <p className="text-muted">{noRulesWords}</p>
      ) : (
        <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)]">
          <HeadToHeads home={home} />
          <TablePanel home={home} />
          <div className="flex flex-col gap-2">
            <PinnedLetter letter={home.pinnedLetter} />
            <SquadMoves moves={home.squadMoves} />
          </div>
        </div>
      )}
    </PageSection>
  );
}

/** A panel's way on to the page that holds all of what it shows. */
function PanelLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="flex min-h-tap items-center px-3">
      {children}
    </Link>
  );
}

function HeadToHeads({ home: { format, thisGameweek } }: { home: LeagueHome }) {
  if (thisGameweek === null) {
    return (
      <Panel title={HEAD_TO_HEADS_TITLE}>
        <PanelNote>{noHeadToHeadsWords[format]}</PanelNote>
      </Panel>
    );
  }
  const title = gameweekWords(thisGameweek.gameweek);
  return (
    <Panel title={title}>
      <ul aria-label={headToHeadsLabel(title)}>
        {thisGameweek.fixtures.map(({ teamId, team, opponent }) => (
          <li key={`${team} v ${opponent ?? leagueAverageWords}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-panel-rule px-3 py-1 text-lead">
            <span className="text-right font-semibold">{team}</span>
            <MatchupLink teamId={teamId} team={team} opponent={opponent} gameweek={thisGameweek.gameweek}>
              <span>{versusWords}</span>
            </MatchupLink>
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
            <tr key={row.teamId} aria-current={row.mine || undefined} className="border-t border-panel-rule aria-current:shadow-current-edge">
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
        <th scope="row" className={`${className} text-lead font-semibold`}>
          {row.mine && <span className="sr-only">{yourTeamWords}: </span>}
          {row.teamName}
        </th>
      );
    case "points":
      return <td className={`${className} font-bold text-figure`}>{row.points}</td>;
    case "form":
      return (
        <td className={className} aria-label={formLabel(row.form)}>
          {row.form.length === 0 ? (
            <span aria-hidden="true" className="text-muted">
              {noFormWords}
            </span>
          ) : (
            <span aria-hidden="true" className="flex gap-1 font-bold text-figure">
              {row.form.map((result, index) => (
                <span key={index}>{resultWords[result].short}</span>
              ))}
            </span>
          )}
        </td>
      );
    default:
      return <td className={className}>{row[column]}</td>;
  }
}

function PinnedLetter({ letter }: { letter: LeagueHome["pinnedLetter"] }) {
  return (
    <Panel title={LETTER_TITLE}>
      {letter === null ? (
        <PanelNote>{noLetterWords}</PanelNote>
      ) : (
        <article className="flex flex-col gap-1 px-3 pt-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <DateBlock at={letter.at} />
            <h3 className="text-lead font-bold">{letter.subject}</h3>
          </div>
          <p className="text-muted">{fromWords(letter.from)}</p>
          <p className="whitespace-pre-line">{letter.body}</p>
        </article>
      )}
      <PanelLink to={MAIL_PATH}>{inMailLink}</PanelLink>
    </Panel>
  );
}

function SquadMoves({ moves }: { moves: LeagueHome["squadMoves"] }) {
  return (
    <Panel title={MOVES_TITLE}>
      {moves.length === 0 ? (
        <PanelNote>{noMovesWords}</PanelNote>
      ) : (
        <ol>
          {moves.map((move) => (
            <li key={`${move.at} ${move.kind} ${move.playerName}`} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2 border-b border-panel-rule px-3 py-1">
              <DateBlock at={move.at} />
              <span>{moveWords(move)}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
