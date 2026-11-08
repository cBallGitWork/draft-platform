import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { MatchupSide } from "../../convex/matchup/matchupShape";
import { runs } from "../leagues/access";
import { PlayerBreakdown } from "./PlayerBreakdown";
import { TeamOverrides } from "./TeamOverride";
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
  GAME_SWITCH_LABEL,
  gameSwitchWords,
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
  const matchup = useLastLoaded(seam.useMatchup(league.leagueId, useMinute(), asked), `${asked.teamId}/${asked.gameweek}/${asked.game}`);
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
        <HeadToHeadMatchup league={league} seam={seam} matchup={matchup} />
      )}
    </PageSection>
  );
}

function HeadToHeadMatchup({ league, seam, matchup }: { league: LeagueSummary; seam: MatchupSeam; matchup: HeadToHead }) {
  const { teamName, gameweek, deadline, game } = matchup;
  if (gameweek === null) return <p className="text-muted">{noGamesWords(teamName)}</p>;
  const gameSwitch = <GameSwitch matchup={matchup} gameweek={gameweek} />;
  // Whoever runs the league overrides a team's total under its name (spec/14 S14.6; #903).
  const overrides = runs(league) ? (sides: readonly MatchupSide[]) => <TeamOverrides leagueId={league.leagueId} gameweek={gameweek} sides={sides} seam={seam} /> : null;
  return (
    <>
      <Stepper matchup={matchup} gameweek={gameweek} />
      {game.kind === "scored" ? (
        <ScoredMatchup leagueId={league.leagueId} game={game} gameSwitch={gameSwitch} overrides={overrides} />
      ) : (
        <div className="bg-panel">
          {game.kind === "none" ? (
            <PanelNote>{noGameWords(teamName, gameweek)}</PanelNote>
          ) : game.kind === "bye" ? (
            <>
              {gameSwitch}
              <PanelNote>{byeWords(teamName)}</PanelNote>
            </>
          ) : (
            <>
              <Fixture teamName={teamName} opponent={game.opponent.kind === "team" ? game.opponent.teamName : leagueAverageWords} />
              {gameSwitch}
              <PanelNote>{game.kind === "notBegun" ? notBegunWords(deadline) : unscoredWords(game.reason)}</PanelNote>
            </>
          )}
        </div>
      )}
    </>
  );
}

const switchClasses = "flex min-h-tap items-center px-3 font-semibold no-underline lg:min-h-bar-control";

/** In a league playing more than one game a gameweek, the switch under the score between the
 *  team's games in it, each a link to that game, the one shown current (Craig, 6 Nov 2026, #521).
 *  Nothing with one game. */
function GameSwitch({ matchup: { teamId, games, gameNumber }, gameweek }: { matchup: HeadToHead; gameweek: number }) {
  if (games.length < 2) return null;
  return (
    <nav aria-label={GAME_SWITCH_LABEL} className="flex flex-wrap justify-center">
      {games.map((against, index) => {
        const number = index + 1;
        const words = gameSwitchWords(number, against.kind === "bye" ? null : against.kind === "team" ? against.teamName : leagueAverageWords);
        return number === gameNumber ? (
          <span key={number} aria-current="page" className={`${switchClasses} text-fact shadow-subtab-active`}>
            {words}
          </span>
        ) : (
          <Link key={number} {...matchupLink(teamId, gameweek, number)} className={`${switchClasses} text-soft hover:text-fact`}>
            {words}
          </Link>
        );
      })}
    </nav>
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

/** The man whose breakdown is open, found afresh in each side as the live matchup moves; none once
 *  neither side holds him (another gameweek's matchup, say). */
function pickedSlot(sides: readonly MatchupSide[], picked: number | null) {
  for (const side of sides) {
    if (side.kind !== "team") continue;
    const found = [...side.lineup.starters, ...side.lineup.bench].find((slot) => slot.playerCode === picked);
    if (found !== undefined) return found;
  }
  return undefined;
}

function ScoredMatchup({
  leagueId,
  game: { team, opponent, commentary, version },
  gameSwitch,
  overrides,
}: {
  leagueId: string;
  game: Scored;
  gameSwitch: ReactNode;
  /** The team override's controls under the sides' names, for whoever runs the league; null for
   *  anyone else. */
  overrides: ((sides: readonly MatchupSide[]) => ReactNode) | null;
}) {
  const provisional = team.provisional || opponent.provisional;
  const [picked, setPicked] = useState<number | null>(null);
  // Tapping the man whose breakdown is open closes it.
  const picking = { picked, pick: (playerCode: number) => setPicked((current) => (current === playerCode ? null : playerCode)) };
  const slot = pickedSlot([team, opponent], picked);
  return (
    <>
      <section aria-label={SCORE_LABEL} className="bg-panel shadow-bevel-panel">
        <Fixture teamName={sideName(team)} opponent={sideName(opponent)} score={scoreWords(team.points, opponent.points)} />
        {overrides?.([team, opponent])}
        <p aria-live="polite" className={`px-3 pb-2 text-center ${provisional ? "text-derived" : "text-muted"}`}>
          {provisional ? provisionalWords : finalWords}
        </p>
        {gameSwitch}
      </section>
      {slot !== undefined && <PlayerBreakdown leagueId={leagueId} slot={slot} version={version} close={() => setPicked(null)} />}
      <div className={PANEL_COLUMNS}>
        <SidePanel side={team} picking={picking} />
        <SidePanel side={opponent} picking={picking} />
        <Vidiprinter commentary={commentary} title={VIDIPRINTER_TITLE} noLinesWords={noCommentaryWords} className="lg:col-span-2" />
      </div>
    </>
  );
}
