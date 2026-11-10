import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { nextByDeadlines } from "../../convex/gameweeks/nextGameweek";
import { resultOf } from "../../convex/table/standings";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { LiveNote, Loading, PageSection, Panel, PanelNote } from "../ui/Panel";
import { MatchupLink } from "../matchup/MatchupLink";
import { useMinute } from "../shared/useMinute";
import { dateWords } from "../shared/words";
import type { LeagueTable } from "../table/seam";
import { afterWords, noResultsWords } from "../table/words";
import { ResultChip } from "./header/FormChips";
import { TeamPage } from "./header/TeamHeader";
import { NextGamePanel, SeasonPanel } from "./fixtures/SidePanels";
import { otherTeamPath } from "./paths";
import type { MyTeamSeam, TeamFixtures } from "./seam";
import {
  byeWords,
  fixtureColumns,
  fixturesLoadingWords,
  fixturesTableLabel,
  FIXTURES_TITLE,
  leagueAverageWords,
  nextGameWords,
  noFigureWords,
  noFixturesWords,
  noTeamWords,
  placeWords,
  provisionalWords,
  RESULTS_TITLE,
  resultsTableLabel,
  toPlayWords,
  totalPointsWords,
  unscoredWords,
} from "./words";

export type Game = TeamFixtures["games"][number];
type Column = keyof typeof fixtureColumns;
const TO_PLAY: readonly Column[] = ["gameweek", "date", "opponent", "now", "next"];
const PLAYED: readonly Column[] = ["gameweek", "date", "opponent", "result"];
const classOf = (column: Column) => cellClassOf(column !== "gameweek");

/** My team's Fixtures tab (spec/12, My team's tabs), built to its approved picture
 *  (docs/design/approved/team-fixtures): under My team's header band, the team's head-to-head games
 *  to come, the next first and marked, each opponent's place now; its results, newest first, each
 *  with W, D or L and the score opening the matchup (#436); and beside them the next game and the
 *  season. The picture's Competition picker and Comp column show only in a league with a cup, and
 *  no league has one yet (docs/to-grill.md, Cups), so neither is drawn. */
export function FixturesPage({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  if (league.teamName === null) {
    return (
      <PageSection title={FIXTURES_TITLE} className="bg-panel">
        <PanelNote>{noTeamWords}</PanelNote>
      </PageSection>
    );
  }
  return (
    <TeamPage league={league} teamName={league.teamName} seam={seam}>
      <TeamFixturesBody league={league} seam={seam} />
    </TeamPage>
  );
}

function TeamFixturesBody({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  const fixtures = seam.useTeamFixtures(league.leagueId);
  const table = seam.useLeagueTable(league.leagueId);
  const now = useMinute();
  if (fixtures === undefined) return <Note><Loading className="px-3 py-2">{fixturesLoadingWords}</Loading></Note>;
  if (fixtures.format === "totalPoints") return <Note><PanelNote>{totalPointsWords}</PanelNote></Note>;
  if (fixtures.games.length === 0) return <Note><PanelNote>{noFixturesWords}</PanelNote></Note>;
  // Played: begun, by the server's rule (the next to play is the one after the last begun), or
  // scored. To play: the rest, the next first.
  const unbegun = nextByDeadlines(fixtures.games, (game) => game.deadline, now)?.gameweek;
  const isPlayed = (game: Game) => game.score !== null || unbegun === undefined || game.gameweek < unbegun;
  const toPlay = fixtures.games.filter((game) => !isPlayed(game));
  const played = fixtures.games.filter(isPlayed).reverse();
  const next = toPlay[0]?.gameweek;
  const live = fixtures.games.some((game) => game.score?.provisional);
  return (
    <div className="mt-2 flex flex-col gap-2">
      {fixtures.unscored.map(({ gameweek, reason }) => (
        <p key={gameweek} className="bg-panel px-3 py-2 text-event">
          {unscoredWords(gameweek, reason)}
        </p>
      ))}
      {live && <LiveNote>{provisionalWords}</LiveNote>}
      <div className="grid items-start gap-2 lg:grid-cols-team-fixtures">
        <ToPlayPanel fixtures={fixtures} games={toPlay} next={next} table={table} leagueId={league.leagueId} />
        <ResultsPanel fixtures={fixtures} games={played} table={table} leagueId={league.leagueId} />
        <div className="flex flex-col gap-2">
          {toPlay
            .filter((game) => game.gameweek === next)
            .map((game) => (
              <NextGamePanel key={game.game} teamId={fixtures.teamId} game={game} table={table} now={now} />
            ))}
          {table !== undefined && <SeasonPanel table={table} teamName={fixtures.teamName} />}
        </div>
      </div>
    </div>
  );
}

/** A note in place of the panels: loading, or why there are none. */
function Note({ children }: { children: ReactNode }) {
  return <div className="mt-2 bg-panel">{children}</div>;
}

type ListProps = { fixtures: TeamFixtures; games: readonly Game[]; table: LeagueTable | undefined; leagueId: LeagueSummary["leagueId"] };

/** Every game to come, next first, marked with the cyan edge and Next; each opponent's place is
 *  today's. The list scrolls inside its panel. */
function ToPlayPanel({ fixtures, games, next, table, leagueId }: ListProps & { next: number | undefined }) {
  return (
    <Panel title={FIXTURES_TITLE} aside={<span className="text-soft">{toPlayWords(games.length)}</span>}>
      <div className="max-h-fixtures-list overflow-y-auto">
        <table aria-label={fixturesTableLabel(fixtures.teamName)} className="w-full border-collapse">
          <ColumnHeads columns={fixtureColumns} shown={TO_PLAY} classOf={classOf} />
          <tbody>
            {games.map((game) => {
              const isNext = game.gameweek === next;
              return (
                <tr key={`${game.gameweek}-${game.game}`} aria-current={isNext || undefined} className="h-row border-t border-panel-rule aria-current:shadow-current-edge">
                  <GameCells game={game} table={table} leagueId={leagueId} />
                  <td className={classOf("now")}>{placeOf(table, game.against)}</td>
                  <td className={`${classOf("next")} text-derived`}>{isNext && nextGameWords}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** Every game played, newest first: W, D or L and the score, which opens that week's matchup. */
function ResultsPanel({ fixtures, games, table, leagueId }: ListProps) {
  const latest = games.find((game) => game.score !== null);
  const aside = latest?.score?.provisional ? <span className="text-event">{provisionalWords}</span> : latest && <span className="text-soft">{afterWords(latest.gameweek)}</span>;
  return (
    <Panel title={RESULTS_TITLE} aside={aside ?? undefined}>
      {games.length === 0 && <PanelNote>{noResultsWords}</PanelNote>}
      <table aria-label={resultsTableLabel(fixtures.teamName)} className="w-full border-collapse">
        <ColumnHeads columns={fixtureColumns} shown={PLAYED} classOf={classOf} />
        <tbody>
          {games.map((game) => (
            <tr key={`${game.gameweek}-${game.game}`} className="h-row border-t border-panel-rule">
              <GameCells game={game} table={table} leagueId={leagueId} />
              <td className={classOf("result")}>
                <Result fixtures={fixtures} game={game} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/** A game's gameweek, its day and its opponent: both lists open each row so. */
function GameCells({ game, table, leagueId }: { game: Game; table: LeagueTable | undefined; leagueId: LeagueSummary["leagueId"] }) {
  return (
    <>
      <td className={classOf("gameweek")}>{game.gameweek}</td>
      <td className={classOf("date")}>{game.deadline === null ? <span className="text-muted">{noFigureWords}</span> : dateWords(game.deadline)}</td>
      <th scope="row" className={`${classOf("opponent")} text-lead font-semibold`}>
        <Opponent against={game.against} table={table} leagueId={leagueId} />
      </th>
    </>
  );
}

/** The opponent, its name opening its team once the table names its id; the league's average and a
 *  bye said so. */
function Opponent({ against, table, leagueId }: { against: Game["against"]; table: LeagueTable | undefined; leagueId: LeagueSummary["leagueId"] }) {
  switch (against.kind) {
    case "team": {
      const teamId = table?.table.find((row) => row.teamName === against.teamName)?.teamId;
      if (teamId === undefined) return against.teamName;
      return (
        <Link to={otherTeamPath(leagueId, teamId)} className="inline-flex min-h-tap min-w-tap items-center lg:min-h-0 lg:min-w-0">
          {against.teamName}
        </Link>
      );
    }
    case "leagueAverage":
      return <span className="text-derived">{leagueAverageWords}</span>;
    case "bye":
      return <span className="font-normal text-muted">{byeWords}</span>;
  }
}

/** The opponent's place in the table now; none for the league's average or a bye, or while the
 *  table loads. */
function placeOf(table: LeagueTable | undefined, against: Game["against"]) {
  if (table === undefined || against.kind !== "team") return null;
  const index = table.table.findIndex((row) => row.teamName === against.teamName);
  return index === -1 ? null : placeWords(index + 1);
}

/** A game's chip and score, as a link to the matchup; "v" for one begun with no score yet, and
 *  nothing on a bye. */
function Result({ fixtures: { teamId, teamName }, game: { gameweek, game, against, score } }: { fixtures: TeamFixtures; game: Game }) {
  if (against.kind === "bye") return null;
  const opponent = against.kind === "team" ? against.teamName : null;
  return (
    <span className="inline-flex items-center gap-2">
      {score !== null && <ResultChip result={resultOf(score.team, score.opponent)} live={score.provisional} />}
      <MatchupLink teamId={teamId} team={teamName} opponent={opponent} gameweek={gameweek} game={game} points={score} live={score?.provisional ?? false} />
    </span>
  );
}
