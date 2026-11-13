import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { LeagueSettings } from "../../convex/rules/leagueSettingsPart";
import { DOUBLE_GAMEWEEK_RULES } from "../../convex/scoring/values";
import { ODD_TEAM_OUTS } from "../../convex/table/roundRobin";
import type { TieBreak } from "../../convex/table/standings";
import { Choice } from "../ui/Choice";
import { PANEL_BODY, Panel } from "../ui/Panel";
import { NumberRow } from "./NumberRow";
import { ScoringStartRow } from "./ScoringStartRow";
import type { LeagueSettingsSeam } from "./seam";
import {
  deadlineHint,
  deadlineLabel,
  doubleGameweekLabel,
  doubleGameweekWords,
  fixturesTitle,
  formatHint,
  formatLabel,
  formatWords,
  gamesHint,
  gamesLabel,
  moveDownLabel,
  moveDownWords,
  moveUpLabel,
  moveUpWords,
  oddTeamOutLabel,
  oddTeamOutWords,
  redrawWords,
  tableTitle,
  tieBreaksLabel,
  tieBreakWords,
} from "./words";

/** The games box's hint's id, which the box is described by (#915). */
const GAMES_HINT_ID = "settings-games-hint";
const DEADLINE_HINT_ID = "settings-deadline-hint";
const TIE_BREAKS_LABEL_ID = "settings-tie-breaks-label";
/** Up and Down: the secondary action, desk-sized, greyed where a tie-break can't move that way (the
 *  approved picture). */
const MOVE_ACTION = "secondary-action lg:min-h-0 lg:py-1 disabled:border-muted disabled:text-muted";
const FORMATS = ["headToHead", "totalPoints"] as const satisfies readonly LeagueSettings["format"][];

type Edit = { draft: LeagueSettings; edit: (settings: LeagueSettings) => void };

/** The Fixtures tab (docs/design/approved/settings/1440.png): the format, locked once the season
 *  has begun, which the server refuses with why (spec/03, S03.1); the scoring start, saved at once;
 *  the round robin's two (spec/09); double gameweeks; the deadline (S03.3); and the table's
 *  tie-breaks (S03.2). */
export function FixturesPanels({ league, seam, draft, edit }: Edit & { league: LeagueSummary; seam: LeagueSettingsSeam }) {
  return (
    <>
      <Panel title={fixturesTitle}>
        <div className={PANEL_BODY}>
          <div className="flex flex-col gap-1">
            <Choice label={formatLabel} name="format" options={FORMATS} words={formatWords} chosen={draft.format} onChoose={(format) => edit({ ...draft, format })} />
            <p className="text-muted">{formatHint}</p>
          </div>
          <ScoringStartRow leagueId={league.leagueId} seam={seam} />
          <Choice
            label={oddTeamOutLabel}
            name="odd-team-out"
            options={ODD_TEAM_OUTS}
            words={oddTeamOutWords}
            chosen={draft.oddTeamOut}
            onChoose={(oddTeamOut) => edit({ ...draft, oddTeamOut })}
          />
          <NumberRow label={gamesLabel} hintId={GAMES_HINT_ID} value={draft.gamesPerGameweek} onChange={(gamesPerGameweek) => edit({ ...draft, gamesPerGameweek })} />
          <p id={GAMES_HINT_ID} className="text-muted">
            {gamesHint}
          </p>
          <p className="text-muted">{redrawWords}</p>
          <Choice
            label={doubleGameweekLabel}
            name="double-gameweek"
            options={DOUBLE_GAMEWEEK_RULES}
            words={doubleGameweekWords}
            chosen={draft.doubleGameweek}
            onChoose={(doubleGameweek) => edit({ ...draft, doubleGameweek })}
          />
          <NumberRow
            label={deadlineLabel}
            hintId={DEADLINE_HINT_ID}
            value={draft.deadline.minutesBeforeFirstKickoff}
            onChange={(minutesBeforeFirstKickoff) => edit({ ...draft, deadline: { minutesBeforeFirstKickoff } })}
          />
          <p id={DEADLINE_HINT_ID} className="text-muted">
            {deadlineHint}
          </p>
        </div>
      </Panel>
      <Panel title={tableTitle}>
        <div className={PANEL_BODY}>
          <TieBreaks tieBreaks={draft.tieBreaks} reorder={(tieBreaks) => edit({ ...draft, tieBreaks })} />
        </div>
      </Panel>
    </>
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span id={TIE_BREAKS_LABEL_ID} className="text-soft">
        {tieBreaksLabel}
      </span>
      <ol aria-labelledby={TIE_BREAKS_LABEL_ID} className="flex flex-col gap-1">
        {tieBreaks.map((tieBreak, place) => (
          <li key={tieBreak} className="flex items-center gap-3">
            <span className="w-4 text-right text-figure tabular-nums">{place + 1}</span>
            <span className="w-32">{tieBreakWords[tieBreak]}</span>
            <button type="button" aria-label={moveUpLabel(tieBreakWords[tieBreak])} disabled={place === 0} onClick={() => move(place, place - 1)} className={MOVE_ACTION}>
              {moveUpWords}
            </button>
            <button
              type="button"
              aria-label={moveDownLabel(tieBreakWords[tieBreak])}
              disabled={place === tieBreaks.length - 1}
              onClick={() => move(place, place + 1)}
              className={MOVE_ACTION}
            >
              {moveDownWords}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
