import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { FIRST_GAMEWEEK, GAMEWEEKS } from "../../convex/gameweeks/usedGameweeks";
import { GameweekStepper } from "../frame/GameweekStepper";
import { Loading, PageSection, Panel, PanelNote } from "../frame/Panel";
import { ClubName } from "./ClubName";
import { openingGameweek } from "./openingGameweek";
import { matchPath } from "./paths";
import { TablePanel } from "./TablePanel";
import type { GameweekMatch, PremierLeagueSeam } from "./seam";
import {
  clockWords,
  dayWords,
  FIXTURES_TITLE,
  fullTime,
  goalsWords,
  halfTime,
  kickoffWords,
  loadingGameweekWords,
  loadingWords,
  matchesListLabel,
  matchLinkLabel,
  noDateWords,
  noMatchesWords,
  PREMIER_LEAGUE_TITLE,
  versusWords,
} from "./words";

/** The Premier League section (spec/18), the real competition: its fixtures and results, a
 *  gameweek at a time, beside its table. No fixture difficulty and no count of owned players here
 *  (spec/18). */
export function PremierLeaguePage({ seam }: { seam: PremierLeagueSeam }) {
  const firstKickoffs = seam.useFirstKickoffs();
  return (
    <PageSection title={PREMIER_LEAGUE_TITLE} className="flex max-w-6xl flex-col gap-2">
      <div className="grid items-start gap-2 lg:grid-cols-2">
        <Panel title={FIXTURES_TITLE}>
          {firstKickoffs === undefined ? (
            <Loading className="px-3 py-2">{loadingWords}</Loading>
          ) : (
            <GameweekMatches seam={seam} opening={openingGameweek(firstKickoffs, Date.now())} />
          )}
        </Panel>
        <TablePanel seam={seam} />
      </div>
    </PageSection>
  );
}

/** One gameweek's matches under the ◄ GW ► stepper, over the season's gameweeks, opening on
 *  `opening`; live, so a score moves as the feeds read it. */
function GameweekMatches({ seam, opening }: { seam: PremierLeagueSeam; opening: number }) {
  const [gameweek, choose] = useState(opening);
  const matches = seam.useGameweekMatches(gameweek);
  return (
    <>
      <GameweekStepper
        gameweek={gameweek}
        hasPrevious={gameweek > FIRST_GAMEWEEK}
        hasNext={gameweek < GAMEWEEKS}
        onPrevious={() => choose(gameweek - 1)}
        onNext={() => choose(gameweek + 1)}
      />
      {matches === undefined ? (
        <Loading className="px-3 py-2">{loadingGameweekWords(gameweek)}</Loading>
      ) : matches.length === 0 ? (
        <PanelNote>{noMatchesWords(gameweek)}</PanelNote>
      ) : (
        <div role="group" aria-label={matchesListLabel(gameweek)}>
          {byDay(matches).map(({ day, dayMatches }) => (
            <section key={day} aria-label={day}>
              <h4 className="bg-plate px-3 py-1 font-semibold">{day}</h4>
              <ul>
                {dayMatches.map((match) => (
                  <MatchRow key={match.fixtureCode} match={match} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/** The matches grouped by the day they kick off, in the order given (kickoff order, those with no
 *  time last). */
function byDay(matches: readonly GameweekMatch[]): { day: string; dayMatches: GameweekMatch[] }[] {
  const days: { day: string; dayMatches: GameweekMatch[] }[] = [];
  for (const match of matches) {
    const day = match.kickoff === null ? noDateWords : dayWords(match.kickoff);
    const last = days.at(-1);
    if (last?.day === day) last.dayMatches.push(match);
    else days.push({ day, dayMatches: [match] });
  }
  return days;
}

/** A match: where it stands (its kickoff, the clock, half-time or full time), the home club, the
 *  score or "v" before kickoff as a link to its match page (spec/18), and the away club. */
function MatchRow({ match: { fixtureCode, kickoff, home, away, score } }: { match: GameweekMatch }) {
  const goals = goalsWords(score);
  return (
    <li className="grid grid-cols-match-row items-center gap-2 border-b border-panel-rule px-3 py-1 text-lead">
      <MatchState kickoff={kickoff} score={score} />
      <span className="text-right font-semibold">
        <ClubName club={home} />
      </span>
      <Link
        to={matchPath(fixtureCode)}
        aria-label={matchLinkLabel(home.name, away.name, goals)}
        className={`flex min-h-tap items-center justify-center lg:min-h-0 ${goals === null ? "text-muted" : "whitespace-nowrap font-bold text-figure"}`}
      >
        {goals ?? versusWords}
      </Link>
      <span className="text-left font-semibold">
        <ClubName club={away} />
      </span>
    </li>
  );
}

function MatchState({ kickoff, score }: Pick<GameweekMatch, "kickoff" | "score">) {
  switch (score?.state) {
    case "live":
      return <span className="font-semibold text-derived">{clockWords(score.clockLabel, score.minutes)}</span>;
    case "halfTime":
      return (
        <abbr title={halfTime.long} className="font-semibold text-derived no-underline">
          {halfTime.short}
        </abbr>
      );
    case "fullTime":
      return (
        <abbr title={fullTime.long} className="text-muted no-underline">
          {fullTime.short}
        </abbr>
      );
    default:
      return <span className="text-muted">{kickoff === null ? "" : kickoffWords(kickoff)}</span>;
  }
}
