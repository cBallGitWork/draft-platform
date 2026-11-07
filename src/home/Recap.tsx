import { Link } from "@tanstack/react-router";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { DateBlock } from "../mail/DateBlock";
import { matchupLink } from "../matchup/paths";
import { Loading, PAGE_STACK, PageSection, Panel, PanelNote } from "../ui/Panel";
import { PanelLink } from "./PanelLink";
import { recapLink } from "./paths";
import type { HomeSeam, Recap } from "./seam";
import { backHomeLink, changedMatchupLink, loadingRecapWords, noRecapWords, readRecapLink, recapTitle, scoreChangedWords } from "./words";
import { HOME_PATH } from "../frame/menu";

// League home's weekly recap (spec/12, League home; #387): its panel on the home, a few lines and
// Read the recap, and the page that opens, the recap whole. Under each, once a score has changed
// since it was written, a line saying so links to that matchup (Craig, 6 Nov 2026).

/** The line under the recap once a score has changed since it was written; nothing before. */
function ScoreChanged({ recap }: { recap: Recap }) {
  if (recap.changedTeamId === null) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-2 px-3 pt-2 text-muted">
      {scoreChangedWords}
      <Link {...matchupLink(recap.changedTeamId, recap.gameweek)} className="min-h-tap text-body">
        {changedMatchupLink}
      </Link>
    </p>
  );
}

/** The recap on League home: its opening lines, and Read the recap. */
export function RecapPanel({ recap }: { recap: Recap }) {
  return (
    <Panel title={recapTitle(recap.gameweek)}>
      <p className="line-clamp-4 whitespace-pre-line px-3 pt-2">{recap.text}</p>
      <ScoreChanged recap={recap} />
      <PanelLink {...recapLink(recap.gameweek)}>{readRecapLink}</PanelLink>
    </Panel>
  );
}

/** Read the recap's page: the league's recap of the gameweek, whole, dated. */
export function RecapPage({ league, seam, gameweek }: { league: LeagueSummary; seam: HomeSeam; gameweek: number }) {
  const recap = seam.useRecap(league.leagueId, gameweek);
  return (
    <PageSection title={recapTitle(gameweek)} className={PAGE_STACK}>
      <div className="bg-panel">
        {recap === undefined ? (
          <Loading>{loadingRecapWords}</Loading>
        ) : recap === null ? (
          <PanelNote>{noRecapWords(gameweek)}</PanelNote>
        ) : (
          <article className="flex flex-col gap-1 px-3 pt-2">
            <DateBlock at={recap.writtenAt} />
            <p className="whitespace-pre-line">{recap.text}</p>
          </article>
        )}
        {recap && <ScoreChanged recap={recap} />}
        <PanelLink to={HOME_PATH}>{backHomeLink}</PanelLink>
      </div>
    </PageSection>
  );
}
