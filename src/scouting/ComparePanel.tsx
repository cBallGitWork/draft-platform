import type { ReactNode } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { mainArea } from "../../convex/scouting/per90Figures";
import type { CatalogueStat } from "../../convex/scoring/statCatalogueList";
import { WaiverAction } from "../playerCard/WaiverAction";
import { statFigure } from "../shared/figures";
import { useMinute } from "../shared/useMinute";
import { OwnerName } from "../ui/OwnerName";
import { CloseButton, Loading, Panel, PanelNote } from "../ui/Panel";
import { PercentileBar, per90StatName } from "./Per90Figures";
import { PointsFigure } from "./PointsFigure";
import type { ComparedPlayer, Comparison, Period, ScoutingSeam } from "./seam";
import {
  clearComparisonWords,
  columns,
  COMPARE_TITLE,
  COMPARE_YOURS_TITLE,
  compareNoteWords,
  compareTakeWords,
  comparingWords,
  figureWords,
  noFigureWords,
  noRoleFitYetWords,
  noSeasonPointsWords,
  panelMinutesWords,
  perNinetyWords,
  seasonPointsColumn,
  totalWords,
  yoursWords,
} from "./words";

/** Two players side by side (spec/19; the approved picture's compare): each one's points and
 *  minutes, then a row a stat of the first's area (per90Figures.ts) with each one's total, figure per
 *  90 and percentile bar against that area, then the first's pickup or claim, dropping the second
 *  when he is the manager's and the squad is full. Their points are named by the season they are
 *  from while they are last season's (`pointsSeason`, the list's). */
export function ComparePanel({
  leagueId,
  comparison,
  pointsSeason,
  period,
  stat,
  yours,
  ownTeamName,
  seam,
  clear,
}: {
  leagueId: Id<"leagues">;
  comparison: Comparison | undefined;
  pointsSeason: number | null;
  /** The list's period, which the minutes and figures are over. */
  period: Period;
  /** The list's stat, which joins the rows. */
  stat: CatalogueStat | null;
  /** Whether the second is the manager's own player at the first's position. */
  yours: boolean;
  /** The manager's team's name, to say which player is his; null for someone running no team. */
  ownTeamName: string | null;
  seam: ScoutingSeam;
  clear: () => void;
}) {
  return (
    <Panel title={yours ? COMPARE_YOURS_TITLE : COMPARE_TITLE} aside={<CloseButton label={clearComparisonWords} close={clear} className="font-bold lg:min-h-0" />}>
      {comparison === undefined ? (
        <Loading className="px-3 py-2">{comparingWords}</Loading>
      ) : (
        <>
          <SideBySide comparison={comparison} pointsSeason={pointsSeason} period={period} stat={stat} ownTeamName={ownTeamName} />
          <TakeFirst leagueId={leagueId} first={comparison[0]} second={comparison[1]} seam={seam} />
        </>
      )}
    </Panel>
  );
}

const CELL = "whitespace-nowrap px-2 text-right";

function SideBySide({
  comparison,
  pointsSeason,
  period,
  stat,
  ownTeamName,
}: {
  comparison: Comparison;
  pointsSeason: number | null;
  period: Period;
  stat: CatalogueStat | null;
  ownTeamName: string | null;
}) {
  const area = mainArea(comparison[0].positions);
  const nameOf = per90StatName(stat);
  const owner = (player: ComparedPlayer) =>
    ownTeamName !== null && player.ownerTeamName === ownTeamName ? yoursWords : <OwnerName teamName={player.ownerTeamName} />;
  /** A row naming what it is, then each player's total (and, for a stat, his per 90 and bar). */
  const row = (label: string, title: string | undefined, cells: (player: ComparedPlayer, at: number) => ReactNode) => (
    <tr key={label} className="border-t border-panel-rule">
      <th scope="row" title={title} className="whitespace-nowrap px-3 py-1 text-left font-normal text-soft">
        {label}
      </th>
      {comparison.map((player, at) => cells(player, at))}
    </tr>
  );
  const totalOnly = (figure: ReactNode, key: number) => (
    <td key={key} colSpan={3} className="px-2">
      {figure}
    </td>
  );
  const pointsHead = seasonPointsColumn(pointsSeason);
  return (
    <>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <td />
            {comparison.map((player) => (
              <th key={player.code} scope="colgroup" colSpan={3} title={player.fullName} className="px-2 py-1 text-left font-normal">
                {player.name} ({owner(player)})
              </th>
            ))}
          </tr>
          <tr>
            <td />
            {comparison.map((player) => [
              <th key={`${player.code}-total`} scope="col" className={`${CELL} font-normal text-soft`}>
                {totalWords}
              </th>,
              <th key={`${player.code}-per90`} scope="col" className={`${CELL} font-normal text-soft`}>
                {perNinetyWords}
              </th>,
              <td key={`${player.code}-bar`} />,
            ])}
          </tr>
        </thead>
        <tbody>
          {row(columns.roleFit.long, noRoleFitYetWords, (_player, at) => totalOnly(<span className="text-muted">{noFigureWords}</span>, at))}
          {row(pointsHead.short, pointsHead.long, (player, at) => totalOnly(<PointsFigure points={player.seasonPoints} why={noSeasonPointsWords(pointsSeason)} />, at))}
          {row(panelMinutesWords(period, pointsSeason), undefined, (player, at) => totalOnly(<span className="font-bold text-figure">{figureWords(player.minutes)}</span>, at))}
          {area !== null &&
            comparison[0].figures.map(({ stat: each }, index) =>
              row(nameOf(each), undefined, (player) => {
                const { total, perNinety, percentile } = player.figures[index];
                return [
                  <td key={`${player.code}-total`} className={`${CELL} font-bold text-figure`}>
                    {statFigure(total)}
                  </td>,
                  <td key={`${player.code}-per90`} className={CELL}>
                    {perNinety === null ? noFigureWords : statFigure(perNinety)}
                  </td>,
                  <td key={`${player.code}-bar`} className="w-16 px-2">
                    <PercentileBar percentile={percentile} area={area} />
                  </td>,
                ];
              }),
            )}
        </tbody>
      </table>
      {area !== null && <PanelNote>{compareNoteWords(area, period)}</PanelNote>}
    </>
  );
}

/** The first player's pickup (a free agent) or claim (on waivers), named "Pick up X" or "Claim X",
 *  dropping the second ("Pick up X, drop Y") only when he is in the manager's squad and the squad is
 *  full (Craig, 9 Nov 2026, on #1028, answer 4). Nothing when the first is no one's to take. */
function TakeFirst({ leagueId, first, second, seam }: { leagueId: Id<"leagues">; first: ComparedPlayer; second: ComparedPlayer; seam: ScoutingSeam }) {
  const squadFull = seam.useYourPlayer(leagueId, first.code, useMinute())?.squadFull ?? false;
  return (
    <WaiverAction
      leagueId={leagueId}
      card={first}
      seam={seam}
      fixed={{ drops: squadFull ? second : null, label: (kind, dropName) => compareTakeWords(kind, first.name, dropName) }}
      className="border-t border-panel-rule p-3"
    />
  );
}
