import { Link } from "@tanstack/react-router";
import { useId } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { playerCardPath } from "../../playerCard/paths";
import type { Changing } from "../../shared/useChange";
import { Panel, Problem } from "../../ui/Panel";
import { Chip, PlayerName } from "./ClaimCells";
import type { PendingClaim } from "./seam";
import { claimPanelTitle, clashWords, dropLabel, dropNobodyWords, firstRunWords, moveDownWords, moveUpWords, playerCardWords, runLabel, withdrawWords } from "./words";

// The selected claim's panel (#1200; the waivers picture: "Wed run, claim 2: Eze"), at the top of
// the Transactions tab's right-hand column: the run; a clash in orange, where an earlier claim in
// the run drops the same player; the Drop picker, a change keeping the claim's rank (Craig, 6 Nov
// 2026); Move up, Move down and Withdraw; and his player card. While claims are closed the Drop
// picker is shut; Move and Withdraw stay in the lock, going only before the draft is over (Craig,
// 11 Nov 2026, on #1590).

/** A player the Drop picker offers: one of the manager's squad. */
export type SquadPlayer = { code: number; name: string };

export function ClaimPanel({
  leagueId,
  claim,
  rank,
  clash,
  squad,
  open,
  canRank,
  change,
  canMove,
  onMove,
  onWithdraw,
  onChangeDrop,
}: {
  leagueId: Id<"leagues">;
  claim: PendingClaim;
  /** Its rank in its run. */
  rank: number;
  /** The earlier claim in its run dropping the same player: its rank. */
  clash: number | null;
  squad: readonly SquadPlayer[];
  /** A change of drop can be made: not while claims are closed. */
  open: boolean;
  /** Move and Withdraw can be used: in the lock too, never before the draft is over. */
  canRank: boolean;
  change: Changing;
  canMove: { up: boolean; down: boolean };
  onMove(step: -1 | 1): void;
  onWithdraw(): void;
  onChangeDrop(dropCode: number | null): void;
}) {
  const dropId = useId();
  // The drop he names is offered even if he has left the squad since, so the picker shows it.
  const offered = claim.drop === null || squad.some(({ code }) => code === claim.drop?.playerCode) ? squad : [...squad, { code: claim.drop.playerCode, name: claim.drop.playerName }];
  return (
    <Panel title={claimPanelTitle(claim.run, rank, claim.claim.playerName)}>
      <div className="flex flex-col gap-2 p-3">
        <p className="flex items-center gap-2">
          <Chip player={claim.claim} />
          <PlayerName player={claim.claim} />
        </p>
        <p className="flex gap-3">
          <span className="w-24 text-soft">{runLabel}</span>
          <span>{firstRunWords(claim.run)}</span>
        </p>
        {clash !== null && claim.drop !== null && <p className="text-event">{clashWords(clash, claim.drop.playerName)}</p>}
        <Problem problem={change.problem} />
        <p className="flex items-center gap-3">
          <label htmlFor={dropId} className="w-24 text-soft">
            {dropLabel}
          </label>
          <select
            id={dropId}
            className="text-box"
            disabled={!open || change.busy}
            value={claim.drop?.playerCode ?? ""}
            onChange={(event) => onChangeDrop(event.target.value === "" ? null : Number(event.target.value))}
          >
            <option value="">{dropNobodyWords}</option>
            {offered.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </p>
        {canRank && (
          <p className="flex flex-wrap gap-2">
            <button type="button" className="secondary-action" disabled={change.busy || !canMove.up} onClick={() => onMove(-1)}>
              {moveUpWords}
            </button>
            <button type="button" className="secondary-action" disabled={change.busy || !canMove.down} onClick={() => onMove(1)}>
              {moveDownWords}
            </button>
            <button type="button" className="secondary-action" disabled={change.busy} onClick={onWithdraw}>
              {withdrawWords}
            </button>
          </p>
        )}
        <p className="text-right">
          <Link to={playerCardPath(leagueId, claim.claim.playerCode)}>{playerCardWords}</Link>
        </p>
      </div>
    </Panel>
  );
}
