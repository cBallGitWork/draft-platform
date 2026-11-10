import type { Id } from "../../../convex/_generated/dataModel";
import { ColumnHeads } from "../../ui/ColumnHeads";
import { byRun, clashOf } from "./claimGroups";
import { Chip, claimCellClass, DropCell, GROUP_ROW, PlayerName } from "./ClaimCells";
import type { PendingClaim, WaiversView } from "./seam";
import { claimColumns, everyTeamTableLabel, noRunWords, runShort, teamGroupWords } from "./words";

// The commissioner's Every team view of the pending claims (#1200; 1440-commissioner.png): each
// team with claims, in the waiver order, its claims by run and ranked in each, read-only (Craig,
// 8 Nov 2026: "4 no").

const COLUMNS = ["rank", "positions", "claim", "run", "drop"] as const;

export function EveryTeamTable({ claims, waivers }: { claims: readonly PendingClaim[]; waivers: WaiversView | undefined }) {
  const order = waivers?.teams.map(({ teamId }) => teamId) ?? [];
  const placeOf = (teamId: Id<"teams">) => {
    const at = order.indexOf(teamId);
    return at === -1 ? null : at + 1;
  };
  const teams = [...new Set(claims.map(({ teamId }) => teamId))].sort((one, other) => (placeOf(one) ?? Infinity) - (placeOf(other) ?? Infinity));
  return (
    <table aria-label={everyTeamTableLabel} className="w-full border-collapse">
      <ColumnHeads columns={claimColumns} shown={COLUMNS} classOf={claimCellClass} />
      {teams.map((teamId) => {
        const theirs = claims.filter((claim) => claim.teamId === teamId);
        return (
          <tbody key={teamId}>
            <tr className={GROUP_ROW}>
              <th scope="rowgroup" colSpan={COLUMNS.length} className="px-3 py-1 text-left">
                <span className="font-semibold text-lead">{theirs[0].teamName}</span> <span className="text-soft">{teamGroupWords(placeOf(teamId), theirs.length)}</span>
              </th>
            </tr>
            {byRun(theirs).flatMap((group) =>
              group.claims.map((claim, index) => (
                <tr key={claim.claimId} className="border-t border-panel-rule">
                  <td className={claimCellClass("rank")}>{index + 1}</td>
                  <td className={claimCellClass("positions")}>
                    <Chip player={claim.claim} />
                  </td>
                  <th scope="row" className={claimCellClass("claim")}>
                    <PlayerName player={claim.claim} />
                  </th>
                  <td className={claimCellClass("run")}>{claim.runAt === null ? noRunWords : runShort(claim.runAt)}</td>
                  <td className={claimCellClass("drop")}>
                    <DropCell drop={claim.drop} clash={clashOf(group, index)} />
                  </td>
                </tr>
              )),
            )}
          </tbody>
        );
      })}
    </table>
  );
}
