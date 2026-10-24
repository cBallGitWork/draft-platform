import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { LeagueSettings } from "../../convex/rules/leagueSettings";
import { ODD_TEAM_OUTS } from "../../convex/table/roundRobin";
import { Loading, PageSection, PANEL_BODY, PanelNote, PanelTitle } from "../frame/Panel";
import { BackToLeagues } from "../leagues/LeagueLinks";
import { Choice } from "../rules/Choice";
import { useRulesDraft } from "../rules/rulesDraft";
import { SaveBar } from "../rules/SaveBar";
import { NumberBox } from "../scoring/NumberBox";
import type { LeagueSettingsSeam, SettingsView } from "./seam";
import {
  blankGamesWords,
  fixturesTitle,
  gamesHint,
  gamesLabel,
  loadingWords,
  noRulesWords,
  oddTeamOutLabel,
  oddTeamOutWords,
  redrawWords,
  savedWords,
  SETTINGS_TITLE,
} from "./words";

const FIXTURES_TITLE_ID = "fixtures-title";
const ODD_TEAM_OUT_CHOICE = "odd-team-out";

/** League settings (Craig, 22 Oct 2026), for a league's commissioners and the admin: the rules
 *  that build the league, apart from players' points, saved from the next gameweek with a letter
 *  to the league. For now the round robin's two (spec/09). */
export function SettingsPage({ league, seam }: { league: LeagueSummary; seam: LeagueSettingsSeam }) {
  const view = seam.useSettings(league.leagueId);
  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <PageSection title={SETTINGS_TITLE} className="bg-panel">
        <p className="flex flex-wrap items-center gap-4 px-3 py-2">
          <span className="text-lead font-semibold">{league.name}</span>
          <BackToLeagues />
        </p>
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
 *  settings, and what a save over someone else's does). */
function Editor({ league, seam, view }: { league: LeagueSummary; seam: LeagueSettingsSeam; view: SettingsView }) {
  const rulesDraft = useRulesDraft(view, (settings, revision) => seam.save(league.leagueId, settings, revision), blankGamesRefusal);
  const { draft, edit } = rulesDraft;
  return (
    <>
      <section aria-labelledby={FIXTURES_TITLE_ID} className="bg-panel">
        <PanelTitle id={FIXTURES_TITLE_ID}>{fixturesTitle}</PanelTitle>
        <div className={PANEL_BODY}>
          <Choice
            label={oddTeamOutLabel}
            name={ODD_TEAM_OUT_CHOICE}
            options={ODD_TEAM_OUTS}
            words={oddTeamOutWords}
            chosen={draft.oddTeamOut}
            onChoose={(oddTeamOut) => edit({ ...draft, oddTeamOut })}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span aria-hidden className="text-soft">
              {gamesLabel}
            </span>
            <NumberBox label={gamesLabel} value={draft.gamesPerGameweek} onChange={(games) => edit({ ...draft, gamesPerGameweek: games ?? NaN })} />
          </div>
          <p className="text-muted">{gamesHint}</p>
          <p className="text-muted">{redrawWords}</p>
        </div>
      </section>
      <SaveBar draft={rulesDraft} savedWords={savedWords} />
    </>
  );
}

/** Why settings with games a gameweek left without a number aren't sent: the server would refuse
 *  them as data of the wrong shape, never with a reason the commissioner can act on. */
const blankGamesRefusal = (settings: LeagueSettings) => (Number.isNaN(settings.gamesPerGameweek) ? blankGamesWords : null);
