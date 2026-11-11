import { useState } from "react";
import { UNDRAFTED_GO_TO } from "../../convex/draft/draftRules";
import type { LeagueSettings } from "../../convex/rules/leagueSettingsPart";
import { Choice } from "../ui/Choice";
import { PANEL_BODY, Panel } from "../ui/Panel";
import { TickBox } from "../ui/TickBox";
import { DraftStartRow, type DraftStartEdit } from "./DraftStartRow";
import { NumberRow } from "./NumberRow";
import { SETTINGS_DRAFT_HASH } from "./paths";
import { inUnit, PICK_CLOCK_UNITS, toSeconds, unitFor, type PickClockUnit } from "./pickClock";
import {
  autoPickWords,
  draftTitle,
  neverAutoPickWords,
  pickClockHint,
  pickClockLabel,
  pickClockUnitLabel,
  pickClockUnitWords,
  timeoutsHint,
  timeoutsLabel,
  undraftedHint,
  undraftedLabel,
  undraftedWords,
} from "./words";

const PICK_CLOCK_HINT_ID = "settings-pick-clock-hint";
const TIMEOUTS_HINT_ID = "settings-timeouts-hint";
const UNDRAFTED_CHOICE = "undrafted";
const PICK_CLOCK_UNIT_CHOICE = "pick-clock-unit";

type Draft = LeagueSettings["draft"];

/** How the draft runs (spec/04; #1087): its start date (#1476), the pick clock, the timeouts before
 *  auto-pick, or never, and where the players nobody drafts go. The draft order is TeamOrderPanel's.
 *  The draft room's "Change the start" opens the page here (SETTINGS_DRAFT_HASH). */
export function DraftPanel({ draft, edit, start }: { draft: Draft; edit: (draft: Draft) => void; start: DraftStartEdit }) {
  return (
    <div id={SETTINGS_DRAFT_HASH}>
      <Panel title={draftTitle}>
        <div className={PANEL_BODY}>
          <DraftStartRow start={start} />
          <PickClock seconds={draft.pickSeconds} onChange={(pickSeconds) => edit({ ...draft, pickSeconds })} />
          <TickBox checked={draft.timeoutsBeforeAutoPick !== null} onChange={(on) => edit({ ...draft, timeoutsBeforeAutoPick: on ? NaN : null })}>
            {autoPickWords}
          </TickBox>
          {draft.timeoutsBeforeAutoPick === null ? (
            <p className="text-muted">{neverAutoPickWords}</p>
          ) : (
            <>
              <NumberRow
                label={timeoutsLabel}
                hintId={TIMEOUTS_HINT_ID}
                value={draft.timeoutsBeforeAutoPick}
                onChange={(timeoutsBeforeAutoPick) => edit({ ...draft, timeoutsBeforeAutoPick })}
              />
              <p id={TIMEOUTS_HINT_ID} className="text-muted">
                {timeoutsHint}
              </p>
            </>
          )}
          <Choice label={undraftedLabel} name={UNDRAFTED_CHOICE} options={UNDRAFTED_GO_TO} words={undraftedWords} chosen={draft.undrafted} onChoose={(undrafted) => edit({ ...draft, undrafted })} />
          <p className="text-muted">{undraftedHint}</p>
        </div>
      </Panel>
    </div>
  );
}

/** The pick clock's box, in the unit chosen beside it (pickClock.ts). It opens in the largest unit
 *  the clock is a whole number of, and again when the clock changes from outside, as when the
 *  latest settings are loaded; changing the unit keeps the number, so 2 minutes becomes 2 hours. */
function PickClock({ seconds, onChange }: { seconds: number; onChange: (seconds: number) => void }) {
  const [unit, setUnit] = useState<PickClockUnit>(() => unitFor(seconds));
  const [handed, setHanded] = useState(seconds);
  if (!Object.is(handed, seconds)) {
    setHanded(seconds);
    setUnit(unitFor(seconds));
  }
  function hand(next: number, nextUnit: PickClockUnit) {
    const inSeconds = toSeconds(next, nextUnit);
    setUnit(nextUnit);
    setHanded(inSeconds);
    onChange(inSeconds);
  }
  const amount = inUnit(seconds, unit);
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <NumberRow label={pickClockLabel} hintId={PICK_CLOCK_HINT_ID} value={amount} onChange={(next) => hand(next, unit)} />
        <Choice
          label={pickClockUnitLabel}
          labelShown={false}
          name={PICK_CLOCK_UNIT_CHOICE}
          options={PICK_CLOCK_UNITS}
          words={pickClockUnitWords}
          chosen={unit}
          onChoose={(next) => hand(amount, next)}
        />
      </div>
      <p id={PICK_CLOCK_HINT_ID} className="text-muted">
        {pickClockHint}
      </p>
    </>
  );
}
