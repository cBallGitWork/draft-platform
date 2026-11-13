import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { FIRST_GAMEWEEK } from "../../convex/gameweeks/usedGameweeks";
import { GameweekStepper } from "../ui/GameweekStepper";
import { Loading, PAGE_STACK, PageSection, Panel, PANEL_COLUMNS, PanelNote } from "../ui/Panel";
import { PlateTabs } from "../ui/PlateTabs";
import { ClubLink } from "./ClubLink";
import { openingGameweek } from "./openingGameweek";
import { matchPath } from "./paths";
import { TablePanel } from "./TablePanel";
import type { GameweekMatch, PremierLeagueSeam } from "./seam";
import { MatchState } from "./MatchState";
import {
  COMPETITIONS,
  competitionsLabel,
  competitionWords,
  dayWords,
  FIXTURES_TITLE,
  FOOTBALL_TITLE,
  goalsWords,
  liveWords,
  loadingGameweekWords,
  loadingWords,
  matchesListLabel,
  matchLinkLabel,
  noDateWords,
  noMatchesWords,
  versusWords,
  type Competition,
} from "./words";

/** The Football section (spec/18), the real competitions: a tab for each the league plays on the
 *  title plate, which is the tabs only, then the competition's fixtures and results, a gameweek at
 *  a time, beside its table (docs/design/approved/premier-league/). No fixture difficulty and no
 *  count of owned players here (spec/18). */
export function PremierLeaguePage({ seam }: { seam: PremierLeagueSeam }) {
  const gameweeks = seam.useGameweeks();
  const [competition, choose] = useState<Competition>(COMPETITIONS[0]);
  return (
    <PageSection title={FOOTBALL_TITLE} plate={false} className={PAGE_STACK}>
      <div className="flex min-h-tap bg-plate text-lead shadow-bevel-plate">
        <PlateTabs label={competitionsLabel} tabs={COMPETITIONS} words={competitionWords} chosen={competition} choose={choose} alone />
      </div>
      <div className={PANEL_COLUMNS}>
        {gameweeks === undefined ? (
          <Panel title={FIXTURES_TITLE}>
            <Loading className="px-3 py-2">{loadingWords}</Loading>
          </Panel>
        ) : (
          <GameweekMatches seam={seam} opening={openingGameweek(gameweeks.firstKickoffs, Date.now())} last={gameweeks.seasonGameweeks} />
        )}
        <TablePanel seam={seam} competition={competition} />
      </div>
    </PageSection>
  );
}

/** One gameweek's matches under the ◄ GW ► stepper on the panel's plate, over the season's
 *  gameweeks to its `last`, opening on `opening`; live, so a score moves as the feeds read it, and
 *  Live after the title while one of them is being played. */
function GameweekMatches({ seam, opening, last }: { seam: PremierLeagueSeam; opening: number; last: number }) {
  const [gameweek, choose] = useState(opening);
  const matches = seam.useGameweekMatches(gameweek);
  // Being played, as matchScores.ts's isPlaying says on the server, which the browser can't import.
  const live = matches?.some(({ score }) => score?.state === "live" || score?.state === "halfTime") ?? false;
  const title = (
    <>
      {FIXTURES_TITLE}
      {live && <span className="ml-3 font-semibold text-event">{liveWords}</span>}
    </>
  );
  const stepper = (
    <GameweekStepper
      gameweek={gameweek}
      hasPrevious={gameweek > FIRST_GAMEWEEK}
      hasNext={gameweek < last}
      onPrevious={() => choose(gameweek - 1)}
      onNext={() => choose(gameweek + 1)}
    />
  );
  return (
    <Panel title={title} aside={stepper}>
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
    </Panel>
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
      <MatchState kickoff={kickoff} score={score} long={false} />
      <span className="text-right font-semibold">
        <ClubLink club={home} />
      </span>
      <Link
        to={matchPath(fixtureCode)}
        aria-label={matchLinkLabel(home.name, away.name, goals)}
        className={`flex min-h-tap items-center justify-center lg:min-h-0 ${goals === null ? "text-muted" : "whitespace-nowrap font-bold text-figure"}`}
      >
        {goals ?? versusWords}
      </Link>
      <span className="text-left font-semibold">
        <ClubLink club={away} />
      </span>
    </li>
  );
}
