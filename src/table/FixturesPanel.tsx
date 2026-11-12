import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { isLocked } from "../../convex/gameweeks/deadline";
import { nextByDeadlines } from "../../convex/gameweeks/nextGameweek";
import { FEWEST_TO_DRAW, LEAGUE_AVERAGE } from "../../convex/table/roundRobin";
import { useMinute } from "../shared/useMinute";
import { GameweekStepper } from "../ui/GameweekStepper";
import { Panel, PANEL_BODY, PanelNote, Problem } from "../ui/Panel";
import { MatchupLink } from "../matchup/MatchupLink";
import type { LeagueTable, PickedSide, Side, TableScreenSeam } from "./seam";
import {
  byeWords,
  cancelWords,
  editingWords,
  FIXTURES_TITLE,
  fixturesListLabel,
  leagueAverageWords,
  leagueGamesHead,
  liveWords,
  noGameweeksWords,
  pickAnotherWords,
  pickSideLabel,
  saveSwapWords,
  tooFewTeamsWords,
  yourTeamWords,
} from "./words";

type Gameweek = LeagueTable["gameweeks"][number];
type Fixture = Gameweek["fixtures"][number];

/** The league's head-to-head fixtures, a gameweek at a time under CM's ◄ GW ► stepper on the
 *  panel's plate, or why it has none; the reader's own game has the cyan edge (the approved
 *  picture). A total-points league has no Fixtures panel at all. */
export function FixturesPanel({ league, seam, leagueTable }: { league: LeagueSummary; seam: TableScreenSeam; leagueTable: LeagueTable }) {
  const { gameweeks, table } = leagueTable;
  if (gameweeks.length === 0) {
    return (
      <Panel title={FIXTURES_TITLE}>
        <PanelNote>{table.length < FEWEST_TO_DRAW ? tooFewTeamsWords : noGameweeksWords}</PanelNote>
      </Panel>
    );
  }
  return <GameweekFixtures league={league} seam={seam} leagueTable={leagueTable} />;
}

/** Where the fixtures open: the next gameweek by the server's rule (the one after the last begun),
 *  or the last once all have begun. */
function openingIndex(gameweeks: readonly Gameweek[], now: number): number {
  const next = nextByDeadlines(gameweeks, (each) => each.deadline, now);
  return next === undefined ? gameweeks.length - 1 : gameweeks.indexOf(next);
}

/** A side picked to swap: the game it is in, by its place in the gameweek's list, and the side. */
type Pick = { game: number } & PickedSide;

/** One gameweek's fixtures under their League head, the stepper over the gameweeks the league
 *  plays, and Live on the plate while any of the gameweek's points may still move. The
 *  commissioner edits a gameweek not yet begun (spec/09, Fixture edits; the approved auto-team
 *  picture): each side is a button, a side picked then one in another game, and Save swap moves
 *  them between their games. */
function GameweekFixtures({ league, seam, leagueTable: { gameweeks, results } }: { league: LeagueSummary; seam: TableScreenSeam; leagueTable: LeagueTable }) {
  const now = useMinute();
  const [chosen, choose] = useState(() => openingIndex(gameweeks, Date.now()));
  const [picks, setPicks] = useState<Pick[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fixtureSwap = seam.useFixtureSwap();
  // The list is live: unticking a gameweek can shorten it under the stepper, so the chosen index is held inside it (it keeps a place in the list, not a gameweek number).
  const index = Math.min(chosen, gameweeks.length - 1);
  const { gameweek, deadline, fixtures, byes } = gameweeks[index];
  const live = results.some((result) => result.gameweek === gameweek && result.teams.some((team) => team.provisional));
  const editable = league.powers.runs && !isLocked(deadline, now);
  const editing = editable && picks.length > 0;
  const mine = league.teamName;

  const cancel = () => {
    setPicks([]);
    setProblem(null);
  };
  const step = (to: number) => {
    cancel();
    choose(to);
  };
  /** A side tapped: picked, or unpicked if it was; one in the first pick's game takes its place. */
  const tap = (pick: Pick) => {
    setProblem(null);
    const held = picks.filter((each) => each.game !== pick.game);
    const again = picks.some((each) => each.game === pick.game && each.moves === pick.moves);
    setPicks(again ? held : [...held, pick].slice(-2));
  };
  const save = async () => {
    const [one, other] = picks;
    setBusy(true);
    const refused = await fixtureSwap.swap(league.leagueId, gameweek, { moves: one.moves, against: one.against }, { moves: other.moves, against: other.against });
    setBusy(false);
    if (refused === null) setPicks([]);
    setProblem(refused);
  };

  const aside = (
    <div className="flex items-center gap-3">
      {live && <span className="text-event">{liveWords}</span>}
      <GameweekStepper
        gameweek={gameweek}
        hasPrevious={index > 0}
        hasNext={index < gameweeks.length - 1}
        onPrevious={() => step(index - 1)}
        onNext={() => step(index + 1)}
      />
    </div>
  );
  const title = (
    <>
      {FIXTURES_TITLE}
      {editing && <span className="ml-3 font-normal text-event">{editingWords}</span>}
    </>
  );
  return (
    <Panel title={title} aside={aside}>
      <h4 className="bg-head px-3 font-semibold text-ground">{leagueGamesHead}</h4>
      <ul aria-label={fixturesListLabel(gameweek)}>
        {fixtures.map((fixture, game) => {
          const { team, opponent } = fixture;
          const ours = mine !== null && (team === mine || opponent === mine);
          const sides = sidesOf(fixture);
          const sideAt = (at: 0 | 1, name: string) =>
            editable ? (
              <SideButton name={name} home={at === 0} picked={picks.some((each) => each.game === game && each.moves === sides[at])} onTap={() => tap({ game, moves: sides[at], against: sides[1 - at] })} />
            ) : null;
          return (
            <li
              key={game}
              aria-current={ours || undefined}
              className="grid grid-cols-fixture-row items-center gap-3 border-b border-panel-rule px-3 py-1 text-lead aria-current:shadow-current-edge"
            >
              <span className="text-right font-semibold">
                {ours && <span className="sr-only">{yourTeamWords}: </span>}
                {sideAt(0, team) ?? team}
              </span>
              <MatchupLink teamId={fixture.teamId} team={team} opponent={opponent} gameweek={gameweek} game={fixture.game} points={fixture.points} />
              {sideAt(1, opponent ?? leagueAverageWords) ??
                (opponent === null ? <span className="text-derived">{leagueAverageWords}</span> : <span className="font-semibold">{opponent}</span>)}
            </li>
          );
        })}
      </ul>
      {byes.length > 0 && <p className="px-3 py-2">{byeWords(byes)}</p>}
      {editing && (
        <div className={PANEL_BODY}>
          <p className="text-soft">{pickAnotherWords}</p>
          <Problem problem={problem} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancel} className="secondary-action">
              {cancelWords}
            </button>
            <button type="button" disabled={picks.length < 2 || busy} onClick={() => void save()} className={picks.length < 2 ? "action-idle" : "action"}>
              {saveSwapWords}
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** A game's two sides, the team first: the opponent is the league's average where it has no id. */
const sidesOf = ({ teamId, opponentId }: Fixture): [Side, Side] => [teamId, opponentId ?? LEAGUE_AVERAGE];

/** A side as a button while the commissioner edits, picked with the cyan rim. */
function SideButton({ name, picked, home, onTap }: { name: string; picked: boolean; home: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      aria-label={pickSideLabel(name)}
      onClick={onTap}
      className={`secondary-action w-full aria-pressed:outline-2 aria-pressed:outline-derived ${home ? "justify-end" : ""}`}
    >
      {name}
    </button>
  );
}
