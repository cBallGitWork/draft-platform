import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { MatchupSide } from "../../convex/matchup/matchupShape";
import { BYE, FIRST_GAME } from "../../convex/table/teamGames";
import type { Matchup } from "./seam";
import { matchupLink } from "./paths";
import { sideName } from "./SidePanel";
import { onPitch } from "./SidePitch";
import {
  figureWords,
  finalWords,
  GAME_SWITCH_LABEL,
  gameSwitchWords,
  gameweekShort,
  gameweekWords,
  leagueAverageWords,
  nextGlyph,
  nextLabel,
  previousGlyph,
  previousLabel,
  provisionalWords,
  SCORE_LABEL,
  scoreWords,
  standingWords,
  versusWords,
} from "./words";

// The matchup's head (spec/10, The matchup, as a live match), as the approved picture draws it:
// CM's ◄ GW ► stepper, then both team names, each with how many of its men have played, are live
// and are still to play, and the totals between them as two big figure plates, "Provisional" or
// "Final" under them, and the game switch under that in a league with more than one game a
// gameweek. Whoever runs the league has Override total under each name (spec/14 S14.6; #903).

export type HeadToHead = Extract<Matchup, { kind: "headToHead" }>;

const switchClasses = "flex min-h-tap items-center px-3 font-semibold no-underline lg:min-h-bar-control";

/** In a league playing more than one game a gameweek, the switch under the score between the
 *  team's games in it, each a link to that game, the one shown current (Craig, 6 Nov 2026, #521).
 *  Nothing with one game. */
export function GameSwitch({ matchup: { teamId, games, gameNumber }, gameweek }: { matchup: HeadToHead; gameweek: number }) {
  if (games.length < 2) return null;
  return (
    <nav aria-label={GAME_SWITCH_LABEL} className="flex flex-wrap justify-center">
      {games.map((against, index) => {
        const number = FIRST_GAME + index;
        const words = gameSwitchWords(number, against.kind === BYE ? null : against.kind === "team" ? against.teamName : leagueAverageWords);
        return number === gameNumber ? (
          <span key={number} aria-current="page" className={`${switchClasses} bg-name-plate text-fact shadow-subtab-active`}>
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
export function Stepper({ matchup: { teamId, gameweeks }, gameweek }: { matchup: HeadToHead; gameweek: number }) {
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
    <nav aria-label={gameweekWords(gameweek)} className="flex min-h-tap shrink-0 items-stretch bg-stepper">
      {step(index > 0 ? gameweeks[index - 1] : undefined, previousLabel, previousGlyph)}
      <h2 className="flex grow items-center justify-center px-3 text-lead font-bold">
        <span aria-hidden="true">{gameweekShort(gameweek)}</span>
        <span className="sr-only">{gameweekWords(gameweek)}</span>
      </h2>
      {step(index !== -1 && index < gameweeks.length - 1 ? gameweeks[index + 1] : undefined, nextLabel, nextGlyph)}
    </nav>
  );
}

/** Two sides, before there is a score. */
export function Fixture({ teamName, opponent }: { teamName: string; opponent: string }) {
  return (
    <p className="grid grid-cols-sides items-baseline gap-3 px-3 py-2 text-lead font-bold sm:text-title">
      <span className="display-face text-right">{teamName}</span>
      <span className="text-muted">{versusWords}</span>
      <span className="display-face">{opponent}</span>
    </p>
  );
}

/** How many of the men standing for a team have played, are on and are still to play; none for the
 *  league's average. */
function Standing({ side }: { side: MatchupSide }) {
  if (side.kind !== "team") return null;
  const kinds = onPitch(side).map(({ status }) => status.kind);
  const count = (kind: string) => kinds.filter((each) => each === kind).length;
  return (
    <p className="text-soft">
      {standingWords.played(count("finished"))}, <span className="text-derived">{standingWords.live(count("playing"))}</span>,{" "}
      {standingWords.toPlay(count("yetToPlay"))}
    </p>
  );
}

/** A team's name over its standing, and its override control, if any, centred in its outer half of
 *  the band (the approved picture). */
function TeamHead({ side, control }: { side: MatchupSide; control: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <p className="text-lead wrap-break-word display-face lg:text-title">{sideName(side)}</p>
      <Standing side={side} />
      {control}
    </div>
  );
}

/** A total on its plate. */
const ScorePlate = ({ points }: { points: number }) => <span className="bg-name-plate px-2 text-title font-bold text-figure lg:px-3 lg:text-score">{figureWords(points)}</span>;

/** The head of a scored matchup. `overrides` wraps the head's middle in the team override's
 *  controls, for whoever runs the league; null for anyone else. */
export function ScoredHead({
  stepper,
  team,
  opponent,
  gameSwitch,
  overrides,
}: {
  stepper: ReactNode;
  team: MatchupSide;
  opponent: MatchupSide;
  gameSwitch: ReactNode;
  overrides: ((layout: (controlOf: (side: MatchupSide) => ReactNode) => ReactNode) => ReactNode) | null;
}) {
  const provisional = team.provisional || opponent.provisional;
  const middle = (controlOf: (side: MatchupSide) => ReactNode) => (
    <div className="grid grid-cols-sides items-start gap-x-2 px-2 py-2 lg:gap-x-6 lg:px-4">
      <TeamHead side={team} control={controlOf(team)} />
      <div className="flex flex-col items-center gap-1">
        <p className="flex gap-2">
          <span className="sr-only">{scoreWords(team.points, opponent.points)}</span>
          <span aria-hidden="true" className="flex gap-2">
            <ScorePlate points={team.points} />
            <ScorePlate points={opponent.points} />
          </span>
        </p>
        <p aria-live="polite" className={provisional ? "text-soft" : "text-fact"}>
          {provisional ? provisionalWords : finalWords}
        </p>
        {gameSwitch}
      </div>
      <TeamHead side={opponent} control={controlOf(opponent)} />
    </div>
  );
  return (
    // On a phone the stepper sits over the rest, as it does with no score.
    <section aria-label={SCORE_LABEL} className="flex flex-col bg-plate shadow-bevel-plate lg:flex-row">
      {stepper}
      <div className="min-w-0 grow">{overrides === null ? middle(() => null) : overrides(middle)}</div>
    </section>
  );
}
