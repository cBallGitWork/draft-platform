import { Link } from "@tanstack/react-router";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { Loading, PAGE_STACK, PageSection, PANEL_COLUMNS, PanelNote } from "../ui/Panel";
import { useLastLoaded } from "../shared/useLastLoaded";
import { useMinute } from "../shared/useMinute";
import { matchupLink } from "./paths";
import { sideName, SidePanel } from "./SidePanel";
import { Vidiprinter } from "./Vidiprinter";
import type { Matchup, MatchupAsked, MatchupSeam } from "./seam";
import {
  byeWords,
  finalWords,
  gameweekWords,
  leagueAverageWords,
  loadingWords,
  MATCHUP_TITLE,
  nextGlyph,
  nextLabel,
  noCommentaryWords,
  noGamesWords,
  noGameWords,
  noRulesWords,
  notBegunWords,
  noTeamWords,
  previousGlyph,
  previousLabel,
  provisionalWords,
  SCORE_LABEL,
  scoreWords,
  totalPointsWords,
  unscoredWords,
  versusWords,
  VIDIPRINTER_TITLE,
} from "./words";

type HeadToHead = Extract<Matchup, { kind: "headToHead" }>;
type Scored = Extract<HeadToHead["game"], { kind: "scored" }>;

/** The matchup (spec/10, The matchup, as a live match; spec/12): one head-to-head in one gameweek,
 *  the totals as the score at the top, both lineups under it, live until every match is final.
 *  A manager lands on My team (spec/12); this is a tab away, and any fixture links here. */
export function MatchupPage({ league, seam, asked }: { league: LeagueSummary; seam: MatchupSeam; asked: MatchupAsked }) {
  // The minute is in the query's arguments, and a live matchup mustn't blank every minute; another
  // matchup asked for loads afresh.
  const matchup = useLastLoaded(seam.useMatchup(league.leagueId, useMinute(), asked), `${asked.teamId}/${asked.gameweek}`);
  return (
    <PageSection title={MATCHUP_TITLE} className={PAGE_STACK}>
      {matchup === undefined ? (
        <Loading>{loadingWords}</Loading>
      ) : matchup === null ? (
        <p className="text-muted">{noRulesWords}</p>
      ) : matchup.kind === "totalPoints" ? (
        <p className="text-muted">{totalPointsWords}</p>
      ) : matchup.kind === "noTeam" ? (
        <p className="text-muted">{noTeamWords}</p>
      ) : (
        <HeadToHeadMatchup matchup={matchup} />
      )}
    </PageSection>
  );
}

function HeadToHeadMatchup({ matchup }: { matchup: HeadToHead }) {
  const { teamName, gameweek, deadline, game } = matchup;
  if (gameweek === null) return <p className="text-muted">{noGamesWords(teamName)}</p>;
  return (
    <>
      <Stepper matchup={matchup} gameweek={gameweek} />
      {game.kind === "scored" ? (
        <ScoredMatchup game={game} />
      ) : (
        <div className="bg-panel">
          {game.kind === "none" ? (
            <PanelNote>{noGameWords(teamName, gameweek)}</PanelNote>
          ) : game.kind === "bye" ? (
            <PanelNote>{byeWords(teamName)}</PanelNote>
          ) : (
            <>
              <Fixture teamName={teamName} opponent={game.opponent.kind === "team" ? game.opponent.teamName : leagueAverageWords} />
              <PanelNote>{game.kind === "notBegun" ? notBegunWords(deadline) : unscoredWords(game.reason)}</PanelNote>
            </>
          )}
        </div>
      )}
    </>
  );
}

const stepClasses = "flex min-w-tap items-center justify-center text-lead font-bold";

/** CM's ◄ GW ► stepper over the gameweeks the team plays, each a link to that gameweek's matchup. */
function Stepper({ matchup: { teamId, gameweeks }, gameweek }: { matchup: HeadToHead; gameweek: number }) {
  const index = gameweeks.indexOf(gameweek);
  const step = (to: number | undefined, label: string, glyph: string) =>
    to === undefined ? (
      <span aria-hidden="true" className={`${stepClasses} text-muted`}>
        {glyph}
      </span>
    ) : (
      <Link {...matchupLink(teamId, to)} aria-label={label} className={`${stepClasses} no-underline hover:bg-plate`}>
        <span aria-hidden="true">{glyph}</span>
      </Link>
    );
  return (
    <nav aria-label={gameweekWords(gameweek)} className="flex min-h-tap items-stretch bg-stepper">
      {step(index > 0 ? gameweeks[index - 1] : undefined, previousLabel, previousGlyph)}
      <h2 className="flex grow items-center justify-center text-lead font-bold">{gameweekWords(gameweek)}</h2>
      {step(index !== -1 && index < gameweeks.length - 1 ? gameweeks[index + 1] : undefined, nextLabel, nextGlyph)}
    </nav>
  );
}

/** Two sides, the score between them once there is one. */
function Fixture({ teamName, opponent, score }: { teamName: string; opponent: string; score?: string }) {
  return (
    <p className="grid grid-cols-sides items-baseline gap-3 px-3 py-2 text-lead font-bold sm:text-title">
      <span className="display-face text-right">{teamName}</span>
      {score === undefined ? <span className="text-muted">{versusWords}</span> : <span className="text-figure whitespace-nowrap">{score}</span>}
      <span className="display-face">{opponent}</span>
    </p>
  );
}

function ScoredMatchup({ game: { team, opponent, commentary } }: { game: Scored }) {
  const provisional = team.provisional || opponent.provisional;
  return (
    <>
      <section aria-label={SCORE_LABEL} className="bg-panel shadow-bevel-panel">
        <Fixture teamName={sideName(team)} opponent={sideName(opponent)} score={scoreWords(team.points, opponent.points)} />
        <p aria-live="polite" className={`px-3 pb-2 text-center ${provisional ? "text-derived" : "text-muted"}`}>
          {provisional ? provisionalWords : finalWords}
        </p>
      </section>
      <div className={PANEL_COLUMNS}>
        <SidePanel side={team} />
        <SidePanel side={opponent} />
        <Vidiprinter commentary={commentary} title={VIDIPRINTER_TITLE} noLinesWords={noCommentaryWords} className="lg:col-span-2" />
      </div>
    </>
  );
}
