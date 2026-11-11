import { Fragment, type ReactNode } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { OFFER_GROUPS, type OfferSides } from "./offerSides";
import type { ScreenOffer, TradeToReview } from "./seam";
import { TradedSide } from "./TradedPlayer";
import {
  afterLastMatchWords,
  betweenWords,
  groupWords,
  offersColumns,
  offersTableLabel,
  reviewerWords,
  teamGetsWords,
  toReviewWords,
  whenWords,
  youWords,
} from "./words";

// The Offers tab's table (#383; docs/design/approved/trades): the trades the manager reviews To
// review first (Craig, 10 Nov 2026), then his offers To you, From you and In review. Split from
// OffersPage.tsx.

type Column = keyof typeof offersColumns;
const COLUMNS = Object.keys(offersColumns) as Column[];
const CELL = cellClassOf(true);
export type Row = { offer: ScreenOffer; sides: OfferSides };
type Select = (offerId: Id<"tradeOffers">) => void;

export function OffersTable({
  reviews,
  rows,
  selected,
  select,
}: {
  reviews: readonly TradeToReview[];
  rows: readonly Row[];
  selected: Id<"tradeOffers"> | null;
  select: Select;
}) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={offersTableLabel} className="w-full border-collapse">
        <ColumnHeads
          columns={offersColumns}
          shown={COLUMNS}
          classOf={() => CELL}
        />
        <tbody>
          {reviews.length > 0 && (
            <>
              <GroupHead>{toReviewWords}</GroupHead>
              {reviews.map((trade) => (
                <ReviewRow
                  key={trade.offerId}
                  trade={trade}
                  selected={trade.offerId === selected}
                  select={select}
                />
              ))}
            </>
          )}
          {OFFER_GROUPS.map((group) => {
            const inGroup = rows.filter((row) => row.sides.group === group);
            if (inGroup.length === 0) return null;
            return (
              <Fragment key={group}>
                <GroupHead>{groupWords[group]}</GroupHead>
                {inGroup.map((row) => (
                  <OfferRow
                    key={row.offer.offerId}
                    row={row}
                    selected={row.offer.offerId === selected}
                    select={select}
                  />
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GroupHead({ children }: { children: string }) {
  return (
    <tr className="border-t border-panel-rule">
      <th
        scope="colgroup"
        colSpan={COLUMNS.length}
        className={`${CELL} h-row font-bold`}
      >
        {children}
      </th>
    </tr>
  );
}

/** A row: its first cell names what it is with and selects it; the selected one is edged. */
function OffersRow({
  offerId,
  name,
  selected,
  select,
  children,
}: {
  offerId: Id<"tradeOffers">;
  name: string;
  selected: boolean;
  select: Select;
  children: ReactNode;
}) {
  return (
    <tr
      className={`h-row border-t border-panel-rule${selected ? " bg-name-plate shadow-current-edge" : ""}`}
    >
      <th scope="row" className={CELL}>
        <button
          type="button"
          aria-current={selected ? "true" : undefined}
          onClick={() => select(offerId)}
          className="min-h-tap min-w-tap font-semibold text-align-inherit lg:min-h-0 lg:min-w-0"
        >
          {name}
        </button>
      </th>
      {children}
    </tr>
  );
}

/** A trade the manager reviews: the two teams, each side read as what that team gets, waiting on
 *  him until the review ends. */
function ReviewRow({
  trade,
  selected,
  select,
}: {
  trade: TradeToReview;
  selected: boolean;
  select: Select;
}) {
  return (
    <OffersRow
      offerId={trade.offerId}
      name={betweenWords(trade.fromTeamName, trade.toTeamName)}
      selected={selected}
      select={select}
    >
      <td className={CELL}>
        <span className="inline-flex items-center gap-2">
          <span className="text-soft">{teamGetsWords(trade.fromTeamName)}</span>
          <TradedSide players={trade.gets} pick={trade.picks?.gets ?? null} />
        </span>
      </td>
      <td className={CELL}>
        <span className="inline-flex items-center gap-2">
          <span className="text-soft">{teamGetsWords(trade.toTeamName)}</span>
          <TradedSide players={trade.gives} pick={trade.picks?.gives ?? null} />
        </span>
      </td>
      <td className={CELL}>{youWords}</td>
      <td className={`${CELL} text-derived`}>
        {whenWords(trade.reviewEndsAt)}
      </td>
    </OffersRow>
  );
}

function OfferRow({
  row: { offer, sides },
  selected,
  select,
}: {
  row: Row;
  selected: boolean;
  select: Select;
}) {
  const waitingOn =
    sides.group === "toYou"
      ? youWords
      : sides.group === "fromYou"
        ? sides.otherTeamName
        : offer.reviewer === null
          ? null
          : reviewerWords[offer.reviewer];
  const closes =
    offer.reviewEndsAt !== null
      ? whenWords(offer.reviewEndsAt)
      : offer.closes === null
        ? null
        : offer.closes.at === null
          ? afterLastMatchWords(offer.closes.gameweek)
          : whenWords(offer.closes.at);
  return (
    <OffersRow
      offerId={offer.offerId}
      name={sides.otherTeamName}
      selected={selected}
      select={select}
    >
      <td className={CELL}>
        <TradedSide players={sides.youGet} pick={sides.pickYouGet} />
      </td>
      <td className={CELL}>
        <TradedSide players={sides.youGive} pick={sides.pickYouGive} />
      </td>
      <td className={CELL}>{waitingOn}</td>
      <td className={`${CELL} text-derived`}>
        {closes}
      </td>
    </OffersRow>
  );
}
