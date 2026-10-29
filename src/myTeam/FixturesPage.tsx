import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { nextByDeadlines } from "../../convex/gameweeks/nextGameweek";
import { ColumnHeads } from "../ui/ColumnHeads";
import { Loading, PageSection, PanelNote } from "../ui/Panel";
import { MatchupLink } from "../matchup/MatchupLink";
import { useMinute } from "../shared/useMinute";
import type { MyTeamSeam, TeamFixtures } from "./seam";
import {
  byeWords,
  fixtureColumns,
  fixturesLoadingWords,
  fixturesTableLabel,
  FIXTURES_TITLE,
  leagueAverageWords,
  liveWords,
  noFigureWords,
  noFixturesWords,
  noRulesWords,
  noTeamWords,
  provisionalWords,
  scoreWords,
  totalPointsWords,
  unscoredWords,
  versusWords,
  whenWords,
} from "./words";

type Game = TeamFixtures["games"][number];
type Column = keyof typeof fixtureColumns;
const COLUMNS: readonly Column[] = ["gameweek", "deadline", "opponent", "result"];
const ALIGN: Record<Column, string> = { gameweek: "text-right", deadline: "text-left", opponent: "text-left", result: "text-center" };

/** My team's Fixtures tab (spec/12, My team's tabs): the manager's team's head-to-head games for
 *  the season, in gameweek order, the next to play marked, each with its result once scored
 *  (#436), as the table's fixtures show it. */
export function FixturesPage({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  return (
    <PageSection title={FIXTURES_TITLE} className="max-w-3xl bg-panel">
      {league.teamName === null ? <PanelNote>{noTeamWords}</PanelNote> : <TeamFixturesBody league={league} seam={seam} />}
    </PageSection>
  );
}

function TeamFixturesBody({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  const fixtures = seam.useTeamFixtures(league.leagueId);
  if (fixtures === undefined) return <Loading className="px-3 py-2">{fixturesLoadingWords}</Loading>;
  if (fixtures === null) return <PanelNote>{noRulesWords}</PanelNote>;
  if (fixtures.format === "totalPoints") return <PanelNote>{totalPointsWords}</PanelNote>;
  if (fixtures.games.length === 0) return <PanelNote>{noFixturesWords}</PanelNote>;
  const live = fixtures.games.some((game) => game.score?.provisional);
  return (
    <>
      {fixtures.unscored.map(({ gameweek, reason }) => (
        <p key={gameweek} className="px-3 py-2 text-event">
          {unscoredWords(gameweek, reason)}
        </p>
      ))}
      {live && <p className="px-3 py-2 text-derived">{provisionalWords}</p>}
      <GamesTable fixtures={fixtures} />
    </>
  );
}

function GamesTable({ fixtures: { teamId, teamName, games } }: { fixtures: TeamFixtures }) {
  const now = useMinute();
  // The next gameweek to play, by the server's rule: the one after the last begun.
  const next = nextByDeadlines(games, (game) => game.deadline, now)?.gameweek;
  return (
    <table aria-label={fixturesTableLabel(teamName)} className="w-full border-collapse">
      <ColumnHeads columns={fixtureColumns} shown={COLUMNS} classOf={(column) => `px-3 ${ALIGN[column]}`} />
      <tbody>
        {games.map((game, index) => (
          <tr
            key={`${game.gameweek}-${index}`}
            aria-current={game.gameweek === next || undefined}
            className="border-t border-panel-rule aria-current:shadow-current-edge"
          >
            <td className="px-3 text-right">{game.gameweek}</td>
            <td className="px-3">{game.deadline === null ? noFigureWords : whenWords(game.deadline)}</td>
            <th scope="row" className="px-3 text-left text-lead font-semibold">
              <Opponent against={game.against} />
            </th>
            <td className="px-3">
              <Result teamId={teamId} teamName={teamName} game={game} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Opponent({ against }: { against: Game["against"] }) {
  switch (against.kind) {
    case "team":
      return against.teamName;
    case "leagueAverage":
      return <span className="text-derived">{leagueAverageWords}</span>;
    case "bye":
      return <span className="font-normal text-muted">{byeWords}</span>;
  }
}

/** A game's score, or "v" before it is scored, as a link to the matchup; a bye has none. */
function Result({ teamId, teamName, game: { gameweek, against, score } }: { teamId: TeamFixtures["teamId"]; teamName: string; game: Game }) {
  if (against.kind === "bye") return null;
  const opponent = against.kind === "team" ? against.teamName : null;
  return (
    <MatchupLink teamId={teamId} team={teamName} opponent={opponent} gameweek={gameweek}>
      {score === null ? (
        <span>{versusWords}</span>
      ) : (
        <span className="whitespace-nowrap">
          <span className="font-bold text-figure">{scoreWords(score.team, score.opponent)}</span>
          {score.provisional && <span className="ml-1 text-derived">{liveWords}</span>}
        </span>
      )}
    </MatchupLink>
  );
}
