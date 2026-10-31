import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { AREAS, type Area } from "../../convex/lineup/pitch";
import type { LeagueSettings } from "../../convex/rules/leagueSettingsPart";
import { ODD_TEAM_OUTS } from "../../convex/table/roundRobin";
import { Loading, PANEL_BODY, PageSection, Panel, PanelNote } from "../ui/Panel";
import { LeagueHeading } from "../leagues/LeagueLinks";
import { Choice } from "../ui/Choice";
import { useRulesDraft } from "../rules/rulesDraft";
import { SaveBar } from "../rules/SaveBar";
import { BoxRefusalContext } from "../rules/blank";
import { TickBox } from "../ui/TickBox";
import { NumberBox } from "../rules/NumberBox";
import { AREA_WORDS } from "../shared/words";
import type { LeagueSettingsSeam, SettingsView } from "./seam";
import {
  areaMinimumLabel,
  areaMinimumsHint,
  areaMinimumsLabel,
  blankAreaMinimumWords,
  blankClubMaximumWords,
  blankGamesWords,
  blankSquadMaximumWords,
  clubMaximumHint,
  clubMaximumLabel,
  clubMaximumWords,
  fixturesTitle,
  gamesHint,
  gamesLabel,
  loadingWords,
  noRulesWords,
  noSquadSizeWords,
  oddTeamOutLabel,
  oddTeamOutWords,
  redrawWords,
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
 *  to the league: the round robin's two (spec/09) and the squad's make-up (spec/03; #341). */
export function SettingsPage({ league, seam }: { league: LeagueSummary; seam: LeagueSettingsSeam }) {
  const view = seam.useSettings(league.leagueId);
  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <PageSection title={SETTINGS_TITLE} className="bg-panel">
        <LeagueHeading name={league.name} />
      </PageSection>
      {view === undefined ? (
        <Loading>{loadingWords}</Loading>
      ) : view === null ? (
        <PanelNote>{noRulesWords}</PanelNote>
      ) : (
        <Editor league={league} seam={seam} view={view} />
      )}
    </div>
  );
}

/** The settings, and the bar that saves them (rulesDraft.ts says how the draft follows the latest
 *  settings, and what a save over someone else's does). A save refused for a box left without a
 *  number says so beside that box, the cursor in it. */
function Editor({ league, seam, view }: { league: LeagueSummary; seam: LeagueSettingsSeam; view: SettingsView }) {
  const rulesDraft = useRulesDraft(view, (settings, revision) => seam.save(league.leagueId, settings, revision), blankRefusal);
  const { draft, edit } = rulesDraft;
  return (
    <div ref={rulesDraft.area} className="flex flex-col gap-2">
      <BoxRefusalContext value={rulesDraft.boxRefusal}>
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
        <SaveBar draft={rulesDraft} savedWords={savedWords} />
      </BoxRefusalContext>
    </div>
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

/** A number's box beside its words (`shown`, its label unless given), named by `label` for screen
 *  readers and described by the hint `hintId` names. A box emptied hands up NaN: a setting left without a number, which `blankRefusal`
 *  stops before the server sees it. */
function NumberRow({ label, shown = label, hintId, value, onChange }: { label: string; shown?: string; hintId: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span aria-hidden className="text-soft">
        {shown}
      </span>
      <NumberBox label={label} hintId={hintId} value={value} onChange={onChange} />
    </div>
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
  return null;
}
