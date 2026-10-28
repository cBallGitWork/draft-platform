import type { ReactNode } from "react";
import { COMPARED_PLAYERS } from "../../convex/scouting/comparedPlayers";
import { STAT_CATALOGUE } from "../../convex/scoring/statCatalogue";
import { Loading, Panel, PanelNote } from "../frame/Panel";
import { PositionCodes } from "../PositionCodes";
import { statFigure } from "./figures";
import type { ComparedPlayer, Comparison } from "./seam";
import {
  clearComparisonWords,
  columns,
  COMPARE_TITLE,
  comparingWords,
  freeAgentWords,
  matchesWords,
  noFigureWords,
  noPointsYetWords,
  noStatsYetWords,
  pickOneMoreWords,
} from "./words";

/** A player ticked to compare: his code, and his name to say so before the comparison loads. */
export type PickedPlayer = { code: number; name: string };

/** Two players side by side (spec/19): who each is, then every stat either has this season, added
 *  up. With one ticked, it asks for another. */
export function ComparePanel({ picked, comparison, clear }: { picked: readonly PickedPlayer[]; comparison: Comparison | undefined; clear: () => void }) {
  return (
    <Panel title={COMPARE_TITLE}>
      {picked.length < COMPARED_PLAYERS ? (
        <PanelNote>{pickOneMoreWords(picked[0].name)}</PanelNote>
      ) : comparison === undefined ? (
        <Loading className="px-3 py-2">{comparingWords}</Loading>
      ) : (
        <SideBySide comparison={comparison} />
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

const FIXED_ROWS: readonly Row[] = [
  { label: columns.club.long, cell: (player) => <abbr title={player.club.name} className="no-underline">{player.club.shortName}</abbr> },
  { label: columns.positions.long, cell: (player) => <PositionCodes positions={player.positions} /> },
  { label: columns.owner.short, title: columns.owner.long, cell: (player) => player.ownerTeamName ?? <span className="text-muted">{freeAgentWords}</span> },
  {
    label: columns.seasonPoints.short,
    title: columns.seasonPoints.long,
    cell: (player) =>
      player.seasonPoints === null ? (
        <span title={noPointsYetWords} className="text-muted">
          {noFigureWords}
        </span>
      ) : (
        <span className="font-bold text-figure">{player.seasonPoints}</span>
      ),
  },
  { label: matchesWords, cell: (player) => <span className="font-bold text-figure">{player.matches}</span> },
];

function SideBySide({ comparison }: { comparison: Comparison }) {
  // Every catalogue stat either has this season, in the catalogue's order; one neither has is 0 for both.
  const stats = STAT_CATALOGUE.filter((each) => comparison.some((player) => (player.stats[each.stat] ?? 0) !== 0));
  const statRows: Row[] = stats.map((each) => ({
    label: each.name,
    title: each.shortCode,
    cell: (player) => <span className="font-bold text-figure">{statFigure(player.stats[each.stat] ?? 0)}</span>,
  }));
  return (
    <>
      <table className="w-full max-w-2xl border-collapse">
        <thead className="bg-head text-ground">
          <tr>
            <td className="px-2" />
            {comparison.map((player) => (
              <th key={player.code} scope="col" title={player.fullName} className="px-2 text-right">
                {player.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...FIXED_ROWS, ...statRows].map((row) => (
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
