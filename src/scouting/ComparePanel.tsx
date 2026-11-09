import type { ReactNode } from "react";
import { STAT_CATALOGUE } from "../../convex/scoring/statCatalogueList";
import { Loading, Panel, PanelNote } from "../ui/Panel";
import { PositionCodes } from "../ui/PositionCodes";
import { OwnerName } from "../ui/OwnerName";
import { ClubMark, ClubShort } from "../ui/ClubName";
import { ColumnHeads } from "../ui/ColumnHeads";
import { statFigure } from "../shared/figures";
import type { ComparedPlayer, Comparison } from "./seam";
import {
  clearComparisonWords,
  columns,
  COMPARE_TITLE,
  comparingWords,
  compareWhatColumn,
  figureWords,
  matchesWords,
  noFigureWords,
  noPointsYetWords,
  noStatsYetWords,
  notLastSeasonWords,
  seasonPointsColumn,
} from "./words";

/** Two players side by side (spec/19): who each is, then every stat either has this season, added
 *  up. Their points are named by the season they are from while they are last season's
 *  (`pointsSeason`, the list's). */
export function ComparePanel({
  comparison,
  pointsSeason,
  clear,
}: {
  comparison: Comparison | undefined;
  pointsSeason: number | null;
  clear: () => void;
}) {
  return (
    <Panel title={COMPARE_TITLE}>
      {comparison === undefined ? (
        <Loading className="px-3 py-2">{comparingWords}</Loading>
      ) : (
        <SideBySide comparison={comparison} pointsSeason={pointsSeason} />
      )}
      <div className="px-3 pt-2 pb-3">
        <button type="button" onClick={clear} className="secondary-action min-h-tap px-3">
          {clearComparisonWords}
        </button>
      </div>
    </Panel>
  );
}

/** One row of the comparison: what it is, and each player's. */
type Row = { label: string; title?: string; cell: (player: ComparedPlayer) => ReactNode };

const fixedRows = (pointsSeason: number | null): readonly Row[] => [
  {
    label: columns.club.long,
    cell: (player) => (
      <>
        <ClubMark code={player.club.code} />
        <ClubShort club={player.club} />
      </>
    ),
  },
  { label: columns.positions.long, cell: (player) => <PositionCodes positions={player.positions} /> },
  { label: columns.owner.short, title: columns.owner.long, cell: (player) => <OwnerName teamName={player.ownerTeamName} /> },
  {
    label: seasonPointsColumn(pointsSeason).short,
    title: seasonPointsColumn(pointsSeason).long,
    cell: (player) =>
      player.seasonPoints === null ? (
        <span title={pointsSeason === null ? noPointsYetWords : notLastSeasonWords} className="text-muted">
          {noFigureWords}
        </span>
      ) : (
        <span className="font-bold text-figure">{figureWords(player.seasonPoints)}</span>
      ),
  },
  { label: matchesWords, cell: (player) => <span className="font-bold text-figure">{player.matches}</span> },
];

/** The key of the column that names each row (`compareWhatColumn`). */
const WHAT = "what";

function SideBySide({ comparison, pointsSeason }: { comparison: Comparison; pointsSeason: number | null }) {
  // Every catalogue stat either has this season, in the catalogue's order; one neither has is 0 for both.
  const stats = STAT_CATALOGUE.filter((each) => comparison.some((player) => (player.stats[each.stat] ?? 0) !== 0));
  const statRows: Row[] = stats.map((each) => ({
    label: each.name,
    title: each.shortCode,
    cell: (player) => <span className="font-bold text-figure">{statFigure(player.stats[each.stat] ?? 0)}</span>,
  }));
  // A column per player, keyed by his code; `shown` keeps the order, as a number-like key would
  // otherwise come before "what".
  const playerColumns = comparison.map((player) => [String(player.code), { short: player.name, long: player.fullName }] as const);
  return (
    <>
      <table className="w-full max-w-2xl border-collapse">
        <ColumnHeads
          columns={{ [WHAT]: compareWhatColumn, ...Object.fromEntries(playerColumns) }}
          shown={[WHAT, ...playerColumns.map(([code]) => code)]}
          unseen={[WHAT]}
          classOf={(column) => (column === WHAT ? "px-2" : "px-2 text-right")}
        />
        <tbody>
          {[...fixedRows(pointsSeason), ...statRows].map((row) => (
            <tr key={row.label} className="border-t border-panel-rule">
              <th scope="row" title={row.title} className="px-2 text-left font-normal text-soft">
                {row.label}
              </th>
              {comparison.map((player) => (
                <td key={player.code} className="px-2 text-right">
                  {row.cell(player)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {stats.length === 0 && <PanelNote>{noStatsYetWords}</PanelNote>}
    </>
  );
}
