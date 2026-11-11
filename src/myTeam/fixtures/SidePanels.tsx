import { Link } from "@tanstack/react-router";
import type { Id } from "../../../convex/_generated/dataModel";
import { TABLE_PATH } from "../../frame/menu";
import { matchupLink } from "../../matchup/paths";
import { nextGlyph } from "../../shared/words";
import type { LeagueTable } from "../../table/seam";
import { columns as tableColumns } from "../../table/words";
import { Fact } from "../../trades/OfferParts";
import { cellClassOf, ColumnHeads } from "../../ui/ColumnHeads";
import { Panel } from "../../ui/Panel";
import { FormChips } from "../header/FormChips";
import { standingOf } from "../header/teamStanding";
import { countdownWords, pointsShort } from "../header/words";
import type { Game } from "../FixturesPage";
import {
  deadlineWords,
  figureWords,
  leagueAverageWords,
  matchupMoreWords,
  nextGameTitle,
  noFigureWords,
  placeWords,
  SEASON_TITLE,
  tableMoreWords,
  theirFormWords,
  whenWords,
} from "../words";

// The right-hand column of My team's Fixtures tab (docs/design/approved/team-fixtures): the next
// game, and the season so far.

/** A panel's way on to the screen holding the whole of what it shows: "Matchup ›", "Table ›". */
function MoreLink({ to, search, children }: { to: string; search?: Record<string, unknown>; children: string }) {
  return (
    <Link to={to} search={search} className="flex min-h-tap items-center justify-end px-3 font-semibold lg:min-h-0 lg:py-1">
      {children} <span aria-hidden="true">&nbsp;{nextGlyph}</span>
    </Link>
  );
}

/** The next game: the opponent's place and points, the deadline and its countdown, their last five
 *  results, and the way to the matchup. A bye has none. */
export function NextGamePanel({ teamId, game, table, now }: { teamId: Id<"teams">; game: Game; table: LeagueTable | undefined; now: number }) {
  if (game.against.kind === "bye") return null;
  const name = game.against.kind === "team" ? game.against.teamName : leagueAverageWords;
  const standing = table !== undefined && game.against.kind === "team" ? standingOf(table, game.against.teamName) : null;
  return (
    <Panel title={nextGameTitle(game.gameweek, name)}>
      <p className="flex items-baseline gap-2 px-3 py-2">
        <span className="display-face text-lead">{name}</span>
        {standing !== null && (
          <span>
            {placeWords(standing.place)}, <span className="font-bold text-figure">{pointsShort(standing.points)}</span>
          </span>
        )}
      </p>
      <dl className="grid grid-cols-facts">
        <Fact label={deadlineWords}>
          {game.deadline === null ? (
            <span className="text-muted">{noFigureWords}</span>
          ) : (
            <>
              {whenWords(game.deadline)} <span className="text-derived">{countdownWords(game.deadline - now)}</span>
            </>
          )}
        </Fact>
        {standing !== null && (
          <Fact label={theirFormWords}>
            <FormChips form={standing.form} />
          </Fact>
        )}
      </dl>
      <MoreLink {...matchupLink(teamId, game.gameweek, game.game)}>{matchupMoreWords}</MoreLink>
    </Panel>
  );
}

const SEASON_COLUMNS = ["played", "won", "drawn", "lost", "pointsFor", "pointsAgainst", "points"] as const;
const seasonCell = () => cellClassOf(false);

/** The season so far, as the table counts it: played, won, drawn, lost, points for and against, and
 *  table points, the team's place on the plate. */
export function SeasonPanel({ table, teamName }: { table: LeagueTable; teamName: string }) {
  const index = table.table.findIndex((row) => row.teamName === teamName);
  if (index === -1) return null;
  const row = table.table[index];
  return (
    <Panel title={SEASON_TITLE} aside={<span className="text-soft">{placeWords(index + 1)}</span>}>
      <table className="w-full border-collapse">
        <ColumnHeads columns={tableColumns} shown={SEASON_COLUMNS} classOf={seasonCell} />
        <tbody>
          <tr className="h-row">
            {SEASON_COLUMNS.map((column) => (
              <td key={column} className={`${seasonCell()}${column === "points" ? " font-bold text-figure" : ""}`}>
                {figureWords(row[column])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <MoreLink to={TABLE_PATH}>{tableMoreWords}</MoreLink>
    </Panel>
  );
}
