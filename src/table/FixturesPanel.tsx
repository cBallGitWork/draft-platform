import { useState } from "react";
import { isLocked } from "../../convex/gameweeks/deadline";
import { FEWEST_TO_DRAW } from "../../convex/table/roundRobin";
import { GameweekStepper } from "../frame/GameweekStepper";
import { PanelNote, PanelTitle } from "../frame/Panel";
import { MatchupLink } from "../matchup/MatchupLink";
import type { LeagueTable } from "./seam";
import {
  byeWords,
  FIXTURES_TITLE,
  fixturesListLabel,
  leagueAverageWords,
  noGameweeksWords,
  noLineupWords,
  roundRobinWords,
  scoreWords,
  tooFewTeamsWords,
  totalPointsWords,
  versusWords,
} from "./words";

const TITLE_ID = "fixtures-title";

type Gameweek = LeagueTable["gameweeks"][number];
type Result = LeagueTable["results"][number];

/** The league's fixtures, a gameweek at a time, or why it has none. */
export function FixturesPanel({ leagueTable }: { leagueTable: LeagueTable }) {
  const { format, gameweeks, roundRobinRounds, table, results } = leagueTable;
  return (
    <section aria-labelledby={TITLE_ID} className="bg-panel">
      <PanelTitle id={TITLE_ID}>{FIXTURES_TITLE}</PanelTitle>
      {format === "totalPoints" ? (
        <p className="px-3 py-2">{totalPointsWords}</p>
      ) : gameweeks.length === 0 ? (
        <p className="px-3 py-2">{table.length < FEWEST_TO_DRAW ? tooFewTeamsWords : noGameweeksWords}</p>
      ) : (
        <>
          <GameweekFixtures gameweeks={gameweeks} results={results} />
          <PanelNote>{roundRobinWords(roundRobinRounds)}</PanelNote>
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

/** One gameweek's fixtures, under CM's ◄ GW ► stepper over the gameweeks the league plays. */
function GameweekFixtures({ gameweeks, results }: { gameweeks: readonly Gameweek[]; results: readonly Result[] }) {
  const [chosen, choose] = useState(() => openingIndex(gameweeks, Date.now()));
  // The list is live: unticking a gameweek can shorten it under the stepper, so the chosen index is held inside it (it keeps a place in the list, not a gameweek number).
  const index = Math.min(chosen, gameweeks.length - 1);
  const { gameweek, fixtures, byes } = gameweeks[index];
  const noLineup = (results.find((result) => result.gameweek === gameweek)?.teams ?? []).filter((team) => team.noLineup).map((team) => team.teamName);
  return (
    <>
      <GameweekStepper
        gameweek={gameweek}
        hasPrevious={index > 0}
        hasNext={index < gameweeks.length - 1}
        onPrevious={() => choose(index - 1)}
        onNext={() => choose(index + 1)}
      />
      <ul aria-label={fixturesListLabel(gameweek)}>
        {fixtures.map(({ teamId, team, opponent, points }) => (
          <li key={`${team} v ${opponent ?? leagueAverageWords}`} className="grid grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] items-center gap-3 border-b border-panel-rule px-3 py-1 text-lead">
            <span className="text-right font-semibold">{team}</span>
            <MatchupLink teamId={teamId} team={team} opponent={opponent} gameweek={gameweek}>
              {points === null ? (
                <span>{versusWords}</span>
              ) : (
                <span className="whitespace-nowrap font-bold text-figure tabular-nums">{scoreWords(points.team, points.opponent)}</span>
              )}
            </MatchupLink>
            {opponent === null ? <span className="text-derived">{leagueAverageWords}</span> : <span className="font-semibold">{opponent}</span>}
          </li>
        ))}
      </ul>
      {byes.length > 0 && <p className="px-3 py-2">{byeWords(byes)}</p>}
      {noLineup.length > 0 && <p className="px-3 py-2">{noLineupWords(noLineup)}</p>}
    </>
  );
}
