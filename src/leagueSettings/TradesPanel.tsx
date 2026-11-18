import { FIRST_GAMEWEEK } from "../../convex/gameweeks/usedGameweeks";
import { TRADE_REVIEWS } from "../../convex/rules/leagueRulesShape";
import type { LeagueSettings } from "../../convex/rules/leagueSettingsPart";
import { blankOrOff } from "../rules/blank";
import { gameweekShort } from "../shared/when/words";
import { notSetWords } from "../shared/words";
import { Choice } from "../ui/Choice";
import { Panel } from "../ui/Panel";
import { TickBox } from "../ui/TickBox";
import { SETTING_LINE, SETTING_ROWS, SettingRow, ShownAs } from "./SettingRow";
import {
  tradeDeadlineAfterWords,
  tradeDeadlineHint,
  tradeDeadlineLabel,
  tradeDeadlineRowLabel,
  tradeDeadlineWords,
  tradeReviewHint,
  tradeReviewLabel,
  tradeReviewRowLabel,
  tradeReviewWords,
  tradesTitle,
} from "./words";

const TRADE_REVIEW_CHOICE = "trade-review";
const TRADE_DEADLINE_HINT_ID = "settings-trade-deadline-hint";
/** The deadline picker's value while no gameweek is chosen. */
const NONE_CHOSEN = "";

type Trades = LeagueSettings["trades"];

/** How trades run (spec/03, spec/08; #383), one rule to a row (docs/design/approved/settings/
 *  1440-trades.png): who reviews an accepted trade, and the trade deadline, off by default (Craig,
 *  6 Nov 2026, on #383), a gameweek of the season's `seasonGameweeks`. */
export function TradesPanel({ trades, seasonGameweeks, edit }: { trades: Trades; seasonGameweeks: number; edit: (trades: Trades) => void }) {
  return (
    <Panel title={tradesTitle}>
      <div className={SETTING_ROWS}>
        <SettingRow label={tradeReviewRowLabel}>
          <Choice
            label={tradeReviewLabel}
            labelShown={false}
            name={TRADE_REVIEW_CHOICE}
            options={TRADE_REVIEWS}
            words={tradeReviewWords}
            chosen={trades.review}
            onChoose={(review) => edit({ ...trades, review })}
          />
          <p className="text-muted">{tradeReviewHint}</p>
        </SettingRow>
        <SettingRow label={tradeDeadlineRowLabel}>
          <div className={SETTING_LINE}>
            <TickBox checked={trades.deadline !== null} onChange={(on) => edit({ ...trades, deadline: blankOrOff(on) })}>
              <ShownAs shown={tradeDeadlineAfterWords}>{tradeDeadlineWords}</ShownAs>
            </TickBox>
            {trades.deadline !== null && (
              <DeadlinePicker deadline={trades.deadline} seasonGameweeks={seasonGameweeks} onChange={(deadline) => edit({ ...trades, deadline })} />
            )}
          </div>
          {trades.deadline !== null && (
            <p id={TRADE_DEADLINE_HINT_ID} className="text-muted">
              {tradeDeadlineHint(seasonGameweeks)}
            </p>
          )}
        </SettingRow>
      </div>
    </Panel>
  );
}

/** The deadline's gameweek, one of the season's (1440-trades.png). Turned on, it holds none until
 *  one is chosen, which SettingsPage's `blankRefusal` stops before the server sees it; a deadline
 *  past the season's last gameweek still shows. */
function DeadlinePicker({ deadline, seasonGameweeks, onChange }: { deadline: number; seasonGameweeks: number; onChange: (deadline: number) => void }) {
  const gameweeks = Array.from({ length: seasonGameweeks }, (_, index) => FIRST_GAMEWEEK + index);
  if (!Number.isNaN(deadline) && !gameweeks.includes(deadline)) gameweeks.push(deadline);
  return (
    <select
      aria-label={tradeDeadlineLabel}
      aria-describedby={TRADE_DEADLINE_HINT_ID}
      className="text-box"
      value={Number.isNaN(deadline) ? NONE_CHOSEN : deadline}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {Number.isNaN(deadline) && (
        <option value={NONE_CHOSEN} disabled>
          {notSetWords}
        </option>
      )}
      {gameweeks.map((gameweek) => (
        <option key={gameweek} value={gameweek}>
          {gameweekShort(gameweek)}
        </option>
      ))}
    </select>
  );
}
