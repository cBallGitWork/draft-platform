import { FIRST_RUN_TIME } from "../../convex/rules/firstRules";
import { WAIVER_ORDERS, WEEKDAYS, type WaiverRules } from "../../convex/rules/leagueRulesShape";
import { waiverOrderWords } from "../myTeam/claims/words";
import { Choice } from "../ui/Choice";
import { PANEL_BODY, Panel } from "../ui/Panel";
import {
  addRunWords,
  dayWords,
  removeRunLabel,
  removeRunWords,
  runDayLabel,
  runsHint,
  runsLabel,
  runTimeLabel,
  runTimeWords,
  waiverOrderHint,
  waiverOrderLabel,
  waiversTitle,
} from "./words";

// How waivers run (spec/03, spec/08; #1200, the waivers picture's Waivers tab): Reverse table order
// or Rotating, each explained, and the runs as day and time rows, with Remove and Add a run: at
// least one run, and no time twice. Saved with the rest of the settings; a change of order type
// applies at once, from today's order (Craig, 6 Nov 2026).

const WAIVER_ORDER_CHOICE = "waiver-order";
type Run = WaiverRules["runs"][number];

/** The times a run is offered at, each half hour: Claude's choice, as fine as a weekly run needs. */
const HALF_HOURS = Array.from({ length: 48 }, (_, half) => ({ hour: Math.floor(half / 2), minute: (half % 2) * 30 }));
const timeKey = ({ hour, minute }: { hour: number; minute: number }) => `${hour}:${minute}`;

/** A new run: the first day of the week with no run yet, at the time the league's first runs are. */
function newRun(runs: readonly Run[]): Run {
  const day = WEEKDAYS.find((each) => !runs.some((run) => run.day === each)) ?? WEEKDAYS[0];
  return { day, ...FIRST_RUN_TIME };
}

export function WaiversPanel({ waivers, edit }: { waivers: WaiverRules; edit: (waivers: WaiverRules) => void }) {
  const setRun = (index: number, run: Run) => edit({ ...waivers, runs: waivers.runs.map((each, at) => (at === index ? run : each)) });
  return (
    <Panel title={waiversTitle}>
      <div className={PANEL_BODY}>
        <Choice label={waiverOrderLabel} name={WAIVER_ORDER_CHOICE} options={WAIVER_ORDERS} words={waiverOrderWords} chosen={waivers.order} onChoose={(order) => edit({ ...waivers, order })} />
        <p className="text-muted">{waiverOrderHint}</p>
        <span className="text-soft">{runsLabel}</span>
        {waivers.runs.map((run, index) => {
          const number = index + 1;
          // A time not on the half hour, saved before, stays offered so the row shows it.
          const times = HALF_HOURS.some((time) => timeKey(time) === timeKey(run)) ? HALF_HOURS : [...HALF_HOURS, { hour: run.hour, minute: run.minute }];
          return (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <select aria-label={runDayLabel(number)} className="text-box" value={run.day} onChange={(event) => setRun(index, { ...run, day: event.target.value as Run["day"] })}>
                {WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {dayWords[day]}
                  </option>
                ))}
              </select>
              <select
                aria-label={runTimeLabel(number)}
                className="text-box"
                value={timeKey(run)}
                onChange={(event) => {
                  const [hour, minute] = event.target.value.split(":").map(Number);
                  setRun(index, { ...run, hour, minute });
                }}
              >
                {times.map((time) => (
                  <option key={timeKey(time)} value={timeKey(time)}>
                    {runTimeWords(time.hour, time.minute)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary-action"
                aria-label={removeRunLabel(number)}
                disabled={waivers.runs.length === 1}
                onClick={() => edit({ ...waivers, runs: waivers.runs.filter((_, at) => at !== index) })}
              >
                {removeRunWords}
              </button>
            </div>
          );
        })}
        <p>
          <button type="button" className="secondary-action" onClick={() => edit({ ...waivers, runs: [...waivers.runs, newRun(waivers.runs)] })}>
            {addRunWords}
          </button>
        </p>
        <p className="text-muted">{runsHint}</p>
      </div>
    </Panel>
  );
}

/** Whether two of the runs are at the same time, which the rules refuse. */
export const runTwice = (runs: readonly Run[]) => new Set(runs.map((run) => `${run.day} ${timeKey(run)}`)).size !== runs.length;
