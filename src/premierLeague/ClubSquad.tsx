import { Link, useNavigate } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { playerCardPath } from "../playerCard/paths";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { OwnerName } from "../ui/OwnerName";
import { Loading, Panel, PanelNote } from "../ui/Panel";
import { Placeholder } from "../ui/Placeholder";
import { PositionChip } from "../ui/PositionChip";
import type { ClubSquad, SquadPlayer } from "./seam";
import {
  clubTabWords,
  didNotPlayWords,
  figureWords,
  loadingSquadWords,
  noFigureWords,
  noSeasonPointsWords,
  noSquadWords,
  openCardLabel,
  squadColumns,
  statusNotSettledLabel,
  topScorersHead,
  waiversWords,
} from "./words";

// A club page's Squad tab and its header's top scorers (#1937; spec/18 `S18.7`, `S18.8`), in the
// league's own numbers (scouting/clubSquad:ofClub). A row opens his player card, where claims and
// pick-ups live: the page has no buttons of its own.

/** A figure, or a muted "—" saying why on hover. */
function FigureCell({ value, why, className }: { value: number | null; why: string; className: string }) {
  return value === null ? (
    <td title={why} className={`${className} text-muted`}>
      {noFigureWords}
    </td>
  ) : (
    <td className={`${className} font-bold text-figure`}>{figureWords(value)}</td>
  );
}

const LEFT_COLUMNS: readonly string[] = ["positions", "player", "owner"];
const cellClasses = (column: string) => cellClassOf(LEFT_COLUMNS.includes(column));

/** The Squad tab: every current player, grouped GK, DEF, MID, AM, FWD with no position last, as
 *  convex/scouting/clubSquad.ts sorts them, the position chips marking the groups with no band rows
 *  (plate.md: "the coloured chips do that work"); each with his doubt chip's place, who holds him,
 *  his season points, his points in each of the last five finished gameweeks, his starts and his
 *  minutes. */
export function SquadTab({ leagueId, squad }: { leagueId: Id<"leagues">; squad: ClubSquad | null | undefined }) {
  const navigate = useNavigate();
  if (squad === undefined || squad === null || squad.players.length === 0) {
    return (
      <Panel title={clubTabWords.squad}>
        {squad === undefined ? <Loading className="px-3 py-2">{loadingSquadWords}</Loading> : <PanelNote>{noSquadWords}</PanelNote>}
      </Panel>
    );
  }
  return (
    <Panel title={clubTabWords.squad}>
      <table className="w-full border-collapse">
        <ColumnHeads columns={squadColumns(squad.gameweeks, squad.pointsSeason)} classOf={cellClasses} />
        <tbody>
          {squad.players.map((player) => (
            <SquadRow key={player.code} leagueId={leagueId} player={player} squad={squad} open={() => void navigate({ to: playerCardPath(leagueId, player.code) })} />
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function SquadRow({ leagueId, player, squad, open }: { leagueId: Id<"leagues">; player: SquadPlayer; squad: ClubSquad; open: () => void }) {
  return (
    <tr onClick={open} className="cursor-pointer border-t border-panel-rule lg:h-row">
      <td className={cellClasses("positions")}>
        {player.positions.length === 0 ? (
          <span className="text-muted">{noFigureWords}</span>
        ) : (
          <span className="flex gap-1">
            {player.positions.map((position) => (
              <PositionChip key={position} label={position} />
            ))}
          </span>
        )}
      </td>
      <th scope="row" title={player.fullName} className={`${cellClasses("player")} font-normal`}>
        <span className="flex items-center gap-2">
          <Link
            to={playerCardPath(leagueId, player.code)}
            aria-label={openCardLabel(player.name)}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex min-h-tap min-w-tap items-center font-semibold text-lead lg:min-h-0 lg:min-w-0"
          >
            {player.name}
          </Link>
          {player.chanceOfPlaying !== null && <Placeholder label={statusNotSettledLabel} className="size-3" />}
        </span>
      </th>
      <td className={cellClasses("owner")}>{player.onWaivers ? waiversWords : <OwnerName teamName={player.ownerTeamName} />}</td>
      <FigureCell value={player.seasonPoints} why={noSeasonPointsWords(squad.pointsSeason)} className={cellClasses("points")} />
      {squad.gameweeks.map((gameweek, index) => (
        <FigureCell key={gameweek} value={player.lastGameweeks[index]} why={didNotPlayWords(gameweek)} className={cellClasses(`gw${gameweek}`)} />
      ))}
      <td className={cellClasses("starts")}>{figureWords(player.starts)}</td>
      <td className={cellClasses("minutes")}>{figureWords(player.minutes)}</td>
    </tr>
  );
}

/** The header's top scorers (`S18.7`): up to three, most season points first, each opening his
 *  player card; nothing while the squad loads, and "—" for a club with none. */
export function TopScorers({ leagueId, squad }: { leagueId: Id<"leagues">; squad: ClubSquad | null | undefined }) {
  if (squad === undefined) return null;
  return (
    <>
      <dt className="text-muted">{topScorersHead}</dt>
      <dd>
        {squad === null || squad.topScorers.length === 0 ? (
          <span className="text-muted">{noFigureWords}</span>
        ) : (
          <ol className="flex flex-wrap gap-x-4">
            {squad.topScorers.map((scorer) => (
              <li key={scorer.code}>
                <Link to={playerCardPath(leagueId, scorer.code)} className="inline-flex min-h-tap items-center font-semibold lg:min-h-0">
                  {scorer.name}
                </Link>{" "}
                <span className="font-bold text-figure">{figureWords(scorer.seasonPoints)}</span>
              </li>
            ))}
          </ol>
        )}
      </dd>
    </>
  );
}
