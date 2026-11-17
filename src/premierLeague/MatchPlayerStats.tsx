import type { ReactNode } from "react";
import type { MatchStat } from "../../convex/match/matchStatLine";
import { ColumnHeads, cellClassOf } from "../ui/ColumnHeads";
import { Panel, PanelNote } from "../ui/Panel";
import { Placeholder } from "../ui/Placeholder";
import { PositionCode } from "../ui/PositionCodes";
import type { MatchMan, MatchPageData } from "./seam";
import { figureOrNone, matchStatColumns, MOVED_TITLE, noFigureWords, noMenWords, notCountingLabel, playerStatsLabel, SHOTS_TITLE, shotsNotHeldLabel } from "./words";

// The match page's Player stats tab (#2490; spec/10 S10.8; the approved picture
// `1440-player-stats.png`): one table a club, each man who played's stats for the match, then the
// Shots panel greyed until Sportmonks' xG add-on is bought (#1196).

type Column = keyof typeof matchStatColumns;
const STAT_COLUMNS = Object.keys(matchStatColumns).filter((column) => column !== "position" && column !== "player" && column !== "points") as MatchStat[];

/** Each club's table side by side, any man since gone from both clubs in his own, and the Shots
 *  panel under them. `aside` is "prov." while the points are live (S10.10). */
export function MatchPlayerStats({ match: { home, away, men }, aside }: { match: MatchPageData; aside: ReactNode }) {
  const moved = men.filter((man) => man.side === null);
  return (
    <>
      <div className="grid items-start gap-2 lg:grid-cols-2">
        <ClubStats title={home.name} men={men.filter((man) => man.side === "home")} aside={aside} />
        <ClubStats title={away.name} men={men.filter((man) => man.side === "away")} aside={aside} />
        {moved.length > 0 && <ClubStats title={MOVED_TITLE} men={moved} aside={aside} />}
      </div>
      <Panel title={SHOTS_TITLE}>
        <div className="p-3">
          <Placeholder label={shotsNotHeldLabel} className="h-shot-map w-full justify-center" written />
        </div>
      </Panel>
    </>
  );
}

/** A club's men who played, or, before any record, the sheet's starters: an unused substitute has
 *  no stats to show (the approved picture lists only the men who played). */
function ClubStats({ title, men, aside }: { title: string; men: MatchMan[]; aside: ReactNode }) {
  const shown = men.filter((man) => man.started || man.played === true);
  return (
    <Panel title={title} aside={aside}>
      {shown.length === 0 ? (
        <PanelNote>{noMenWords}</PanelNote>
      ) : (
        <table aria-label={playerStatsLabel(title)} className="w-full border-collapse">
          <ColumnHeads columns={matchStatColumns} classOf={(column: Column) => cellClassOf(column === "player" || column === "position")} />
          <tbody>
            {shown.map((man) => (
              <tr key={man.playerCode} className={`border-t border-panel-rule ${man.mine ? "bg-row-lit" : ""}`}>
                <td className={cellClassOf(true)}>{man.position === null ? noFigureWords : <PositionCode position={man.position} />}</td>
                <th scope="row" className={`${cellClassOf(true)} font-semibold text-lead`}>
                  {man.name}
                </th>
                {STAT_COLUMNS.map((stat) => (
                  <td key={stat} className={cellClassOf(false)}>
                    {figureOrNone(man.statLine?.[stat] ?? null)}
                  </td>
                ))}
                <PointsCell man={man} />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** A man's points for the match, greyed while his team's lineup doesn't count them, as the matchup
 *  greys a bench man (spec/14); a free agent's show plainly: "people don't think grey means no
 *  teams" (Craig, 31 Oct 2026). The team sheets and Player stats both end on it. */
export function PointsCell({ man: { ownerTeamName, points, counts } }: { man: MatchMan }) {
  const greyed = !counts && ownerTeamName !== null;
  return (
    <td className={`px-2 text-right ${!greyed && points !== null ? "font-bold text-figure" : "text-muted"}`}>
      {figureOrNone(points)}
      {greyed && <span className="sr-only"> {notCountingLabel}</span>}
    </td>
  );
}
