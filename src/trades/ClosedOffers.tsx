import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { Panel, PanelNote } from "../ui/Panel";
import { tradeSidesOf } from "./offerSides";
import type { ClosedOffer } from "./seam";
import { TradedSide } from "./TradedPlayer";
import {
  CLOSED_TITLE,
  closedColumns,
  closedTableLabel,
  closedWhyWords,
  dayWords,
  noClosedWords,
  olderWords,
  thisSeasonWords,
} from "./words";

// Trades' Closed offers panel (#383; docs/design/approved/trades): the manager's offers that ended
// this season without going through, newest first, with why and when; Older shows the rest.

type Column = keyof typeof closedColumns;
const COLUMNS = Object.keys(closedColumns) as Column[];
const CELL = cellClassOf(true);
/** How many show before Older: Claude's call, the picture drawing three. */
export const CLOSED_FIRST = 5;

/** Whether the manager's own team is the one that closed it: a rejection or a counter is the other
 *  team's answer, a withdrawal the offering team's. */
const youActed = (offer: ClosedOffer, myTeamId: Id<"teams">) =>
  offer.why === "withdrawn" ? offer.fromTeamId === myTeamId : offer.toTeamId === myTeamId;

export function ClosedOffers({
  closed,
  myTeamId,
}: {
  closed: readonly ClosedOffer[];
  myTeamId: Id<"teams">;
}) {
  const [older, showOlder] = useState(false);
  const shown = older ? closed : closed.slice(0, CLOSED_FIRST);
  return (
    <Panel title={CLOSED_TITLE} aside={<span className="text-soft">{thisSeasonWords}</span>}>
      {closed.length === 0 ? (
        <PanelNote>{noClosedWords}</PanelNote>
      ) : (
        <div className="overflow-x-auto">
          <table aria-label={closedTableLabel} className="w-full border-collapse">
            <ColumnHeads columns={closedColumns} shown={COLUMNS} classOf={() => CELL} />
            <tbody>
              {shown.map((offer) => {
                const sides = tradeSidesOf(offer, myTeamId);
                return (
                  <tr key={offer.closedId} className="h-row border-t border-panel-rule">
                    <th scope="row" className={`${CELL} font-semibold`}>
                      {sides.otherTeamName}
                    </th>
                    <td className={CELL}>
                      <TradedSide players={sides.youGet} pick={sides.pickYouGet} />
                    </td>
                    <td className={CELL}>
                      <TradedSide players={sides.youGive} pick={sides.pickYouGive} />
                    </td>
                    <td className={CELL}>{closedWhyWords(offer.why, youActed(offer, myTeamId))}</td>
                    <td className={CELL}>{dayWords(offer.closedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!older && closed.length > CLOSED_FIRST && (
        <button
          type="button"
          onClick={() => showOlder(true)}
          className="min-h-tap px-3 py-2 text-align-inherit lg:min-h-0"
        >
          {olderWords}
        </button>
      )}
    </Panel>
  );
}
