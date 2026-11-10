import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { TRADES_PATH } from "../frame/menu";
import {
  Loading,
  Notice,
  PageSection,
  Panel,
  PanelNote,
  Problem,
} from "../ui/Panel";
import { NoteBox, PartnerPicker } from "./OfferControls";
import { Fact, OfferSide } from "./OfferParts";
import { sidesOf } from "./offerSides";
import { pickNamed, useOfferTicks } from "./offerTicks";
import { PicksTable } from "./PicksTable";
import type { ScreenTeam, TradeChanges, TradesSeam, TradesView } from "./seam";
import { SquadTable } from "./SquadTable";
import {
  clearWords,
  noneTickedWords,
  noPartnerWords,
  noTeamWords,
  onePickEachWords,
  sendCounterWords,
  sendOfferWords,
  shutWords,
  squadAfterWords,
  squadCountWords,
  theirSquadWords,
  toTeamWords,
  TRADES_TITLE,
  tradesLoadingWords,
  youGetWords,
  youGiveWords,
  YOUR_COUNTER_TITLE,
  YOUR_OFFER_TITLE,
  yourSquadWords,
} from "./words";

/** Trades' New offer tab (#383; docs/design/approved/trades/1440-new.png): both squads side by side
 *  with ticks, each with its Picks block under it before the draft (#1096), the team to trade with
 *  picked in Their squad's plate, and the offer summed up on the
 *  right with a one-line note. `counter` names an offer to the manager it answers, filling it in. */
export function NewOfferPage({
  league,
  seam,
  counter,
}: {
  league: LeagueSummary;
  seam: TradesSeam;
  counter?: Id<"tradeOffers">;
}) {
  if (league.teamName === null) {
    return (
      <PageSection title={TRADES_TITLE} className="max-w-4xl bg-panel">
        <PanelNote>{noTeamWords}</PanelNote>
      </PageSection>
    );
  }
  return <Loaded leagueId={league.leagueId} seam={seam} counter={counter} />;
}

function Loaded({
  leagueId,
  seam,
  counter,
}: {
  leagueId: Id<"leagues">;
  seam: TradesSeam;
  counter?: Id<"tradeOffers">;
}) {
  const view = seam.useTrades(leagueId);
  const changes = seam.useTradeChanges();
  if (view === undefined) {
    return (
      <PageSection title={TRADES_TITLE} className="max-w-4xl bg-panel">
        <Loading className="px-3 py-2">{tradesLoadingWords}</Loading>
      </PageSection>
    );
  }
  return (
    <NewOffer
      key={counter ?? "new"}
      leagueId={leagueId}
      view={view}
      changes={changes}
      counter={counterOf(view, counter)}
    />
  );
}

/** The offer to the manager that a counter answers, from his side: the team, and the codes he
 *  gives and gets. Null for a new offer, or one he can't counter. */
type Countered = {
  offerId: Id<"tradeOffers">;
  teamId: Id<"teams">;
  gives: number[];
  gets: number[];
};

function counterOf(
  view: TradesView,
  offerId: Id<"tradeOffers"> | undefined,
): Countered | null {
  const offer = view.offers.find((each) => each.offerId === offerId);
  if (offer === undefined) return null;
  const sides = sidesOf(offer, view.myTeamId);
  if (sides.group !== "toYou" || offer.picks !== null) return null;
  return {
    offerId: offer.offerId,
    teamId: sides.otherTeamId,
    gives: sides.youGive.map(({ code }) => code),
    gets: sides.youGet.map(({ code }) => code),
  };
}

function NewOffer({
  leagueId,
  view,
  changes,
  counter,
}: {
  leagueId: Id<"leagues">;
  view: TradesView;
  changes: TradeChanges;
  counter: Countered | null;
}) {
  const navigate = useNavigate();
  const [mine, ...others] = view.teams;
  const partners = others.filter((team) => !team.onAutoTeam);
  const [partnerId, setPartnerId] = useState<Id<"teams"> | null>(
    counter?.teamId ?? partners[0]?.teamId ?? null,
  );
  const ticks = useOfferTicks({
    gives: counter?.gives ?? [],
    gets: counter?.gets ?? [],
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const partner = partners.find((team) => team.teamId === partnerId) ?? null;

  const choosePartner = (teamId: Id<"teams">) => {
    setPartnerId(teamId);
    ticks.clearTheirs();
  };
  const clear = () => {
    ticks.clear();
    setNote("");
    setProblem(null);
  };
  const send = async () => {
    if (partner === null) return;
    setBusy(true);
    const terms = {
      ...ticks.terms,
      note: note.trim() === "" ? null : note,
    };
    const refused =
      counter === null
        ? await changes.offer(leagueId, partner.teamId, terms)
        : await changes.counter(leagueId, counter.offerId, terms);
    setBusy(false);
    setProblem(refused);
    if (refused === null) void navigate({ to: TRADES_PATH });
  };

  const picked = (team: ScreenTeam | null, codes: readonly number[]) =>
    (team?.players ?? []).filter((player) => codes.includes(player.code));
  const { gives, gets, ready: ticked } = ticks;
  return (
    <PageSection title={TRADES_TITLE} className="flex flex-col gap-2">
      {view.shut !== null && <Notice>{shutWords[view.shut]}</Notice>}
      <div className="grid items-start gap-2 lg:grid-cols-new-offer">
        <Panel
          title={yourSquadWords}
          aside={
            <span className="text-soft">
              {squadCountWords(mine.players.length, view.squadMaximum)}
            </span>
          }
        >
          <SquadTable team={mine} ticked={gives} tick={ticks.tickGives} />
          <PicksTable
            team={mine}
            ticked={ticks.givePick}
            tick={ticks.tickGivePick}
          />
        </Panel>
        <Panel
          title={theirSquadWords}
          aside={
            <PartnerPicker
              partners={partners}
              partnerId={partner?.teamId ?? null}
              choose={choosePartner}
              locked={counter !== null}
              count={
                partner === null
                  ? null
                  : squadCountWords(partner.players.length, view.squadMaximum)
              }
            />
          }
        >
          {partner === null ? (
            <PanelNote>{noPartnerWords}</PanelNote>
          ) : (
            <>
              <SquadTable team={partner} ticked={gets} tick={ticks.tickGets} />
              <PicksTable
                team={partner}
                ticked={ticks.getPick}
                tick={ticks.tickGetPick}
              />
            </>
          )}
        </Panel>
        <Panel
          title={counter === null ? YOUR_OFFER_TITLE : YOUR_COUNTER_TITLE}
          aside={
            partner === null ? undefined : (
              <span className="text-soft">{toTeamWords(partner.teamName)}</span>
            )
          }
        >
          <OfferSide
            label={youGetWords}
            players={picked(partner, gets)}
            pick={pickNamed(partner, ticks.getPick)}
          />
          <OfferSide
            label={youGiveWords}
            players={picked(mine, gives)}
            pick={pickNamed(mine, ticks.givePick)}
          />
          <NoteBox note={note} setNote={setNote} />
          <dl className="grid grid-cols-facts">
            <Fact label={yourSquadWords}>
              {squadAfterWords(
                mine.players.length - gives.length + gets.length,
                view.squadMaximum,
              )}
            </Fact>
            {partner !== null && (
              <Fact label={theirSquadWords}>
                {squadAfterWords(
                  partner.players.length - gets.length + gives.length,
                  view.squadMaximum,
                )}
              </Fact>
            )}
          </dl>
          <div className="flex flex-col gap-2 p-3">
            <Problem problem={problem} />
            {!ticked && (
              <p className="text-muted">
                {ticks.onePickOnly ? onePickEachWords : noneTickedWords}
              </p>
            )}
            <span className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  busy || !ticked || partner === null || view.shut !== null
                }
                onClick={() => void send()}
                className={ticked ? "action" : "action-idle"}
              >
                {counter === null ? sendOfferWords : sendCounterWords}
              </button>
              <button
                type="button"
                onClick={clear}
                className="secondary-action"
              >
                {clearWords}
              </button>
            </span>
          </div>
        </Panel>
      </div>
    </PageSection>
  );
}
