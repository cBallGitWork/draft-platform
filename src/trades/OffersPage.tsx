import { Fragment, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { Loading, Notice, PageSection, Panel, PanelNote } from "../ui/Panel";
import { OfferPanel } from "./OfferPanel";
import { OFFER_GROUPS, sidesOf, type OfferSides } from "./offerSides";
import type { ScreenOffer, TradesSeam, TradesView } from "./seam";
import { TradedSide } from "./TradedPlayer";
import {
  groupWords,
  noOffersWords,
  noTeamWords,
  offersColumns,
  offersTableLabel,
  OFFERS_TITLE,
  openCountWords,
  reviewerWords,
  shutWords,
  TRADES_TITLE,
  tradesLoadingWords,
  whenWords,
  youWords,
} from "./words";

type Column = keyof typeof offersColumns;
const COLUMNS = Object.keys(offersColumns) as Column[];
const CELL = cellClassOf(true);
type Row = { offer: ScreenOffer; sides: OfferSides };

/** Trades' Offers tab (#383; docs/design/approved/trades): the manager's offers grouped To you,
 *  From you and In review, and the selected one's panel on the right. */
export function OffersPage({
  league,
  seam,
}: {
  league: LeagueSummary;
  seam: TradesSeam;
}) {
  if (league.teamName === null) {
    return (
      <PageSection title={TRADES_TITLE} className="max-w-4xl bg-panel">
        <PanelNote>{noTeamWords}</PanelNote>
      </PageSection>
    );
  }
  return <Offers leagueId={league.leagueId} seam={seam} />;
}

function Offers({
  leagueId,
  seam,
}: {
  leagueId: Id<"leagues">;
  seam: TradesSeam;
}) {
  const view = seam.useTrades(leagueId);
  const changes = seam.useTradeChanges();
  const [chosen, choose] = useState<Id<"tradeOffers"> | null>(null);
  if (view === undefined) {
    return (
      <PageSection title={TRADES_TITLE} className="max-w-4xl bg-panel">
        <Loading className="px-3 py-2">{tradesLoadingWords}</Loading>
      </PageSection>
    );
  }
  const rows = view.offers.map((offer) => ({
    offer,
    sides: sidesOf(offer, view.myTeamId),
  }));
  const ordered = OFFER_GROUPS.flatMap((group) =>
    rows.filter((row) => row.sides.group === group),
  );
  const selected =
    ordered.find((row) => row.offer.offerId === chosen) ?? ordered[0] ?? null;
  return (
    <PageSection title={TRADES_TITLE} className="flex flex-col gap-2">
      {view.shut !== null && <Notice>{shutWords[view.shut]}</Notice>}
      <div className="grid items-start gap-2 lg:grid-cols-news">
        <Panel
          title={OFFERS_TITLE}
          aside={
            <span className="text-soft">{openCountWords(rows.length)}</span>
          }
        >
          {rows.length === 0 ? (
            <PanelNote>{noOffersWords}</PanelNote>
          ) : (
            <OffersTable
              rows={ordered}
              selected={selected?.offer.offerId ?? null}
              select={choose}
            />
          )}
        </Panel>
        {selected !== null && (
          <OfferPanel
            key={selected.offer.offerId}
            leagueId={leagueId}
            offer={selected.offer}
            sides={selected.sides}
            squadCount={myTeamOf(view).players.length}
            squadMaximum={view.squadMaximum}
            open={view.shut === null}
            changes={changes}
          />
        )}
      </div>
    </PageSection>
  );
}

/** The manager's own team: the read puts it first. */
const myTeamOf = (view: TradesView) => view.teams[0];

function OffersTable({
  rows,
  selected,
  select,
}: {
  rows: readonly Row[];
  selected: Id<"tradeOffers"> | null;
  select: (offerId: Id<"tradeOffers">) => void;
}) {
  return (
    <table aria-label={offersTableLabel} className="w-full border-collapse">
      <ColumnHeads
        columns={offersColumns}
        shown={COLUMNS}
        classOf={() => CELL}
      />
      <tbody>
        {OFFER_GROUPS.map((group) => {
          const inGroup = rows.filter((row) => row.sides.group === group);
          if (inGroup.length === 0) return null;
          return (
            <Fragment key={group}>
              <tr className="border-t border-panel-rule">
                <th
                  scope="colgroup"
                  colSpan={COLUMNS.length}
                  className={`${CELL} h-row font-bold`}
                >
                  {groupWords[group]}
                </th>
              </tr>
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
  );
}

function OfferRow({
  row: { offer, sides },
  selected,
  select,
}: {
  row: Row;
  selected: boolean;
  select: (offerId: Id<"tradeOffers">) => void;
}) {
  const waitingOn =
    sides.group === "toYou"
      ? youWords
      : sides.group === "fromYou"
        ? sides.otherTeamName
        : offer.reviewer === null
          ? null
          : reviewerWords[offer.reviewer];
  const closes = offer.reviewEndsAt ?? offer.closes?.at ?? null;
  return (
    <tr
      className={`h-row border-t border-panel-rule${selected ? " bg-name-plate shadow-current-edge" : ""}`}
    >
      <th scope="row" className={CELL}>
        <button
          type="button"
          aria-current={selected ? "true" : undefined}
          onClick={() => select(offer.offerId)}
          className="min-h-tap font-semibold text-align-inherit lg:min-h-0"
        >
          {sides.otherTeamName}
        </button>
      </th>
      <td className={CELL}>
        <TradedSide players={sides.youGet} pick={sides.pickYouGet} />
      </td>
      <td className={CELL}>
        <TradedSide players={sides.youGive} pick={sides.pickYouGive} />
      </td>
      <td className={CELL}>{waitingOn}</td>
      <td className={`${CELL} text-derived`}>
        {closes === null ? null : whenWords(closes)}
      </td>
    </tr>
  );
}
