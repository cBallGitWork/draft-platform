import type { WaiverOrderType } from "../../../convex/rules/leagueRulesShape";
import { Panel } from "../../ui/Panel";
import type { PendingClaim, WaiversView } from "./seam";
import {
  freeAgentsWords,
  pointsShort,
  runNoteWords,
  runWords,
  RUNS_TITLE,
  tablePlaceWords,
  WAIVER_ORDER_TITLE,
  waiverOrderNote,
  waiverOrderWords,
  windowWords,
} from "./words";

// The waiver order and the runs (#1200; the waivers pictures' right-hand column), on My team's
// Transactions tab and League settings' Waivers tab: every team in the order with its table place
// and points (Craig, 6 Nov 2026: "Everyone sees the whole order"), the caller's own marked; then
// the next runs, in the viewer's own zone, and when free agency opens.

const ROW = "flex items-baseline gap-3 border-t border-panel-rule px-3 py-1 first:border-t-0";

/** The order, its plate naming its type; `type`, where given, is one League settings is about to
 *  save, whose note it shows: the order itself starts from today's either way. */
export function WaiverOrderPanel({ waivers, type = waivers.type }: { waivers: WaiversView; type?: WaiverOrderType }) {
  return (
    <Panel title={WAIVER_ORDER_TITLE} aside={<span className="text-soft">{waiverOrderWords[type]}</span>}>
      <ol>
        {waivers.teams.map((team, place) => (
          <li key={team.teamId} aria-current={team.yours || undefined} className={`${ROW} aria-current:bg-name-plate aria-current:shadow-current-edge`}>
            <span className="w-6 text-muted">{place + 1}</span>
            <span className="grow font-semibold text-lead">{team.name}</span>
            <span className="text-soft">
              {tablePlaceWords(team.tablePlace)}
              <span className="text-figure">{pointsShort(team.points)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="border-t border-panel-rule px-3 py-2 text-muted">{waiverOrderNote(type, waivers.resetsAfter)}</p>
    </Panel>
  );
}

/** The next runs, soonest first, the first marked Next, and when free agency opens; before the
 *  league's draft is over every run is skipped (S08.1), so none is marked Next. A run that may fall
 *  in a gameweek's lock says so in place of Next (#1488). On My team's Transactions tab each run
 *  counts the manager's `claims` in it (#1031). */
export function RunsPanel({ waivers, claims = [] }: { waivers: WaiversView; claims?: readonly Pick<PendingClaim, "run">[] }) {
  const [first] = waivers.runs;
  const waitsOn = waivers.locked ? waivers.resetsAfter : waivers.windowOpen ? null : (first?.skippedIf ?? null);
  const window = windowWords({
    drafted: waivers.drafted,
    open: waivers.windowOpen,
    locked: waivers.locked,
    firstRun: first?.at ?? null,
    waitsOn,
    gameweek: waivers.windowShuts?.gameweek ?? null,
  });
  return (
    <Panel title={RUNS_TITLE}>
      <ul>
        {waivers.runs.map(({ at, skippedIf }, index) => {
          const note = runNoteWords({
            claims: claims.filter(({ run }) => run?.at === at).length,
            next: waivers.drafted && skippedIf === null && index === 0,
            skippedIf: waivers.drafted ? skippedIf : null,
          });
          return (
            <li key={at} className={ROW}>
              <span className="grow">{runWords(at)}</span>
              {note !== null && <span className="text-soft">{note}</span>}
            </li>
          );
        })}
        <li className={ROW}>
          <span className="grow">{freeAgentsWords}</span>
          <span className="text-soft">{window}</span>
        </li>
      </ul>
    </Panel>
  );
}
