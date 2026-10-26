import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { isLocked } from "../../convex/gameweeks/deadline";
import { Loading, PageSection, PanelNote } from "../frame/Panel";
import { useMinute } from "../useMinute";
import type { MyTeamSeam, TeamFixtures } from "./seam";
import {
  byeWords,
  fixtureColumns,
  fixturesLoadingWords,
  fixturesTableLabel,
  FIXTURES_TITLE,
  leagueAverageWords,
  noFigureWords,
  noFixturesWords,
  noResultsWords,
  noRulesWords,
  noTeamWords,
  totalPointsWords,
  whenWords,
} from "./words";

type Game = TeamFixtures["games"][number];
type Column = keyof typeof fixtureColumns;
const COLUMNS: readonly Column[] = ["gameweek", "deadline", "opponent"];

/** My team's Fixtures tab (spec/12, My team's tabs): the manager's team's head-to-head games for
 *  the season, in gameweek order, the next to play marked. */
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
  return (
    <>
      <GamesTable teamName={fixtures.teamName} games={fixtures.games} />
      <PanelNote>{noResultsWords}</PanelNote>
    </>
  );
}

function GamesTable({ teamName, games }: { teamName: string; games: readonly Game[] }) {
  const now = useMinute();
  // The next gameweek to play: the first whose deadline hasn't passed. One with no deadline yet
  // (no kickoff time) hasn't begun, as a passed deadline is always recorded (deadline.ts).
  const next = games.find((game) => !isLocked(game.deadline, now))?.gameweek;
  return (
    <table aria-label={fixturesTableLabel(teamName)} className="w-full border-collapse">
      <thead className="bg-head text-ground">
        <tr>
          {COLUMNS.map((column) => (
            <th key={column} scope="col" title={fixtureColumns[column].long} aria-label={fixtureColumns[column].long} className={`px-3 ${column === "gameweek" ? "text-right" : "text-left"}`}>
              {fixtureColumns[column].short}
            </th>
          ))}
        </tr>
      </thead>
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
