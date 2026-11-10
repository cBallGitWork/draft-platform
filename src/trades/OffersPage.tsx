import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { Loading, Notice, PageSection, Panel, PanelNote } from "../ui/Panel";
import { ClosedOffers } from "./ClosedOffers";
import { OfferPanel } from "./OfferPanel";
import { OFFER_GROUPS, sidesOf } from "./offerSides";
import { OffersTable } from "./OffersTable";
import { ReviewPanel } from "./ReviewPanel";
import type {
  TradeChanges,
  TradesSeam,
  TradesView,
  TradeToReview,
} from "./seam";
import {
  noOffersWords,
  noTeamWords,
  OFFERS_TITLE,
  openCountWords,
  shutWords,
  TRADES_TITLE,
  tradesLoadingWords,
} from "./words";

/** Trades' Offers tab (#383; docs/design/approved/trades): the trades the manager reviews To
 *  review at the top (Craig, 10 Nov 2026), then his offers grouped To you, From you and In review,
 *  and the selected one's panel on the right. `asked` opens with that one selected, as a Mail
 *  letter's link names it. A commissioner with no team sees only the trades he reviews. */
export function OffersPage({
  league,
  seam,
  asked,
}: {
  league: LeagueSummary;
  seam: TradesSeam;
  asked?: Id<"tradeOffers">;
}) {
  const Page = league.teamName === null ? ReviewsOnly : Offers;
  return <Page leagueId={league.leagueId} seam={seam} asked={asked} />;
}

type PageProps = {
  leagueId: Id<"leagues">;
  seam: TradesSeam;
  asked?: Id<"tradeOffers">;
};

function Offers({ leagueId, seam, asked }: PageProps) {
  const view = seam.useTrades(leagueId);
  const reviews = seam.useReviews(leagueId);
  const changes = seam.useTradeChanges();
  if (view === undefined || reviews === undefined) return <StillLoading />;
  return (
    <OffersBody
      leagueId={leagueId}
      view={view}
      reviews={reviews}
      changes={changes}
      asked={asked}
    />
  );
}

/** A commissioner with no team of his own: the trades he reviews, if any. */
function ReviewsOnly({ leagueId, seam, asked }: PageProps) {
  const reviews = seam.useReviews(leagueId);
  const changes = seam.useTradeChanges();
  if (reviews === undefined) return <StillLoading />;
  if (reviews.length === 0) {
    return (
      <PageSection title={TRADES_TITLE} className="max-w-4xl bg-panel">
        <PanelNote>{noTeamWords}</PanelNote>
      </PageSection>
    );
  }
  return (
    <OffersBody
      leagueId={leagueId}
      view={null}
      reviews={reviews}
      changes={changes}
      asked={asked}
    />
  );
}

function StillLoading() {
  return (
    <PageSection title={TRADES_TITLE} className="max-w-4xl bg-panel">
      <Loading className="px-3 py-2">{tradesLoadingWords}</Loading>
    </PageSection>
  );
}

function OffersBody({
  leagueId,
  view,
  reviews,
  changes,
  asked,
}: {
  leagueId: Id<"leagues">;
  /** The manager's own offers; null for a commissioner with no team. */
  view: TradesView | null;
  reviews: readonly TradeToReview[];
  changes: TradeChanges;
  asked?: Id<"tradeOffers">;
}) {
  const [chosen, choose] = useState<Id<"tradeOffers"> | null>(asked ?? null);
  const rows =
    view === null
      ? []
      : view.offers.map((offer) => ({
          offer,
          sides: sidesOf(offer, view.myTeamId),
        }));
  const ordered = OFFER_GROUPS.flatMap((group) =>
    rows.filter((row) => row.sides.group === group),
  );
  const chosenReview = reviews.find((trade) => trade.offerId === chosen);
  const chosenRow = ordered.find((row) => row.offer.offerId === chosen);
  // Nothing chosen, or the chosen one has gone: the first in the table, To review first.
  const review =
    chosenReview ?? (chosenRow === undefined ? reviews[0] : undefined);
  const selected =
    review === undefined ? (chosenRow ?? ordered[0] ?? null) : null;
  return (
    <PageSection title={TRADES_TITLE} className="flex flex-col gap-2">
      {view?.shut != null && <Notice>{shutWords[view.shut]}</Notice>}
      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-news">
        <div className="flex flex-col gap-2">
          <Panel
            title={OFFERS_TITLE}
            aside={
              <span className="text-soft">{openCountWords(rows.length)}</span>
            }
          >
            {rows.length === 0 && reviews.length === 0 ? (
              <PanelNote>{noOffersWords}</PanelNote>
            ) : (
              <OffersTable
                reviews={reviews}
                rows={ordered}
                selected={review?.offerId ?? selected?.offer.offerId ?? null}
                select={choose}
              />
            )}
          </Panel>
          {view !== null && (
            <ClosedOffers closed={view.closed} myTeamId={view.myTeamId} />
          )}
        </div>
        {review !== undefined && (
          <ReviewPanel
            key={review.offerId}
            leagueId={leagueId}
            trade={review}
            changes={changes}
          />
        )}
        {view !== null && selected !== null && (
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
