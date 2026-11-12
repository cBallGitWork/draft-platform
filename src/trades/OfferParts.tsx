import type { ReactNode } from "react";
import { noFigureWords } from "../shared/words";
import type { TradedPlayer as Player } from "./seam";
import { TradedPlayer } from "./TradedPlayer";
import { nobodyWords } from "./words";

// The parts an offer's panel and the New offer tab's summing-up share (docs/design/approved/trades).

/** One side of the trade: its label, then each player on his own line with his club's mark, or
 *  its pick, or nobody. */
export function OfferSide({
  label,
  players,
  pick = null,
}: {
  label: string;
  players: readonly Player[];
  pick?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-panel-rule px-3 py-2">
      <span className="text-soft">{label}</span>
      {pick !== null ? (
        <span className="font-semibold">{pick}</span>
      ) : players.length === 0 ? (
        <span className="text-muted">{nobodyWords}</span>
      ) : (
        players.map((player) => (
          <TradedPlayer key={player.code} player={player} withMark />
        ))
      )}
    </div>
  );
}

/** A label and its value in a `grid-cols-facts` list, ruled off from the next; `derived` for a
 *  time worked out. */
export function Fact({
  label,
  derived = false,
  children,
}: {
  label: string;
  derived?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="border-b border-panel-rule px-3 py-1 text-soft">
        {label}
      </dt>
      <dd
        className={`border-b border-panel-rule px-3 py-1${derived ? " text-derived" : ""}`}
      >
        {children}
      </dd>
    </>
  );
}

/** A time not known, such as when an offer with no deadline left closes: a greyed dash in its
 *  place (plate.md, Marks: A placeholder). */
export const noTimeYet = <span className="text-muted">{noFigureWords}</span>;
