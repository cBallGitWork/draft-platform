import { useState } from "react";
import { isLocked } from "../../convex/gameweeks/deadline";
import { PanelTitle } from "../frame/Panel";
import type { LeagueTable } from "./seam";
import {
  byeWords,
  FIXTURES_TITLE,
  fixturesListLabel,
  gameweekWords,
  leagueAverageWords,
  nextLabel,
  noGameweeksWords,
  previousLabel,
  roundRobinWords,
  tooFewTeamsWords,
  totalPointsWords,
  versusWords,
} from "./words";

type Gameweek = LeagueTable["gameweeks"][number];

/** The league's fixtures, a gameweek at a time, or why it has none. */
export function FixturesPanel({ leagueTable }: { leagueTable: LeagueTable }) {
  const { format, gameweeks, roundRobinRounds, table } = leagueTable;
  return (
    <section aria-labelledby="fixtures-title" className="bg-panel">
      <PanelTitle id="fixtures-title">{FIXTURES_TITLE}</PanelTitle>
      {format === "totalPoints" ? (
        <p className="px-3 py-2">{totalPointsWords}</p>
      ) : gameweeks.length === 0 ? (
        <p className="px-3 py-2">{table.length < 2 ? tooFewTeamsWords : noGameweeksWords}</p>
      ) : (
        <>
          <GameweekFixtures gameweeks={gameweeks} />
          <p className="px-3 py-2 text-muted">{roundRobinWords(roundRobinRounds)}</p>
        </>
      )}
    </section>
  );
}

/** Where the fixtures open: the first gameweek not yet begun, or the last once all have. */
function openingIndex(gameweeks: readonly Gameweek[], now: number): number {
  const next = gameweeks.findIndex((each) => !isLocked(each.deadline, now));
  return next === -1 ? gameweeks.length - 1 : next;
}

const stepClasses = "flex min-w-tap items-center justify-center text-lead font-bold hover:bg-plate disabled:text-muted disabled:hover:bg-stepper";

/** One gameweek's fixtures, under CM's ◄ GW ► stepper over the gameweeks the league plays. */
function GameweekFixtures({ gameweeks }: { gameweeks: readonly Gameweek[] }) {
  const [chosen, choose] = useState(() => openingIndex(gameweeks, Date.now()));
  const index = Math.min(chosen, gameweeks.length - 1);
  const { gameweek, fixtures, byes } = gameweeks[index];
  return (
    <>
      <div className="flex min-h-tap items-stretch bg-stepper">
        <button type="button" aria-label={previousLabel} disabled={index === 0} onClick={() => choose(index - 1)} className={stepClasses}>
          <span aria-hidden="true">◄</span>
        </button>
        <h3 aria-live="polite" className="flex grow items-center justify-center text-lead font-bold">
          {gameweekWords(gameweek)}
        </h3>
        <button
          type="button"
          aria-label={nextLabel}
          disabled={index === gameweeks.length - 1}
          onClick={() => choose(index + 1)}
          className={stepClasses}
        >
          <span aria-hidden="true">►</span>
        </button>
      </div>
      <ul aria-label={fixturesListLabel(gameweek)}>
        {fixtures.map(({ team, opponent }) => (
          <li key={`${team} v ${opponent ?? leagueAverageWords}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 border-b border-panel-rule px-3 py-1 text-lead">
            <span className="text-right font-semibold">{team}</span>
            <span className="text-muted">{versusWords}</span>
            {opponent === null ? <span className="text-derived">{leagueAverageWords}</span> : <span className="font-semibold">{opponent}</span>}
          </li>
        ))}
      </ul>
      {byes.length > 0 && <p className="px-3 py-2">{byeWords(byes)}</p>}
    </>
  );
}
