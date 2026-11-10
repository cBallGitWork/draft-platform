import type { Id } from "../../convex/_generated/dataModel";
import type { Area } from "../../convex/lineup/pitch";
import type { CatalogueStat } from "../../convex/scoring/statCatalogueList";
import { Loading } from "../ui/Panel";
import { statFigure } from "../shared/figures";
import type { Period, ScoutingSeam } from "./seam";
import { loadingPer90Words, noFigureWords, PER90_STAT_NAMES, notRankedWords, per90Words, percentileLabel, versusWords } from "./words";

/** A per-90 stat's name: an area's stats by the panel's own names; `stat`, the list's, maybe one of
 *  the site's own, by its own. */
export const per90StatName = (stat: CatalogueStat | null) => (key: string) => PER90_STAT_NAMES[key] ?? (key === stat?.stat ? stat.name : key);

/** A bar as long as a percentile against `area`'s players, the figure on hover; nothing while he
 *  isn't ranked. Compare draws one a player too. */
export function PercentileBar({ percentile, area }: { percentile: number | null; area: Area }) {
  if (percentile === null) return null;
  return (
    <span role="img" aria-label={percentileLabel(percentile, area)} title={percentileLabel(percentile, area)} className="block h-2 w-full bg-name-plate">
      <span className="block h-full bg-derived" style={{ width: `${percentile}%` }} />
    </span>
  );
}

/** The selected player's figures per 90 over the list's period (the approved picture): a head row naming
 *  whom he is ranked against, then a row a stat with his figure to two places, a bar as long as his percentile
 *  (hover gives it) and the percentile itself; "—" with no minutes, and no bar while he has too few
 *  minutes to be ranked. `stat` is the list's, which joins them. */
export function Per90Figures({
  leagueId,
  playerCode,
  stat,
  period,
  seam,
}: {
  leagueId: Id<"leagues">;
  playerCode: number;
  stat: CatalogueStat | null;
  period: Period;
  seam: ScoutingSeam;
}) {
  const panel = seam.usePer90(leagueId, playerCode, stat?.stat ?? null, period);
  const nameOf = per90StatName(stat);
  if (panel === undefined) return <Loading className="px-3 py-1">{loadingPer90Words}</Loading>;
  const { area, ranked, figures } = panel;
  if (area === null) return null;
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-t border-panel-rule">
          <th scope="col" className="px-3 py-1 text-left font-normal text-soft">
            {per90Words(period)}
          </th>
          <th scope="col" colSpan={3} className="px-3 py-1 text-right font-normal text-soft">
            {ranked ? versusWords(area) : notRankedWords}
          </th>
        </tr>
      </thead>
      <tbody>
        {figures.map(({ stat: each, perNinety, percentile }) => (
          <tr key={each} className="border-t border-panel-rule">
            <th scope="row" className="px-3 py-1 text-left font-normal">
              {nameOf(each)}
            </th>
            <td className="px-2 text-right font-bold text-figure">{perNinety === null ? noFigureWords : statFigure(perNinety)}</td>
            <td className="w-24 px-2">
              <PercentileBar percentile={percentile} area={area} />
            </td>
            <td className="px-3 text-right text-soft">{percentile ?? noFigureWords}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
