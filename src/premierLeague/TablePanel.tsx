import { ColumnHeads } from "../frame/ColumnHeads";
import { Loading, Panel, PanelNote } from "../frame/Panel";
import type { PlStandings, PremierLeagueSeam } from "./seam";
import { goalDifferenceWords, loadingTableWords, noClubsWords, provisionalWords, TABLE_TITLE, tableColumns } from "./words";

type Column = keyof typeof tableColumns;
type Row = PlStandings["rows"][number];

const COLUMNS = Object.keys(tableColumns) as Column[];
/** Columns a phone leaves out, for room: the difference says what they would. */
const DESK_ONLY: readonly Column[] = ["goalsFor", "goalsAgainst"];

const cellClasses = (column: Column) =>
  `px-2 align-middle ${column === "club" ? "text-left" : "text-right"} ${DESK_ONLY.includes(column) ? "hidden sm:table-cell" : ""}`;

/** The Premier League table (spec/18, The table), worked out from the results, live; marked
 *  provisional while a match in it is being played. */
export function TablePanel({ seam }: { seam: PremierLeagueSeam }) {
  const standings = seam.useStandings();
  return (
    <Panel title={TABLE_TITLE}>
      {standings === undefined ? (
        <Loading className="px-3 py-2">{loadingTableWords}</Loading>
      ) : standings.rows.length === 0 ? (
        <PanelNote>{noClubsWords}</PanelNote>
      ) : (
        <>
          {standings.provisional && <p className="px-3 py-2 text-derived">{provisionalWords}</p>}
          <table className="w-full border-collapse">
            <ColumnHeads columns={tableColumns} shown={COLUMNS} classOf={cellClasses} />
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
    </Panel>
  );
}

/** One cell of a club's row: its name heads the row, its points are the table's figure. */
function TableCell({ column, row }: { column: Column; row: Row }) {
  const className = cellClasses(column);
  switch (column) {
    case "position":
      return <td className={`${className} text-muted`}>{row.position}</td>;
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
      return <td className={className}>{goalDifferenceWords(row.goalDifference)}</td>;
    case "points":
      return <td className={`${className} font-bold text-figure`}>{row.points}</td>;
    default:
      return <td className={className}>{row[column]}</td>;
  }
}
