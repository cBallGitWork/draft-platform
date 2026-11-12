import type { Id } from "../../convex/_generated/dataModel";
import { isLocked } from "../../convex/gameweeks/deadline";
import type { ScoringStartView } from "../../convex/gameweeks/scoringStart";
import { Loading, Problem } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import { useNowEachMinute } from "../shared/useMinute";
import { gameweekShort, whenWords } from "../shared/words";
import type { LeagueSettingsSeam } from "./seam";
import {
  noScoringStartChoicesWords,
  noScoringStartHint,
  noScoringStartWords,
  savesAtOnceWords,
  scoringStartFixedAfter,
  scoringStartFixedWords,
  scoringStartHint,
  scoringStartLabel,
  scoringStartLoadingWords,
  seasonBegunStartHint,
} from "./words";

const HINT_ID = "settings-scoring-start-hint";
/** The picker's value while no start is set. */
const NOT_SET = "";

/** "Scoring starts in gameweek N" (spec/04, After the draft; Craig, 5 Nov 2026, on #1097; #1190):
 *  a picker offering only the ticked gameweeks not begun, saved at once, apart from the settings'
 *  Save. Once the start's deadline passes it's fixed, and shows as words; so is none set once the
 *  league has scored a gameweek (Craig, 11 Nov 2026, on #1588). */
export function ScoringStartRow({ leagueId, seam }: { leagueId: Id<"leagues">; seam: LeagueSettingsSeam }) {
  const view = seam.useScoringStart(leagueId);
  const saving = useChange();
  // A gameweek that begins while the page is open leaves the picker.
  const now = useNowEachMinute();
  if (view === undefined) return <Loading>{scoringStartLoadingWords}</Loading>;
  const startDeadline = view.ticked.find(({ gameweek }) => gameweek === view.start)?.deadline ?? null;
  const fixedAtNone = view.start === null && view.seasonBegun;
  const fixed = view.start !== null && isLocked(startDeadline, now);
  const choices = choicesOf(view, now);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden className="text-soft">
          {scoringStartLabel}
        </span>
        {fixed ? (
          <span className="font-semibold">{gameweekShort(view.start!)}</span>
        ) : fixedAtNone ? (
          <span className="font-semibold">{noScoringStartWords}</span>
        ) : choices.length === 0 && view.start === null ? (
          <span>{noScoringStartChoicesWords}</span>
        ) : (
          <select
            aria-label={scoringStartLabel}
            aria-describedby={HINT_ID}
            className="text-box"
            disabled={saving.busy}
            value={view.start ?? NOT_SET}
            onChange={(event) => void saving.run(() => seam.setScoringStart(leagueId, Number(event.target.value)))}
          >
            {view.start === null && (
              <option value={NOT_SET} disabled>
                {noScoringStartWords}
              </option>
            )}
            {choices.map((gameweek) => (
              <option key={gameweek} value={gameweek}>
                {gameweekShort(gameweek)}
              </option>
            ))}
          </select>
        )}
      </div>
      <p id={HINT_ID} className="text-muted">
        {fixedAtNone ? seasonBegunStartHint : hintOf(view.start, startDeadline, fixed)}
      </p>
      <Problem problem={saving.problem} />
    </div>
  );
}

/** The gameweeks the start can be set to: ticked, with a known deadline still to come, and the
 *  start itself, so the picker always shows it. */
function choicesOf({ start, ticked }: ScoringStartView, now: number): number[] {
  const open = ticked.filter(({ deadline }) => deadline !== null && !isLocked(deadline, now)).map(({ gameweek }) => gameweek);
  return start === null || open.includes(start) ? open : [start, ...open].sort((a, b) => a - b);
}

/** What the start does, then whether a change saves at once and until when, or that it's fixed. */
function hintOf(start: number | null, deadline: number | null, fixed: boolean): string {
  if (fixed) return `${scoringStartHint} ${scoringStartFixedWords(whenWords(deadline!))}`;
  const until = start === null ? noScoringStartHint : deadline === null ? null : scoringStartFixedAfter(whenWords(deadline));
  return [scoringStartHint, savesAtOnceWords, until].filter((words) => words !== null).join(" ");
}
