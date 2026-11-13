import { COMPETITION_TABLE_LINES, type TableLine } from "../../convex/football/tableLines";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { Loading, Panel, PanelNote } from "../ui/Panel";
import { ClubMark } from "../ui/ClubName";
import { ClubLink } from "./ClubLink";
import type { PlStandings, PremierLeagueSeam } from "./seam";
import {
  goalDifferenceWords,
  loadingTableWords,
  movedColumn,
  movedLabel,
  movedWords,
  noClubsWords,
  provisionalWords,
  TABLE_TITLE,
  tableColumns,
  tableLineWords,
  type Competition,
} from "./words";

const columns = { ...tableColumns, moved: movedColumn };
type Column = keyof typeof columns;
type Row = PlStandings["rows"][number];

const ALL_COLUMNS = Object.keys(tableColumns) as (keyof typeof tableColumns)[];
/** While a gameweek is live, the places moved follow Pos (the approved picture). */
const LIVE_COLUMNS: readonly Column[] = ["position", "moved", ...ALL_COLUMNS.slice(1)];
/** Columns a phone leaves out, for room: the difference says what they would. */
const DESK_ONLY: readonly Column[] = ["goalsFor", "goalsAgainst"];

const cellClasses = (column: Column) =>
  cellClassOf(column === "club", DESK_ONLY.includes(column));

/** Each line's look: Europe's cyan, relegation's orange (the approved picture). */
const LINE_CLASSES: Record<TableLine, string> = {
  championsLeague: "shadow-europe-line",
  otherEurope: "shadow-europe-line",
  relegation: "shadow-relegation-line",
};

/** The competition's table (spec/18, The table), live: marked Provisional while a match in it is
 *  being played, each club's places moved since the live gameweek began, and its lines under the
 *  European places and above relegation, held per competition (tableLines.ts). */
export function TablePanel({ seam, competition }: { seam: PremierLeagueSeam; competition: Competition }) {
  const standings = seam.useStandings();
  const lineUnder = new Map<number, TableLine>(
    Object.entries(COMPETITION_TABLE_LINES[competition]).map(([line, place]) => [place, line as TableLine]),
  );
  const aside = standings?.provisional ? <span className="text-event">{provisionalWords}</span> : undefined;
  const liveGameweek = standings?.liveGameweek ?? null;
  const shown = liveGameweek === null ? ALL_COLUMNS : LIVE_COLUMNS;
  return (
    <Panel title={TABLE_TITLE} aside={aside}>
      {standings === undefined ? (
        <Loading className="px-3 py-2">{loadingTableWords}</Loading>
      ) : standings.rows.length === 0 ? (
        <PanelNote>{noClubsWords}</PanelNote>
      ) : (
        <table className="w-full border-collapse">
          <ColumnHeads columns={columns} shown={shown} unseen={["moved"]} classOf={cellClasses} />
          <tbody>
            {standings.rows.map((row, index) => {
              const line = lineUnder.get(index + 1);
              return (
                <tr
                  key={row.club.code}
                  title={line && tableLineWords[line]}
                  data-line={line}
                  className={`h-row border-t border-panel-rule ${line === undefined ? "" : LINE_CLASSES[line]}`}
                >
                  {shown.map((column) => (
                    <TableCell key={column} column={column} row={row} liveGameweek={liveGameweek} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** Up cyan, down orange, unmoved muted (the approved picture). */
const movedClass = (moved: number) => (moved > 0 ? "text-derived" : moved < 0 ? "text-event" : "text-muted");

/** One cell of a club's row: its name heads the row, its points are the table's figure. */
function TableCell({ column, row, liveGameweek }: { column: Column; row: Row; liveGameweek: number | null }) {
  const className = cellClasses(column);
  switch (column) {
    case "position":
      return <td className={`${className} text-muted`}>{row.position}</td>;
    case "moved": {
      const moved = row.moved ?? 0;
      return (
        <td className={`${className} whitespace-nowrap ${movedClass(moved)}`} title={liveGameweek === null ? undefined : movedLabel(moved, liveGameweek)}>
          {movedWords(moved)}
        </td>
      );
    }
    case "club":
      return (
        <th scope="row" className={`${className} font-semibold`}>
          <ClubMark code={row.club.code} />
          <ClubLink club={row.club} />
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
