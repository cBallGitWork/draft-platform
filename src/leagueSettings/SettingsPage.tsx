import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { AREAS } from "../../convex/lineup/pitch";
import type { LeagueSettings } from "../../convex/rules/leagueSettingsPart";
import { ODD_TEAM_OUTS } from "../../convex/table/roundRobin";
import { Loading, PAGE_STACK, PANEL_BODY, PageSection, Panel, PanelNote } from "../ui/Panel";
import { PlateTabs } from "../ui/PlateTabs";
import { Choice } from "../ui/Choice";
import { SETTINGS_DRAFT_HASH } from "./paths";
import { useRulesEdits, type RulesEdits } from "../rules/rulesEdits";
import { useDraftStartEdit, type DraftStartEdit } from "./DraftStartRow";
import { useLastLoaded } from "../shared/useLastLoaded";
import { SaveBar } from "../rules/SaveBar";
import { BoxRefusalContext } from "../rules/blank";
import { DraftPanel } from "./DraftPanel";
import { NumberRow } from "./NumberRow";
import { ScoringStartRow } from "./ScoringStartRow";
import type { LeagueSettingsSeam, SettingsView } from "./seam";
import { SquadPanel } from "./SquadPanel";
import { TeamOrderPanel } from "./TeamOrderPanel";
import { TradesPanel } from "./TradesPanel";
import { runTwice, WaiversPanel } from "./WaiversPanel";
import type { WaiverOrderType } from "../../convex/rules/leagueRulesShape";
import { RunsPanel, WaiverOrderPanel } from "../myTeam/claims/WaiverOrderPanel";
import { EveryTeamTable } from "../myTeam/claims/EveryTeamTable";
import type { WaiversView } from "../myTeam/claims/seam";
import { CLAIMS_TITLE, everyTeamClaimsLoadingWords, noClaimsWords, teamsWithoutClaimsWords, waiverOrderLoadingWords } from "../myTeam/claims/words";
import {
  blankAreaMinimumWords,
  blankClubMaximumWords,
  blankGamesWords,
  blankPickClockWords,
  blankSquadMaximumWords,
  blankTimeoutsWords,
  blankTradeDeadlineWords,
  fixturesTitle,
  gamesHint,
  gamesLabel,
  loadingWords,
  oddTeamOutLabel,
  oddTeamOutWords,
  redrawWords,
  runTwiceWords,
  draftStartSavedWords,
  savedWords,
  SETTINGS_TABS,
  SETTINGS_TITLE,
  settingsTabsLabel,
  settingsTabWords,
  type SettingsTab,
} from "./words";

/** The games box's hint's id, which the box is described by (#915). */
const GAMES_HINT_ID = "settings-games-hint";
const ODD_TEAM_OUT_CHOICE = "odd-team-out";

/** League settings (Craig, 22 Oct 2026), for a league's commissioners and the admin: the rules
 *  that build the league, apart from players' points, saved from the next gameweek with a letter
 *  to the league, a tab each on the title plate (docs/design/approved/settings/; #1034): the
 *  round robin's two (spec/09), the squad's make-up (spec/03; #341), how the draft runs and when
 *  it starts (spec/04; #1087, #1476), how waivers run, beside the waiver order (spec/08; #1200),
 *  how trades do (spec/08; #383), and the commissioner's draft order, which saves at once. */
export function SettingsPage({ league, seam }: { league: LeagueSummary; seam: LeagueSettingsSeam }) {
  // The settings are asked again each minute (liveSettings.ts), and the next minute's load mustn't
  // unmount the editor and throw its unsaved edits away; another league's loads afresh.
  const view = useLastLoaded(seam.useSettings(league.leagueId), league.leagueId);
  // The draft room's "Change the start" opens the Draft tab (SETTINGS_DRAFT_HASH; #1476).
  const hash = useRouterState({ select: (state) => state.location.hash });
  const [tab, choose] = useState<SettingsTab>(hash === SETTINGS_DRAFT_HASH ? "draft" : "fixtures");
  const aside = (
    <>
      <PlateTabs label={settingsTabsLabel} tabs={SETTINGS_TABS} words={settingsTabWords} chosen={tab} choose={choose} />
      <span className="self-center text-soft">{league.name}</span>
    </>
  );
  return (
    <PageSection title={SETTINGS_TITLE} aside={aside} className={PAGE_STACK}>
      {view === undefined ? <Loading>{loadingWords}</Loading> : <Editor league={league} seam={seam} view={view} tab={tab} />}
    </PageSection>
  );
}

/** The chosen tab's settings, its panels on the left and what they lead to on the right (the
 *  approved pictures), and the bar that saves them at the end of each tab but Draft order, whose
 *  moves save at once. Edits are kept as the tabs switch, and one Save sends them all
 *  (rulesEdits.ts says how the draft follows the latest settings, and what a save over someone
 *  else's does). A save refused for a box left without a number says so beside that box, the
 *  cursor in it. */
function Editor({ league, seam, view, tab }: { league: LeagueSummary; seam: LeagueSettingsSeam; view: SettingsView; tab: SettingsTab }) {
  const rulesEdits = useRulesEdits(view, (settings, revision) => seam.save(league.leagueId, settings, revision), blankRefusal);
  const { draft, edit } = rulesEdits;
  const start = useDraftStartEdit(league.leagueId, seam);
  const bar = withDraftStart(rulesEdits, start);
  return (
    <div ref={rulesEdits.area} className="grid items-start gap-2 lg:grid-cols-table">
      <div className={PAGE_STACK}>
        <BoxRefusalContext value={rulesEdits.boxRefusal}>
          {tab === "fixtures" && <FixturesPanel league={league} seam={seam} draft={draft} edit={edit} />}
          {tab === "squad" && <SquadPanel draft={draft} edit={edit} />}
          {tab === "draft" && <DraftPanel draft={draft.draft} edit={(draftRules) => edit({ ...draft, draft: draftRules })} start={start} />}
          {tab === "waivers" && <WaiversPanel waivers={draft.waivers} edit={(waivers) => edit({ ...draft, waivers })} />}
          {tab === "trades" && <TradesPanel trades={draft.trades} seasonGameweeks={view.seasonGameweeks} edit={(trades) => edit({ ...draft, trades })} />}
          {tab === "draftOrder" ? (
            <TeamOrderPanel leagueId={league.leagueId} seam={seam} />
          ) : (
            <SaveBar draft={bar} savedWords={savedWords} savedNote={start.saved && bar.unchanged ? draftStartSavedWords : null} />
          )}
        </BoxRefusalContext>
      </div>
      {tab === "waivers" && (
        <div className={PAGE_STACK}>
          <WaiverOrderBeside league={league} seam={seam} type={draft.waivers.order} />
        </div>
      )}
    </div>
  );
}

/** The Fixtures tab's panel: the scoring start (saved at once) and the round robin's two (spec/09). */
function FixturesPanel({ league, seam, draft, edit }: { league: LeagueSummary; seam: LeagueSettingsSeam; draft: LeagueSettings; edit: (settings: LeagueSettings) => void }) {
  return (
    <Panel title={fixturesTitle}>
      <div className={PANEL_BODY}>
        <ScoringStartRow leagueId={league.leagueId} seam={seam} />
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
  );
}

/** The bar's edits: the settings and the draft's start date, saved together (Craig, 11 Nov 2026, on
 *  #1476). The date goes first, as its own change, not a rules row: a refused date, said beside its
 *  box, stops the save; a refused settings save, said in the bar, leaves the date saved. A date
 *  saved alone is said in the bar, not an earlier settings save's gameweek (#1780). */
function withDraftStart(rulesEdits: RulesEdits<LeagueSettings>, start: DraftStartEdit): RulesEdits<LeagueSettings> {
  return {
    ...rulesEdits,
    unchanged: rulesEdits.unchanged && start.unchanged,
    savedFrom: start.saved ? null : rulesEdits.savedFrom,
    busy: rulesEdits.busy || start.busy,
    drop() {
      rulesEdits.drop();
      start.drop();
    },
    async saveDraft() {
      if (!start.unchanged && !(await start.save())) return;
      if (rulesEdits.unchanged) return;
      await rulesEdits.saveDraft();
      start.forgetSaved();
    },
  };
}

/** The league's waiver order and its next runs, the order's note following the type about to be
 *  saved: a change starts from today's order, so the order itself stays as it is (#1200). A
 *  commissioner with no team, and so no Transactions tab, sees every team's pending claims with
 *  them (Craig, 11 Nov 2026, on #1487). */
function WaiverOrderBeside({ league, seam, type }: { league: LeagueSummary; seam: LeagueSettingsSeam; type: WaiverOrderType }) {
  const waivers = seam.useWaivers(league.leagueId);
  if (waivers === undefined) return <Loading>{waiverOrderLoadingWords}</Loading>;
  if (waivers === null) return null;
  return (
    <>
      {league.teamName === null && <EveryTeamClaims leagueId={league.leagueId} seam={seam} waivers={waivers} />}
      <WaiverOrderPanel waivers={waivers} type={type} />
      <RunsPanel waivers={waivers} />
    </>
  );
}

/** Every team's pending claims, read-only, team by team in the waiver order (EveryTeamTable.tsx). */
function EveryTeamClaims({ leagueId, seam, waivers }: { leagueId: LeagueSummary["leagueId"]; seam: LeagueSettingsSeam; waivers: WaiversView }) {
  const claims = seam.usePendingClaims(leagueId);
  if (claims === undefined) return <Loading>{everyTeamClaimsLoadingWords}</Loading>;
  const withoutClaims = waivers.teams.length - new Set(claims.map(({ teamId }) => teamId)).size;
  return (
    <Panel title={CLAIMS_TITLE} aside={<span className="text-soft">{teamsWithoutClaimsWords(withoutClaims)}</span>}>
      {claims.length === 0 ? <PanelNote>{noClaimsWords}</PanelNote> : <EveryTeamTable claims={claims} waivers={waivers} />}
    </Panel>
  );
}

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
