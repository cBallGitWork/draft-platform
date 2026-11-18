import { ColumnHeads } from "../ui/ColumnHeads";
import { Panel, PanelNote } from "../ui/Panel";
import type { MatchPageData } from "./seam";
import { noFigureWords, noTeamStatsWords, possessionWords, STAT_COLUMN, TEAM_STATS_TITLE, teamStatRows, teamStatsLabel } from "./words";

// The match page's Team stats panel (spec/10 S10.6, S10.7), beside the lineups on Overview.

type SideStats = NonNullable<MatchPageData["teamStats"]>["home"];
type Club = MatchPageData["home"];
/** The team stats' heads and cells: home's figures read right, toward the stat between them, which
 *  takes half the width. */
const TEAM_STAT_CELLS = { home: "px-2 text-right", stat: "w-1/2 px-2 text-center", away: "px-2 text-left" } as const;

/** Each side's five, home's figure left of the stat and away's right, as a scoreboard reads. */
export function TeamStats({ home, away, stats }: { home: Club; away: Club; stats: MatchPageData["teamStats"] }) {
  return (
    <Panel title={TEAM_STATS_TITLE}>
      {stats === null ? (
        <PanelNote>{noTeamStatsWords}</PanelNote>
      ) : (
        <table aria-label={teamStatsLabel(home.shortName, away.shortName)} className="w-full table-fixed border-collapse">
          <ColumnHeads
            columns={{ home: { short: home.shortName, long: home.name }, stat: STAT_COLUMN, away: { short: away.shortName, long: away.name } }}
            unseen={["stat"]}
            classOf={(column) => TEAM_STAT_CELLS[column]}
          />
          <tbody>
            {(Object.keys(teamStatRows) as (keyof typeof teamStatRows)[]).map((stat) => (
              <tr key={stat} className="border-t border-panel-rule">
                <td className={`${TEAM_STAT_CELLS.home} font-bold`}>{statWords(stats.home, stat)}</td>
                <th scope="row" className={`${TEAM_STAT_CELLS.stat} font-normal text-muted`}>{teamStatRows[stat]}</th>
                <td className={`${TEAM_STAT_CELLS.away} font-bold`}>{statWords(stats.away, stat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function statWords(side: SideStats, stat: keyof SideStats): string {
  const value = side[stat];
  if (value === null) return noFigureWords;
  return stat === "possession" ? possessionWords(value) : String(value);
}
