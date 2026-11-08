import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { Confirm } from "../ui/Confirm";
import { Notice, Panel, Problem } from "../ui/Panel";
import { Fact, OfferSide } from "./OfferParts";
import type { OfferSides } from "./offerSides";
import { counterLink } from "./paths";
import type { ScreenOffer, TradeChanges } from "./seam";
import {
  acceptWords,
  afterItWords,
  closesAtWords,
  closesWords,
  counterWords,
  noteWords,
  offerToYouTitle,
  rejectNoWords,
  rejectQuestion,
  rejectWords,
  rejectYesWords,
  reviewEndsWords,
  reviewerWords,
  reviewRuleWords,
  reviewWords,
  squadAfterWords,
  tradeWithTitle,
  waitingOnWords,
  warningWords,
  whenWords,
  withdrawWords,
  youGetWords,
  youGiveWords,
  yourOfferToTitle,
  yourSquadWords,
} from "./words";

const TITLES = {
  toYou: offerToYouTitle,
  fromYou: yourOfferToTitle,
  inReview: tradeWithTitle,
} as const;

/** The selected offer's panel (docs/design/approved/trades): both sides, the note, the manager's
 *  squad after it, how it is reviewed and when it closes, with what he can do: Accept, Counter and
 *  Reject an offer to him, Withdraw his own until it is accepted, nothing once it is in review. */
export function OfferPanel({
  leagueId,
  offer,
  sides,
  squadCount,
  squadMaximum,
  open,
  changes,
}: {
  leagueId: Id<"leagues">;
  offer: ScreenOffer;
  sides: OfferSides;
  squadCount: number;
  squadMaximum: number | null;
  /** Trades are open: an offer can be accepted or countered. */
  open: boolean;
  changes: TradeChanges;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const run = async (change: () => Promise<string | null>) => {
    setBusy(true);
    setProblem(await change());
    setBusy(false);
  };
  const after = squadCount - sides.youGive.length + sides.youGet.length;
  return (
    <Panel
      title={TITLES[sides.group](sides.otherTeamName)}
      aside={<span className="text-soft">{whenWords(offer.madeAt)}</span>}
    >
      <OfferSide
        label={youGetWords}
        players={sides.youGet}
        pick={sides.pickYouGet}
      />
      <OfferSide
        label={youGiveWords}
        players={sides.youGive}
        pick={sides.pickYouGive}
      />
      {offer.note !== null && (
        <p className="border-b border-panel-rule px-3 py-2 italic">
          {noteWords(offer.note)}
        </p>
      )}
      <dl className="grid grid-cols-facts">
        <Fact label={yourSquadWords}>
          {squadAfterWords(after, squadMaximum)}
        </Fact>
        {sides.group === "fromYou" && (
          <Fact label={waitingOnWords}>{sides.otherTeamName}</Fact>
        )}
        {sides.group === "inReview" ? (
          <>
            <Fact label={reviewWords}>
              {offer.reviewer === null ? null : reviewerWords[offer.reviewer]}
            </Fact>
            <Fact label={reviewEndsWords} derived>
              {offer.reviewEndsAt === null
                ? null
                : whenWords(offer.reviewEndsAt)}
            </Fact>
          </>
        ) : (
          <>
            <Fact label={reviewWords}>
              {reviewRuleWords(offer.reviewer, sides.group === "toYou")}
            </Fact>
            <Fact label={closesWords} derived>
              {closesAtWords(
                offer.closes,
                offer.closes === null ? null : whenWords(offer.closes.at),
              )}
            </Fact>
          </>
        )}
      </dl>
      {offer.warnings.map((warning) => (
        <Notice key={warningWords(warning)}>
          {afterItWords(warningWords(warning))}
        </Notice>
      ))}
      <div className="flex flex-col gap-2 p-3">
        <Problem problem={problem} />
        {sides.group === "toYou" && !rejecting && (
          <span className="flex flex-wrap gap-2">
            {open && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() => changes.accept(leagueId, offer.offerId))
                }
                className="action"
              >
                {acceptWords}
              </button>
            )}
            {open && offer.picks === null && (
              <Link
                {...counterLink(offer.offerId)}
                className="secondary-action"
              >
                {counterWords}
              </Link>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejecting(true)}
              className="danger-action"
            >
              {rejectWords}
            </button>
          </span>
        )}
        {rejecting && (
          <Confirm
            question={rejectQuestion(sides.otherTeamName)}
            yes={rejectYesWords}
            no={rejectNoWords}
            busy={busy}
            onYes={() =>
              void run(() => changes.reject(leagueId, offer.offerId))
            }
            onNo={() => setRejecting(false)}
          />
        )}
        {sides.group === "fromYou" && (
          <span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() => changes.withdraw(leagueId, offer.offerId))
              }
              className="secondary-action"
            >
              {withdrawWords}
            </button>
          </span>
        )}
      </div>
    </Panel>
  );
}
