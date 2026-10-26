import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { Loading, PageSection, PanelNote } from "../frame/Panel";
import { playerCardPath } from "../playerCard/paths";
import { PositionCodes } from "../PositionCodes";
import type { MyTeamSeam, TeamSquad } from "./seam";
import {
  awayWords,
  goneWords,
  homeWords,
  lastGameweekLong,
  nextFixtureLong,
  noFigureWords,
  noNextFixtureWords,
  noPointsWords,
  noSquadWords,
  noTeamWords,
  squadColumns,
  squadLoadingWords,
  squadTableLabel,
  SQUAD_TITLE,
  whenWords,
} from "./words";

type Row = TeamSquad["players"][number];
type Column = keyof typeof squadColumns;
const COLUMNS: readonly Column[] = ["positions", "player", "club", "next", "last", "season"];
/** A phone leaves out the club, for room (plate.md, The phone: the squad table drops Club). */
const DESK_ONLY: readonly Column[] = ["club"];
const FIGURES: readonly Column[] = ["last", "season"];

const cellClasses = (column: Column) =>
  `px-2 align-middle ${FIGURES.includes(column) ? "text-right" : "text-left"} ${DESK_ONLY.includes(column) ? "hidden sm:table-cell" : ""}`;

/** My team's Squad tab (spec/12, My team's tabs): every player in the squad in one table. */
export function SquadPage({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  return (
    <PageSection title={SQUAD_TITLE} className="max-w-4xl bg-panel">
      {league.teamName === null ? <PanelNote>{noTeamWords}</PanelNote> : <SquadBody league={league} seam={seam} />}
    </PageSection>
  );
}

function SquadBody({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  const squad = seam.useTeamSquad(league.leagueId);
  if (squad === undefined) return <Loading className="px-3 py-2">{squadLoadingWords}</Loading>;
  if (squad.players.length === 0) return <PanelNote>{noSquadWords}</PanelNote>;
  return <SquadTable leagueId={league.leagueId} squad={squad} />;
}

function SquadTable({ leagueId, squad }: { leagueId: Id<"leagues">; squad: TeamSquad }) {
  const longOf = (column: Column) => (column === "last" && squad.lastGameweek !== null ? lastGameweekLong(squad.lastGameweek) : squadColumns[column].long);
  return (
    <table aria-label={squadTableLabel(squad.teamName)} className="w-full border-collapse">
      <thead className="bg-head text-ground">
        <tr>
          {COLUMNS.map((column) => (
            <th key={column} scope="col" title={longOf(column)} aria-label={longOf(column)} className={cellClasses(column)}>
              {squadColumns[column].short}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {squad.players.map((player) => (
          <tr key={player.code} className="border-t border-panel-rule">
            {COLUMNS.map((column) => (
              <SquadCell key={column} column={column} player={player} leagueId={leagueId} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One cell of a player's row: his name heads it, his points are its figures. */
function SquadCell({ column, player, leagueId }: { column: Column; player: Row; leagueId: Id<"leagues"> }) {
  const className = cellClasses(column);
  switch (column) {
    case "positions":
      return (
        <td className={className}>
          <PositionCodes positions={player.positions} />
        </td>
      );
    case "player":
      return (
        <th scope="row" title={player.fullName} className={`${className} text-lead font-semibold`}>
          <Link to={playerCardPath(leagueId, player.code)} className="inline-flex min-h-tap items-center">
            {player.name}
          </Link>
          {player.gone && <span className="block text-data font-normal text-event">{goneWords}</span>}
        </th>
      );
    case "club":
      return (
        <td className={className}>
          <abbr title={player.club.name} className="no-underline">
            {player.club.shortName}
          </abbr>
        </td>
      );
    case "next":
      return <td className={className}>{player.nextFixture === null ? <span title={noNextFixtureWords} className="text-muted">{noFigureWords}</span> : <NextFixture next={player.nextFixture} />}</td>;
    case "last":
      return <PointsCell className={className} points={player.lastGameweekPoints} />;
    case "season":
      return <PointsCell className={className} points={player.seasonPoints} />;
  }
}

function NextFixture({ next }: { next: NonNullable<Row["nextFixture"]> }) {
  const long = nextFixtureLong(next.opponent.name, next.home, whenWords(next.kickoff));
  return (
    <abbr title={long} aria-label={long} className="no-underline whitespace-nowrap">
      {next.opponent.shortName} {next.home ? homeWords : awayWords}
    </abbr>
  );
}

function PointsCell({ className, points }: { className: string; points: number | null }) {
  return points === null ? (
    <td title={noPointsWords} className={`${className} text-muted`}>
      {noFigureWords}
    </td>
  ) : (
    <td className={`${className} font-bold text-figure`}>{points}</td>
  );
}
