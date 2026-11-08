import { ClubMark, ClubShort } from "../ui/ClubName";
import { PositionChip } from "../ui/PositionChip";
import type { TradedPlayer as Player } from "./seam";
import { nobodyWords } from "./words";

// A player in a trade as Trades shows him: his position and club only, no points (the approved
// picture's "1 pos club").

/** His position's chip, his name and his club. `withMark` adds the club's mark, as a panel and a
 *  squad list draw it; a table's row keeps to the three letters. */
export function TradedPlayer({
  player,
  withMark = false,
  dimmed = false,
}: {
  player: Player;
  withMark?: boolean;
  dimmed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {player.position === null ? null : (
        <PositionChip label={player.position} dimmed={dimmed} />
      )}
      <span className="font-semibold">{player.name}</span>
      <span className="inline-flex items-center text-soft">
        {withMark && <ClubMark code={player.club.code} />}
        <ClubShort club={player.club} />
      </span>
    </span>
  );
}

/** One side of a trade in a row: its players one after another, or its pick, or nobody. */
export function TradedSide({
  players,
  pick,
}: {
  players: readonly Player[];
  pick: string | null;
}) {
  if (pick !== null) return <>{pick}</>;
  if (players.length === 0)
    return <span className="text-muted">{nobodyWords}</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-3">
      {players.map((player) => (
        <TradedPlayer key={player.code} player={player} />
      ))}
    </span>
  );
}
