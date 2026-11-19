import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { LeagueSettings } from "../../convex/rules/leagueSettingsPart";
import { DOUBLE_GAMEWEEK_RULES } from "../../convex/scoring/values";
import type { TieBreak } from "../../convex/table/standings";
import { NumberBox } from "../rules/NumberBox";
import { Choice } from "../ui/Choice";
import { Panel } from "../ui/Panel";
import { ScoringStartRow } from "./ScoringStartRow";
import type { LeagueSettingsSeam } from "./seam";
import { SETTING_LINE, SETTING_ROWS, SettingRow } from "./SettingRow";
import {
  deadlineHint,
  deadlineLabel,
  deadlineUnit,
  doubleGameweekLabel,
  doubleGameweekWords,
  fixturesTitle,
  formatHint,
  formatLabel,
  formatWords,
  gamesHint,
  gamesLabel,
  gamesUnit,
  moveDownLabel,
  moveDownWords,
  moveUpLabel,
  moveUpWords,
  playOffLegsLabel,
  playOffTeamsLabel,
  redrawWords,
  tableTitle,
  tieBreaksLabel,
  tieBreakWords,
} from "./words";

/** The games box's hint's id, which the box is described by (#915). */
const GAMES_HINT_ID = "settings-games-hint";
const DEADLINE_HINT_ID = "settings-deadline-hint";
const TIE_BREAKS_LABEL_ID = "settings-tie-breaks-label";
/** Up and Down: the secondary action, desk-sized, greyed where a tie-break or a team can't move that
 *  way (the approved pictures). */
export const MOVE_ACTION = "secondary-action lg:min-h-0 lg:py-1 disabled:border-muted disabled:text-muted";
const FORMATS = ["headToHead", "totalPoints"] as const satisfies readonly LeagueSettings["format"][];

type Edit = { draft: LeagueSettings; edit: (settings: LeagueSettings) => void };

/** The Fixtures tab (docs/design/approved/settings/1440.png): the format, locked once the season
 *  has begun, which the server refuses with why (spec/03, S03.1); the scoring start, saved at once;
 *  the round robin's games a gameweek (spec/09; the odd team out always plays the league's
 *  average, S03.4, so it is no setting); double gameweeks; the deadline (S03.3); and the table's
 *  tie-breaks (S03.2). */
export function FixturesPanels({ league, seam, draft, edit }: Edit & { league: LeagueSummary; seam: LeagueSettingsSeam }) {
  return (
    <>
      <Panel title={fixturesTitle}>
        <div className={SETTING_ROWS}>
          <SettingRow label={formatLabel}>
            <Choice label={formatLabel} labelShown={false} name="format" options={FORMATS} words={formatWords} chosen={draft.format} onChoose={(format) => edit({ ...draft, format })} />
            <p className="text-muted">{formatHint}</p>
          </SettingRow>
          <ScoringStartRow leagueId={league.leagueId} seam={seam} />
          <SettingRow label={gamesLabel}>
            <NumberWithUnit label={gamesLabel} unit={gamesUnit} hintId={GAMES_HINT_ID} value={draft.gamesPerGameweek} onChange={(gamesPerGameweek) => edit({ ...draft, gamesPerGameweek })} />
            <p id={GAMES_HINT_ID} className="text-muted">
              {gamesHint}
            </p>
            <p className="text-muted">{redrawWords}</p>
          </SettingRow>
          <SettingRow label={doubleGameweekLabel}>
            <Choice
              label={doubleGameweekLabel}
              labelShown={false}
              name="double-gameweek"
              options={DOUBLE_GAMEWEEK_RULES}
              words={doubleGameweekWords}
              chosen={draft.doubleGameweek}
              onChoose={(doubleGameweek) => edit({ ...draft, doubleGameweek })}
            />
          </SettingRow>
          <SettingRow label={deadlineLabel}>
            <NumberWithUnit
              label={deadlineLabel}
              unit={deadlineUnit}
              hintId={DEADLINE_HINT_ID}
              value={draft.deadline.minutesBeforeFirstKickoff}
              onChange={(minutesBeforeFirstKickoff) => edit({ ...draft, deadline: { minutesBeforeFirstKickoff } })}
            />
            <p id={DEADLINE_HINT_ID} className="text-muted">
              {deadlineHint}
            </p>
          </SettingRow>
        </div>
      </Panel>
      <Panel title={tableTitle}>
        <div className={SETTING_ROWS}>
          <SettingRow label={tieBreaksLabel} labelId={TIE_BREAKS_LABEL_ID}>
            <TieBreaks tieBreaks={draft.tieBreaks} reorder={(tieBreaks) => edit({ ...draft, tieBreaks })} />
          </SettingRow>
          {[playOffTeamsLabel, playOffLegsLabel].map((label) => (
            <SettingRow key={label} label={label} muted>
              <input type="text" disabled aria-label={label} className="number-box" />
            </SettingRow>
          ))}
        </div>
      </Panel>
    </>
  );
}

/** A number's box with its unit after it ("90 minutes before the gameweek's first kickoff"). */
function NumberWithUnit({ unit, ...box }: { label: string; unit: string; hintId: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className={SETTING_LINE}>
      <NumberBox {...box} />
      <span className="text-soft">{unit}</span>
    </div>
  );
}

/** The league's tie-breaks in order, each moved up or down a place with the rest of the settings'
 *  edits, saved by the bar. The first's Up and the last's Down are off. */
function TieBreaks({ tieBreaks, reorder }: { tieBreaks: readonly TieBreak[]; reorder: (tieBreaks: TieBreak[]) => void }) {
  function move(from: number, to: number) {
    const moved = [...tieBreaks];
    [moved[from], moved[to]] = [moved[to], moved[from]];
    reorder(moved);
  }
  return (
    <ol aria-labelledby={TIE_BREAKS_LABEL_ID} className="flex flex-col gap-1">
      {tieBreaks.map((tieBreak, place) => (
        <li key={tieBreak} className="flex items-center gap-3">
          <span className="w-4 text-right text-figure tabular-nums">{place + 1}</span>
          <span className="w-32">{tieBreakWords[tieBreak]}</span>
          <button type="button" aria-label={moveUpLabel(tieBreakWords[tieBreak])} disabled={place === 0} onClick={() => move(place, place - 1)} className={MOVE_ACTION}>
            {moveUpWords}
          </button>
          <button type="button" aria-label={moveDownLabel(tieBreakWords[tieBreak])} disabled={place === tieBreaks.length - 1} onClick={() => move(place, place + 1)} className={MOVE_ACTION}>
            {moveDownWords}
          </button>
        </li>
      ))}
    </ol>
  );
}
