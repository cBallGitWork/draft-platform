import { ClubShort } from "../../ui/ClubName";
import { cellClassOf } from "../../ui/ColumnHeads";
import { PositionChip } from "../../ui/PositionChip";
import type { PendingClaim } from "./seam";
import { failsIfWords, freePlaceWords } from "./words";

// The cells both claims tables share (#1200): a player's chip and name, and who a claim drops.

type Player = PendingClaim["claim"];

const LEFT: readonly string[] = ["handle", "rank", "positions", "claim", "run", "drop", "in", "out"];
/** Columns the phone leaves out, so a row fits its width; the player card holds both. */
const DESK_ONLY: readonly string[] = ["positions", "points"];
/** A claims table's cell classes, a head lining up with the cells under it. */
export const claimCellClass = (column: string) => cellClassOf(LEFT.includes(column), DESK_ONLY.includes(column));
/** A group's row: a run's, or a team's under Every team. */
export const GROUP_ROW = "border-t border-panel-rule bg-name-plate";

/** A player as a row names him: his name and his club. */
export function PlayerName({ player }: { player: Player }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="font-semibold text-lead">{player.playerName}</span>
      <ClubShort club={player.club} className="text-soft" />
    </span>
  );
}

/** His first position's chip, or nothing before any feed names one. */
export function Chip({ player }: { player: Player }) {
  const position = player.positions[0];
  return position === undefined ? null : <PositionChip label={position} />;
}

/** Who goes if the claim succeeds, or a free place, and whether an earlier claim in its run drops
 *  him too, so this one fails if that one wins. */
export function DropCell({ drop, clash }: { drop: Player | null; clash: number | null }) {
  if (drop === null) return <span className="text-soft">{freePlaceWords}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Chip player={drop} />
      <PlayerName player={drop} />
      {clash !== null && <FailsChip clash={clash} />}
    </span>
  );
}

/** "Fails if claim 1 wins": an earlier claim in the run drops the same player. */
export function FailsChip({ clash }: { clash: number }) {
  return <span className="bg-event px-1 text-ground">{failsIfWords(clash)}</span>;
}
