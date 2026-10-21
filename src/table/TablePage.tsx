import type { LeagueSummary } from "../../convex/myLeagues";
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

const cellClasses = "px-2 text-right align-middle";

/** The league's table and fixtures (spec/12, spec/09), for anyone in it: the table beside the
 *  fixtures of one gameweek at a time. */
export function TablePage({ league, seam }: { league: LeagueSummary; seam: TableSeam }) {
  const leagueTable = seam.useLeagueTable(league.leagueId);
  return (
    <div className="flex max-w-6xl flex-col gap-2">
      <section aria-labelledby="page-title" className="bg-panel">
        <PageTitle>{TABLE_PAGE_TITLE}</PageTitle>
        <p className="px-3 py-2 text-lead font-semibold">{league.name}</p>
      </section>
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
  const visibility = (column: Column) => (DESK_ONLY.includes(column) ? "hidden sm:table-cell" : "");
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
                className={`${cellClasses} ${column === "team" ? "text-left" : ""} ${visibility(column)}`}
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
                <TableCell key={column} column={column} row={row} position={index + 1} className={visibility(column)} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** One cell of a team's row: its name heads the row, its points are the table's figure. */
function TableCell({ column, row, position, className }: { column: Column; row: Row; position: number; className: string }) {
  switch (column) {
    case "position":
      return <td className={`${cellClasses} text-muted ${className}`}>{position}</td>;
    case "team":
      return (
        <th scope="row" className={`${cellClasses} text-left text-lead font-semibold ${className}`}>
          {row.teamName}
        </th>
      );
    case "difference":
      return <td className={`${cellClasses} ${className}`}>{differenceWords(row.difference)}</td>;
    case "points":
      return <td className={`${cellClasses} font-bold text-figure ${className}`}>{row.points}</td>;
    default:
      return <td className={`${cellClasses} ${className}`}>{row[column]}</td>;
  }
}
