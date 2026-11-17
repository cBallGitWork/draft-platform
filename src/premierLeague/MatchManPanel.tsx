import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MATCH_STAT_KEYS, type MatchStat } from "../../convex/match/matchStatLine";
import { playerCardPath } from "../playerCard/paths";
import { ClubMark } from "../ui/ClubName";
import { ColumnHeads, cellClassOf } from "../ui/ColumnHeads";
import { OwnerName } from "../ui/OwnerName";
import { Panel } from "../ui/Panel";
import { PositionCode } from "../ui/PositionCodes";
import { MatchMarks } from "./MatchMarks";
import { PointsCell } from "./MatchPlayerStats";
import type { MatchMan } from "./seam";
import { figureOrNone, manPanelColumns, manPanelLabel, manPanelWords, matchStatColumns, statPointsWords } from "./words";

// A man's panel on the match page (#2493; spec/10 S10.9: "a player's panel opens on the right when
// he's clicked (this match's breakdown, then his card)"; the approved picture's Saka panel): at the
// top of Overview's right column, his crest, name, position and marks, the team his points are for,
// then a row for each stat he has a count or points in, with its points, his total, and His card.
// The breakdown is the match's own stat line and its points (the Player stats tab's), so it never
// disagrees with the sheets' Pts.

const STATS = Object.keys(MATCH_STAT_KEYS) as MatchStat[];
const isLeft = (column: keyof typeof manPanelColumns) => column === "stat";

/** `clubCode` is the club he played the match for; null when it is neither side. `prov` is "prov."
 *  while the points are live (S10.10). */
export function MatchManPanel({ man, clubCode, leagueId, prov }: { man: MatchMan; clubCode: number | null; leagueId: string; prov: ReactNode }) {
  const { name, position, marks, ownerTeamName, statLine, statPoints } = man;
  const shown = STATS.filter((stat) => (statLine?.[stat] ?? 0) !== 0 || (statPoints?.[stat] ?? 0) !== 0);
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {clubCode !== null && <ClubMark code={clubCode} />}
          {name}
          {position !== null && <PositionCode position={position} />}
          <MatchMarks marks={marks} />
        </span>
      }
      aside={
        <span className="font-bold text-fact">
          <OwnerName teamName={ownerTeamName} />
        </span>
      }
    >
      <table aria-label={manPanelLabel(name)} className="w-full border-collapse">
        <ColumnHeads columns={manPanelColumns} classOf={(column) => cellClassOf(isLeft(column))} />
        <tbody>
          {shown.map((stat) => (
            <tr key={stat} className="border-t border-panel-rule">
              <th scope="row" className={`${cellClassOf(true)} font-normal`}>
                {matchStatColumns[stat].long}
              </th>
              <td className={cellClassOf(false)}>{figureOrNone(statLine?.[stat] ?? null)}</td>
              <td className={`${cellClassOf(false)} font-bold text-figure`}>{statPointsWords(statPoints?.[stat] ?? null)}</td>
            </tr>
          ))}
          <tr className="border-t border-panel-rule">
            <th scope="row" colSpan={2} className={`${cellClassOf(true)} font-bold`}>
              {manPanelWords.total}
            </th>
            <PointsCell man={man} before={prov} />
          </tr>
        </tbody>
      </table>
      <div className="px-3 py-2">
        <Link to={playerCardPath(leagueId, man.playerCode)} className="action">
          {manPanelWords.hisCard}
        </Link>
      </div>
    </Panel>
  );
}
