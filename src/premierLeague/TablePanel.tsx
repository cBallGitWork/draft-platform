import { Loading, PanelTitle } from "../frame/Panel";
import type { PlStandings, PremierLeagueSeam } from "./seam";
import { goalDifferenceWords, loadingTableWords, provisionalWords, TABLE_TITLE, tableColumns } from "./words";

const TITLE_ID = "pl-table-title";

type Column = keyof typeof tableColumns;
type Row = PlStandings["rows"][number];

const COLUMNS: readonly Column[] = ["position", "club", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "goalDifference", "points"];
/** Columns a phone leaves out, for room: the difference says what they would. */
const DESK_ONLY: readonly Column[] = ["goalsFor", "goalsAgainst"];

const cellClasses = (column: Column) =>
  `px-2 align-middle ${column === "club" ? "text-left" : "text-right"} ${DESK_ONLY.includes(column) ? "hidden sm:table-cell" : ""}`;

/** The Premier League table (spec/18, The table), worked out from the results, live; marked
 *  provisional while a match in it is being played. */
export function TablePanel({ seam }: { seam: PremierLeagueSeam }) {
  const standings = seam.useStandings();
  return (
    <section aria-labelledby={TITLE_ID} className="bg-panel">
      <PanelTitle id={TITLE_ID}>{TABLE_TITLE}</PanelTitle>
      {standings === undefined ? (
        <Loading className="px-3 py-2">{loadingTableWords}</Loading>
      ) : (
        <>
          {standings.provisional && <p className="px-3 py-2 text-derived">{provisionalWords}</p>}
          <table className="w-full border-collapse">
            <thead className="bg-head text-ground">
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column} scope="col" title={tableColumns[column].long} aria-label={tableColumns[column].long} className={cellClasses(column)}>
                    {tableColumns[column].short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.rows.map((row) => (
                <tr key={row.club.code} className="border-t border-panel-rule">
                  {COLUMNS.map((column) => (
                    <TableCell key={column} column={column} row={row} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

/** One cell of a club's row: its name heads the row, its points are the table's figure. */
function TableCell({ column, row }: { column: Column; row: Row }) {
  const className = cellClasses(column);
  switch (column) {
    case "position":
      return <td className={`${className} text-muted tabular-nums`}>{row.position}</td>;
    case "club":
      return (
        <th scope="row" className={`${className} font-semibold`}>
          <span className="hidden sm:inline">{row.club.name}</span>
          <span className="sm:hidden" title={row.club.name}>
            {row.club.shortName}
          </span>
        </th>
      );
    case "goalDifference":
      return <td className={`${className} tabular-nums`}>{goalDifferenceWords(row.goalDifference)}</td>;
    case "points":
      return <td className={`${className} font-bold text-figure tabular-nums`}>{row.points}</td>;
    default:
      return <td className={`${className} tabular-nums`}>{row[column]}</td>;
  }
}
