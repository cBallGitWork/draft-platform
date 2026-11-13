import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { useChange } from "../shared/useChange";
import { Confirm } from "../ui/Confirm";
import { Panel, Problem } from "../ui/Panel";
import { Fact, OfferSide } from "./OfferParts";
import type { TradeChanges, TradeToReview } from "./seam";
import {
  againstWords,
  blockNoWords,
  blockQuestion,
  blockWords,
  blockYesWords,
  noteWords,
  reviewEndsWords,
  reviewWords,
  takeBackWords,
  teamGetsWords,
  tradeBetweenTitle,
  votedAgainstWords,
  whenWords,
  yourReviewWords,
} from "./words";

/** The selected trade the manager reviews (#383; Craig, 10 Nov 2026): both sides, the note, the
 *  review's end and what he may do. Under a veto, Block behind a confirm; under a vote, Against, or
 *  once he has voted, his own vote and Take back until the review ends. */
export function ReviewPanel({
  leagueId,
  trade,
  changes,
}: {
  leagueId: Id<"leagues">;
  trade: TradeToReview;
  changes: TradeChanges;
}) {
  const { busy, problem, run } = useChange();
  const [blocking, setBlocking] = useState(false);
  const { fromTeamName: from, toTeamName: to } = trade;
  return (
    <Panel title={tradeBetweenTitle(from, to)}>
      <OfferSide
        label={teamGetsWords(from)}
        players={trade.gets}
        pick={trade.picks?.gets ?? null}
      />
      <OfferSide
        label={teamGetsWords(to)}
        players={trade.gives}
        pick={trade.picks?.gives ?? null}
      />
      {trade.note !== null && (
        <p className="border-b border-panel-rule px-3 py-2 italic">
          {noteWords(trade.note)}
        </p>
      )}
      <dl className="grid grid-cols-facts">
        <Fact label={reviewWords}>{yourReviewWords[trade.yours]}</Fact>
        <Fact label={reviewEndsWords} derived>
          {whenWords(trade.reviewEndsAt)}
        </Fact>
      </dl>
      <div className="flex flex-col gap-2 p-3">
        <Problem problem={problem} />
        {trade.yours === "block" &&
          (blocking ? (
            <Confirm
              question={blockQuestion(from, to)}
              yes={blockYesWords}
              no={blockNoWords}
              busy={busy}
              onYes={() =>
                void run(() => changes.block(leagueId, trade.offerId))
              }
              onNo={() => setBlocking(false)}
            />
          ) : (
            <span>
              <button
                type="button"
                onClick={() => setBlocking(true)}
                className="danger-action"
              >
                {blockWords}
              </button>
            </span>
          ))}
        {trade.yours === "against" && (
          <span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() => changes.against(leagueId, trade.offerId))
              }
              className="action"
            >
              {againstWords}
            </button>
          </span>
        )}
        {trade.yours === "takeBack" && (
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-semibold">{votedAgainstWords}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() => changes.takeBack(leagueId, trade.offerId))
              }
              className="secondary-action"
            >
              {takeBackWords}
            </button>
          </span>
        )}
      </div>
    </Panel>
  );
}
