import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { AREAS, type Area } from "../../convex/lineup/pitch";
import type { LeagueSettings } from "../../convex/rules/leagueSettingsPart";
import { ODD_TEAM_OUTS } from "../../convex/table/roundRobin";
import { Loading, PANEL_BODY, PageSection, Panel } from "../ui/Panel";
import { LeagueHeading } from "../leagues/LeagueLinks";
import { Choice } from "../ui/Choice";
import { useRulesEdits } from "../rules/rulesEdits";
import { SaveBar } from "../rules/SaveBar";
import { BoxRefusalContext } from "../rules/blank";
import { TickBox } from "../ui/TickBox";
import { AREA_WORDS } from "../shared/words";
import { DraftPanel } from "./DraftPanel";
import { NumberRow } from "./NumberRow";
import type { LeagueSettingsSeam, SettingsView } from "./seam";
import { TeamOrderPanel } from "./TeamOrderPanel";
import { TradesPanel } from "./TradesPanel";
import { runTwice, WaiversPanel } from "./WaiversPanel";
import type { WaiverOrderType } from "../../convex/rules/leagueRulesShape";
import { RunsPanel, WaiverOrderPanel } from "../myTeam/claims/WaiverOrderPanel";
import { waiverOrderLoadingWords } from "../myTeam/claims/words";
import {
  areaMinimumLabel,
  areaMinimumsHint,
  areaMinimumsLabel,
  blankAreaMinimumWords,
  blankClubMaximumWords,
  blankGamesWords,
  blankPickClockWords,
  blankSquadMaximumWords,
  blankTimeoutsWords,
  blankTradeDeadlineWords,
  clubMaximumHint,
  clubMaximumLabel,
  clubMaximumWords,
  fixturesTitle,
  gamesHint,
  gamesLabel,
  loadingWords,
  noSquadSizeWords,
  oddTeamOutLabel,
  oddTeamOutWords,
  redrawWords,
  runTwiceWords,
  savedWords,
  SETTINGS_TITLE,
  squadMaximumHint,
  squadMaximumLabel,
  squadTitle,
} from "./words";

const AREA_MINIMUMS_ID = "area-minimums";
/** Each hint's id, which its boxes are described by (#915). */
const GAMES_HINT_ID = "settings-games-hint";
const SQUAD_MAXIMUM_HINT_ID = "settings-squad-maximum-hint";
const AREA_MINIMUMS_HINT_ID = "settings-area-minimums-hint";
const CLUB_MAXIMUM_HINT_ID = "settings-club-maximum-hint";
const ODD_TEAM_OUT_CHOICE = "odd-team-out";

/** League settings (Craig, 22 Oct 2026), for a league's commissioners and the admin: the rules
 *  that build the league, apart from players' points, saved from the next gameweek with a letter
 *  to the league: the round robin's two (spec/09), the squad's make-up (spec/03; #341), how
 *  the draft runs (spec/04; #1087), how trades run (spec/08; #383) and how waivers do, beside the
 *  waiver order (spec/08; #1200), with the commissioner's draft order, which saves at once. */
export function SettingsPage({ league, seam }: { league: LeagueSummary; seam: LeagueSettingsSeam }) {
  const view = seam.useSettings(league.leagueId);
  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <PageSection title={SETTINGS_TITLE} className="bg-panel">
        <LeagueHeading name={league.name} />
      </PageSection>
      {view === undefined ? (
        <Loading>{loadingWords}</Loading>
      ) : (
        <Editor league={league} seam={seam} view={view} />
      )}
    </div>
  );
}

/** The settings, and the bar that saves them (rulesEdits.ts says how the draft follows the latest
 *  settings, and what a save over someone else's does). A save refused for a box left without a
 *  number says so beside that box, the cursor in it. */
function Editor({ league, seam, view }: { league: LeagueSummary; seam: LeagueSettingsSeam; view: SettingsView }) {
  const rulesEdits = useRulesEdits(view, (settings, revision) => seam.save(league.leagueId, settings, revision), blankRefusal);
  const { draft, edit } = rulesEdits;
  return (
    <div ref={rulesEdits.area} className="flex flex-col gap-2">
      <BoxRefusalContext value={rulesEdits.boxRefusal}>
        <Panel title={fixturesTitle}>
          <div className={PANEL_BODY}>
            <Choice
              label={oddTeamOutLabel}
              name={ODD_TEAM_OUT_CHOICE}
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
          </div>
        </Panel>
        <SquadPanel draft={draft} edit={edit} />
        <DraftPanel draft={draft.draft} edit={(draftRules) => edit({ ...draft, draft: draftRules })} />
        <TradesPanel trades={draft.trades} edit={(trades) => edit({ ...draft, trades })} />
        <WaiversPanel waivers={draft.waivers} edit={(waivers) => edit({ ...draft, waivers })} />
        <WaiverOrderBeside leagueId={league.leagueId} seam={seam} type={draft.waivers.order} />
        <SaveBar draft={rulesEdits} savedWords={savedWords} />
      </BoxRefusalContext>
      <TeamOrderPanel leagueId={league.leagueId} seam={seam} />
    </div>
  );
}

/** The league's waiver order and its next runs, the order's note following the type about to be
 *  saved: a change starts from today's order, so the order itself stays as it is (#1200). */
function WaiverOrderBeside({ leagueId, seam, type }: { leagueId: LeagueSummary["leagueId"]; seam: LeagueSettingsSeam; type: WaiverOrderType }) {
  const waivers = seam.useWaivers(leagueId);
  if (waivers === undefined) return <Loading>{waiverOrderLoadingWords}</Loading>;
  if (waivers === null) return null;
  return (
    <>
      <WaiverOrderPanel waivers={waivers} type={type} />
      <RunsPanel waivers={waivers} />
    </>
  );
}

/** The squad's make-up (spec/03, Squad make-up): its most players, the fewest in each area, and
 *  the most from one club, off by default. */
function SquadPanel({ draft, edit }: { draft: LeagueSettings; edit: (settings: LeagueSettings) => void }) {
  return (
    <Panel title={squadTitle}>
      <div className={PANEL_BODY}>
        {draft.squadMaximum === null ? (
          <p>{noSquadSizeWords}</p>
        ) : (
          <>
            <NumberRow label={squadMaximumLabel} hintId={SQUAD_MAXIMUM_HINT_ID} value={draft.squadMaximum} onChange={(squadMaximum) => edit({ ...draft, squadMaximum })} />
            <p id={SQUAD_MAXIMUM_HINT_ID} className="text-muted">
              {squadMaximumHint}
            </p>
          </>
        )}
        <div role="group" aria-labelledby={AREA_MINIMUMS_ID} className="flex flex-col gap-1">
          <span id={AREA_MINIMUMS_ID} className="text-soft">
            {areaMinimumsLabel}
          </span>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {AREAS.map((area) => (
              <NumberRow
                key={area}
                label={areaMinimumLabel(area)}
                shown={AREA_WORDS[area]}
                hintId={AREA_MINIMUMS_HINT_ID}
                value={draft.minimumByArea?.[area] ?? NO_MINIMUM}
                onChange={(minimum) => edit({ ...draft, minimumByArea: withMinimum(draft.minimumByArea, area, minimum) })}
              />
            ))}
          </div>
          <p id={AREA_MINIMUMS_HINT_ID} className="text-muted">
            {areaMinimumsHint}
          </p>
        </div>
        <TickBox checked={draft.maxPerClub !== null} onChange={(on) => edit({ ...draft, maxPerClub: on ? NaN : null })}>
          {clubMaximumWords}
        </TickBox>
        {draft.maxPerClub !== null && (
          <>
            <NumberRow label={clubMaximumLabel} hintId={CLUB_MAXIMUM_HINT_ID} value={draft.maxPerClub} onChange={(maxPerClub) => edit({ ...draft, maxPerClub })} />
            <p id={CLUB_MAXIMUM_HINT_ID} className="text-muted">
              {clubMaximumHint}
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

/** An area with no minimum shows as 0, and minimums all 0 are saved as none, as the rules hold
 *  them (null), so putting each back to 0 leaves nothing changed. */
const NO_MINIMUM = 0;

function withMinimum(minimums: LeagueSettings["minimumByArea"], area: Area, minimum: number): LeagueSettings["minimumByArea"] {
  const next = { ...(minimums ?? noMinimums()), [area]: minimum };
  return AREAS.every((each) => next[each] === NO_MINIMUM) ? null : next;
}

const noMinimums = () => Object.fromEntries(AREAS.map((area) => [area, NO_MINIMUM])) as Record<Area, number>;

/** Why settings with a box left without a number aren't sent: the server would refuse them as data
 *  of the wrong shape, never with a reason the commissioner can act on. */
function blankRefusal(settings: LeagueSettings): string | null {
  if (Number.isNaN(settings.gamesPerGameweek)) return blankGamesWords;
  if (Number.isNaN(settings.squadMaximum)) return blankSquadMaximumWords;
  const blankArea = AREAS.find((area) => Number.isNaN(settings.minimumByArea?.[area]));
  if (blankArea !== undefined) return blankAreaMinimumWords(blankArea);
  if (Number.isNaN(settings.maxPerClub)) return blankClubMaximumWords;
  if (Number.isNaN(settings.draft.pickSeconds)) return blankPickClockWords;
  if (Number.isNaN(settings.draft.timeoutsBeforeAutoPick)) return blankTimeoutsWords;
  if (Number.isNaN(settings.trades.deadline)) return blankTradeDeadlineWords;
  if (runTwice(settings.waivers.runs)) return runTwiceWords;
  return null;
}
