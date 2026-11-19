import type { ReactNode } from "react";
import type { MatchStat } from "../../convex/match/matchStatLine";
import { ColumnHeads, cellClassOf } from "../ui/ColumnHeads";
import { Panel, PanelNote } from "../ui/Panel";
import { PositionCode } from "../ui/PositionCodes";
import type { MatchMan, MatchPageData } from "./seam";
import { Choice } from "../ui/Choice";
import {
  figureOrNone,
  matchStatColumns,
  MOVED_TITLE,
  noFigureWords,
  noMenWords,
  notCountingLabel,
  playerStatsLabel,
  statPointsWords,
  STAT_VIEWS,
  statViewLabel,
  statViewWords,
  type StatView,
} from "./words";

// The match page's Player stats tab (#2490, #2491; spec/10 S10.8; the approved pictures
// `1440-player-stats.png` and `1440-player-stats-points.png`): one table a club, each man who
// played's stats for the match, or with Points the points each earned him. His shot counts stand
// in for a shot map: Sportmonks sends no shot's position or xG ("Shot counts instead", Craig, 17 Nov 2026).

type Column = keyof typeof matchStatColumns;
const STAT_COLUMNS = Object.keys(matchStatColumns).filter((column) => column !== "position" && column !== "player" && column !== "points") as MatchStat[];

/** A two-way switch at the right of the tabs row: Stats | Points while Player stats is open, List |
 *  Pitch while Overview is (S10.8, S10.9). */
export function ViewSwitch<View extends string>({
  label,
  name,
  views,
  words,
  view,
  choose,
}: {
  label: string;
  name: string;
  views: readonly View[];
  words: Record<View, string>;
  view: View;
  choose: (view: View) => void;
}) {
  return (
    <span className="ml-auto flex items-center px-2">
      <Choice label={label} labelShown={false} name={name} options={views} words={words} chosen={view} onChoose={choose} />
    </span>
  );
}

/** The Stats | Points switch, while Player stats is open. */
export function StatViewSwitch({ view, choose }: { view: StatView; choose: (view: StatView) => void }) {
  return <ViewSwitch label={statViewLabel} name="match-stat-view" views={STAT_VIEWS} words={statViewWords} view={view} choose={choose} />;
}

/** Each club's table side by side, and any man since gone from both clubs in his own. `aside` is "prov." while the points are live (S10.10). */
export function MatchPlayerStats({ match: { home, away, men }, aside, view }: { match: MatchPageData; aside: ReactNode; view: StatView }) {
  const moved = men.filter((man) => man.side === null);
  return (
    <>
      <div className="grid items-start gap-2 lg:grid-cols-2">
        <ClubStats title={home.name} men={men.filter((man) => man.side === "home")} aside={aside} view={view} />
        <ClubStats title={away.name} men={men.filter((man) => man.side === "away")} aside={aside} view={view} />
        {moved.length > 0 && <ClubStats title={MOVED_TITLE} men={moved} aside={aside} view={view} />}
      </div>
    </>
  );
}

/** A club's men who played, or, before any record, the sheet's starters: an unused substitute has
 *  no stats to show (the approved picture lists only the men who played). With Points, each stat
 *  shows what it earned him, signed in the figure colour, and Pts stays the same. */
function ClubStats({ title, men, aside, view }: { title: string; men: MatchMan[]; aside: ReactNode; view: StatView }) {
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
                {STAT_COLUMNS.map((stat) =>
                  view === "stats" ? (
                    <td key={stat} className={cellClassOf(false)}>
                      {figureOrNone(man.statLine?.[stat] ?? null)}
                    </td>
                  ) : (
                    <StatPointsCell key={stat} points={man.statPoints?.[stat] ?? null} />
                  ),
                )}
                <PointsCell man={man} />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** What one stat earned him with Points: signed in the figure colour, the dash muted where it earned
 *  none or can't be told yet (the approved picture). */
function StatPointsCell({ points }: { points: number | null }) {
  const earned = points !== null && points !== 0;
  return <td className={`${cellClassOf(false)} ${earned ? "font-bold text-figure" : "text-muted"}`}>{statPointsWords(points)}</td>;
}

/** A man's points for the match, greyed while his team's lineup doesn't count them, as the matchup
 *  greys a bench man (spec/14); a free agent's show plainly: "people don't think grey means no
 *  teams" (Craig, 31 Oct 2026). The team sheets and Player stats both end on it, and a man's panel
 *  totals on it, `before` its "prov.". */
export function PointsCell({ man, before }: { man: MatchMan; before?: ReactNode }) {
  return (
    <td className={`px-2 text-right ${pointsInk(man)}`}>
      {before !== undefined && <span className="mr-1">{before}</span>}
      {figureOrNone(man.points)}
      {pointsGreyed(man) && <span className="sr-only"> {notCountingLabel}</span>}
    </td>
  );
}

/** Whether his team's lineup doesn't count his points; a man no team holds isn't greyed. */
export const pointsGreyed = ({ ownerTeamName, counts }: MatchMan) => !counts && ownerTeamName !== null;

/** His points' ink, on the sheets, Player stats and the pitch: the figure colour, muted while greyed
 *  or not told yet. */
export const pointsInk = (man: MatchMan) => (!pointsGreyed(man) && man.points !== null ? "font-bold text-figure" : "text-muted");
