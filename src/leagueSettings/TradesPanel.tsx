import { TRADE_REVIEWS } from "../../convex/rules/leagueRulesShape";
import type { LeagueSettings } from "../../convex/rules/leagueSettingsPart";
import { blankOrOff } from "../rules/blank";
import { Choice } from "../ui/Choice";
import { PANEL_BODY, Panel } from "../ui/Panel";
import { TickBox } from "../ui/TickBox";
import { NumberRow } from "./NumberRow";
import { tradeDeadlineHint, tradeDeadlineLabel, tradeDeadlineWords, tradeReviewHint, tradeReviewLabel, tradeReviewWords, tradesTitle } from "./words";

const TRADE_REVIEW_CHOICE = "trade-review";
const TRADE_DEADLINE_HINT_ID = "settings-trade-deadline-hint";

type Trades = LeagueSettings["trades"];

/** How trades run (spec/03, spec/08; #383): who reviews an accepted trade, and the trade deadline,
 *  off by default (Craig, 6 Nov 2026, on #383), a gameweek of the season's `seasonGameweeks`. */
export function TradesPanel({ trades, seasonGameweeks, edit }: { trades: Trades; seasonGameweeks: number; edit: (trades: Trades) => void }) {
  return (
    <Panel title={tradesTitle}>
      <div className={PANEL_BODY}>
        <Choice label={tradeReviewLabel} name={TRADE_REVIEW_CHOICE} options={TRADE_REVIEWS} words={tradeReviewWords} chosen={trades.review} onChoose={(review) => edit({ ...trades, review })} />
        <p className="text-muted">{tradeReviewHint}</p>
        <TickBox checked={trades.deadline !== null} onChange={(on) => edit({ ...trades, deadline: blankOrOff(on) })}>
          {tradeDeadlineWords}
        </TickBox>
        {trades.deadline !== null && (
          <>
            <NumberRow label={tradeDeadlineLabel} hintId={TRADE_DEADLINE_HINT_ID} value={trades.deadline} onChange={(deadline) => edit({ ...trades, deadline })} />
            <p id={TRADE_DEADLINE_HINT_ID} className="text-muted">
              {tradeDeadlineHint(seasonGameweeks)}
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}
