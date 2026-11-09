import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { playerCardPath } from "../playerCard/paths";
import { ClubMark, ClubShort } from "../ui/ClubName";
import { ColumnHeads } from "../ui/ColumnHeads";
import { Loading, PAGE_STACK, PageSection, PanelNote } from "../ui/Panel";
import { PositionCodes } from "../ui/PositionCodes";
import type { MyTeamSeam, OtherSquad } from "./seam";
import { squadCellClass } from "./squad/SquadTable";
import { PointsCell } from "./SquadCells";
import { goneWords, otherSquadEmptyWords, otherSquadLoadingWords, squadColumns, squadTableLabel } from "./squad/words";

// Another team's squad, read-only, opened from its name as a player's owner on his card (Craig,
// 9 Nov 2026, #1027: "a read-only page of that team, its Squad table (players, positions, club,
// season points), with nothing changeable and no tactics shown"). The Squad tab's table
// (docs/design/approved/team-squad) with only those columns; each name opens his card.

type Column = "positions" | "player" | "season";
const COLUMNS: readonly Column[] = ["positions", "player", "season"];
const cellClasses = (column: Column) => squadCellClass(column !== "season");

export function OtherTeamPage({ league, teamId, seam }: { league: LeagueSummary; teamId: Id<"teams">; seam: MyTeamSeam }) {
  const squad = seam.useOtherSquad(league.leagueId, teamId);
  if (squad === undefined) return <Loading className="bg-panel px-3 py-2">{otherSquadLoadingWords}</Loading>;
  return (
    <div className={PAGE_STACK}>
      <PageSection title={squad.teamName} className="bg-panel">
        {squad.players.length === 0 ? <PanelNote>{otherSquadEmptyWords}</PanelNote> : <OtherSquadTable leagueId={league.leagueId} squad={squad} />}
      </PageSection>
    </div>
  );
}

function OtherSquadTable({ leagueId, squad }: { leagueId: Id<"leagues">; squad: OtherSquad }) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={squadTableLabel(squad.teamName)} className="w-full border-collapse">
        <ColumnHeads columns={squadColumns} shown={COLUMNS} classOf={cellClasses} />
        <tbody>
          {squad.players.map((player) => (
            <tr key={player.code} className="border-t border-panel-rule">
              <td className={`${cellClasses("positions")} whitespace-nowrap`}>
                <PositionCodes positions={player.positions} spaced />
              </td>
              <th scope="row" title={player.fullName} className={`${cellClasses("player")} whitespace-nowrap`}>
                <Link to={playerCardPath(leagueId, player.code)} className="inline-flex min-h-tap min-w-tap items-center text-lead font-semibold text-fact lg:min-h-0 lg:min-w-0">
                  {player.name}
                </Link>{" "}
                <span className="text-muted">
                  <ClubMark code={player.club.code} />
                  <ClubShort club={player.club} />
                </span>
                {player.gone && <span className="block font-normal text-event">{goneWords}</span>}
              </th>
              <PointsCell className={cellClasses("season")} points={player.seasonPoints} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
