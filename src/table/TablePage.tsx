import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { PageTitle, PanelTitle } from "../frame/Panel";
import { FixturesPanel } from "./FixturesPanel";
import type { LeagueTable, TableSeam } from "./seam";
import { columns, differenceWords, loadingWords, noResultsWords, noRulesWords, TABLE_PAGE_TITLE, TABLE_TITLE } from "./words";

type Column = keyof typeof columns;
type Row = LeagueTable["table"][number];

/** The columns of each format's table: total points has no matchups to win, draw or lose. */
const COLUMNS_OF: Record<LeagueTable["format"], readonly Column[]> = {
  headToHead: ["position", "team", "played", "won", "drawn", "lost", "pointsFor", "pointsAgainst", "difference", "points"],
  totalPoints: ["position", "team", "played", "points"],
};

/** Columns a phone leaves out, for room: the difference says what they would. */
const DESK_ONLY: readonly Column[] = ["pointsFor", "pointsAgainst"];

/** A column's cells: names read from the left, figures line up on the right, and a phone leaves
 *  out what it has no room for. */
const cellClasses = (column: Column) =>
  `px-2 align-middle ${column === "team" ? "text-left" : "text-right"} ${DESK_ONLY.includes(column) ? "hidden sm:table-cell" : ""}`;

/** The league's table and fixtures (spec/12, spec/09), for anyone in it: the table beside the
 *  fixtures of one gameweek at a time. */
export function TablePage({ league, seam }: { league: LeagueSummary; seam: TableSeam }) {
  const leagueTable = seam.useLeagueTable(league.leagueId);
  return (
    <div className="flex max-w-6xl flex-col gap-2">
      <PageTitle>{TABLE_PAGE_TITLE}</PageTitle>
      {leagueTable === undefined ? (
        <p role="status" className="text-muted">
          {loadingWords}
        </p>
      ) : leagueTable === null ? (
        <p className="text-muted">{noRulesWords}</p>
      ) : (
        <div className="grid items-start gap-2 lg:grid-cols-2">
          <StandingsPanel leagueTable={leagueTable} />
          <FixturesPanel leagueTable={leagueTable} />
        </div>
      )}
    </div>
  );
}

function StandingsPanel({ leagueTable: { format, table } }: { leagueTable: LeagueTable }) {
  const shown = COLUMNS_OF[format];
  return (
    <section aria-labelledby="table-title" className="bg-panel">
      <PanelTitle id="table-title">{TABLE_TITLE}</PanelTitle>
      {table.every((row) => row.played === 0) && <p className="px-3 py-2">{noResultsWords}</p>}
      <table className="w-full border-collapse">
        <thead className="bg-head text-ground">
          <tr>
            {shown.map((column) => (
              <th
                key={column}
                scope="col"
                title={columns[column].long}
                aria-label={columns[column].long}
                className={cellClasses(column)}
              >
                {columns[column].short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row, index) => (
            <tr key={row.teamId} className="border-t border-panel-rule">
              {shown.map((column) => (
                <TableCell key={column} column={column} row={row} position={index + 1} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** One cell of a team's row: its name heads the row, its points are the table's figure. */
function TableCell({ column, row, position }: { column: Column; row: Row; position: number }) {
  const className = cellClasses(column);
  switch (column) {
    case "position":
      return <td className={`${className} text-muted`}>{position}</td>;
    case "team":
      return (
        <th scope="row" className={`${className} text-lead font-semibold`}>
          {row.teamName}
        </th>
      );
    case "difference":
      return <td className={className}>{differenceWords(row.difference)}</td>;
    case "points":
      return <td className={`${className} font-bold text-figure`}>{row.points}</td>;
    default:
      return <td className={className}>{row[column]}</td>;
  }
}
