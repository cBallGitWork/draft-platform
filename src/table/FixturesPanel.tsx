import { useState } from "react";
import { nextByDeadlines } from "../../convex/gameweeks/nextGameweek";
import { FEWEST_TO_DRAW } from "../../convex/table/roundRobin";
import { GameweekStepper } from "../ui/GameweekStepper";
import { Panel, PanelNote } from "../ui/Panel";
import { MatchupLink } from "../matchup/MatchupLink";
import type { LeagueTable } from "./seam";
import { byeWords, FIXTURES_TITLE, fixturesListLabel, leagueAverageWords, liveWords, noGameweeksWords, tooFewTeamsWords, yourTeamWords } from "./words";

type Gameweek = LeagueTable["gameweeks"][number];

/** The league's head-to-head fixtures, a gameweek at a time under CM's ◄ GW ► stepper on the
 *  panel's plate, or why it has none; the reader's own game has the cyan edge (the approved
 *  picture). A total-points league has no Fixtures panel at all. */
export function FixturesPanel({ leagueTable, mine }: { leagueTable: LeagueTable; mine: string | null }) {
  const { gameweeks, table } = leagueTable;
  if (gameweeks.length === 0) {
    return (
      <Panel title={FIXTURES_TITLE}>
        <PanelNote>{table.length < FEWEST_TO_DRAW ? tooFewTeamsWords : noGameweeksWords}</PanelNote>
      </Panel>
    );
  }
  return <GameweekFixtures leagueTable={leagueTable} mine={mine} />;
}

/** Where the fixtures open: the next gameweek by the server's rule (the one after the last begun),
 *  or the last once all have begun. */
function openingIndex(gameweeks: readonly Gameweek[], now: number): number {
  const next = nextByDeadlines(gameweeks, (each) => each.deadline, now);
  return next === undefined ? gameweeks.length - 1 : gameweeks.indexOf(next);
}

/** One gameweek's fixtures, the stepper over the gameweeks the league plays, and Live on the plate
 *  while any of the gameweek's points may still move. */
function GameweekFixtures({ leagueTable: { gameweeks, results }, mine }: { leagueTable: LeagueTable; mine: string | null }) {
  const [chosen, choose] = useState(() => openingIndex(gameweeks, Date.now()));
  // The list is live: unticking a gameweek can shorten it under the stepper, so the chosen index is held inside it (it keeps a place in the list, not a gameweek number).
  const index = Math.min(chosen, gameweeks.length - 1);
  const { gameweek, fixtures, byes } = gameweeks[index];
  const live = results.some((result) => result.gameweek === gameweek && result.teams.some((team) => team.provisional));
  const aside = (
    <div className="flex items-center gap-3">
      {live && <span className="text-event">{liveWords}</span>}
      <GameweekStepper
        gameweek={gameweek}
        hasPrevious={index > 0}
        hasNext={index < gameweeks.length - 1}
        onPrevious={() => choose(index - 1)}
        onNext={() => choose(index + 1)}
      />
    </div>
  );
  return (
    <Panel title={FIXTURES_TITLE} aside={aside}>
      <ul aria-label={fixturesListLabel(gameweek)}>
        {fixtures.map(({ teamId, team, opponent, points }) => {
          const ours = mine !== null && (team === mine || opponent === mine);
          return (
            <li
              key={`${team} v ${opponent ?? leagueAverageWords}`}
              aria-current={ours || undefined}
              className="grid grid-cols-fixture-row items-center gap-3 border-b border-panel-rule px-3 py-1 text-lead aria-current:shadow-current-edge"
            >
              <span className="text-right font-semibold">
                {ours && <span className="sr-only">{yourTeamWords}: </span>}
                {team}
              </span>
              <MatchupLink teamId={teamId} team={team} opponent={opponent} gameweek={gameweek} points={points} />
              {opponent === null ? <span className="text-derived">{leagueAverageWords}</span> : <span className="font-semibold">{opponent}</span>}
            </li>
          );
        })}
      </ul>
      {byes.length > 0 && <p className="px-3 py-2">{byeWords(byes)}</p>}
    </Panel>
  );
}
