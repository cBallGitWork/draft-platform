import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { gameModeOf } from "../../convex/rules/gameMode";
import { FormChips } from "../ui/FormChips";
import { standingOf } from "../myTeam/header/teamStanding";
import { tenthsFigure } from "../shared/figures";
import { AutoTeamChip } from "../ui/AutoTeamChip";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { Loading, PAGE_STACK, PageSection, Panel, PANEL_COLUMNS, PanelNote } from "../ui/Panel";
import { PlateTabs } from "../ui/PlateTabs";
import { CupBracket } from "./CupBracket";
import { FixturesPanel } from "./FixturesPanel";
import type { LeagueTable, TableScreenSeam } from "./seam";
import {
  afterWords,
  columns,
  COMPETITIONS,
  competitionsLabel,
  competitionWords,
  differenceWords,
  figureWords,
  loadingWords,
  noResultsWords,
  provisionalWords,
  seasonLineWords,
  TABLE_PAGE_TITLE,
  TABLE_TITLE,
  TOTAL_POINTS_COLUMNS,
  TOTAL_POINTS_PAGE_TITLE,
  unscoredWords,
  yourTeamWords,
  type Competition,
} from "./words";

type Column = keyof typeof columns;
type Row = LeagueTable["table"][number];

/** The columns of each format's table (`TOTAL_POINTS_COLUMNS` says why total points has fewer). */
const COLUMNS_OF: Record<LeagueTable["format"], readonly Column[]> = {
  headToHead: ["position", "team", "played", "won", "drawn", "lost", "pointsFor", "pointsAgainst", "difference", "points", "form"],
  totalPoints: TOTAL_POINTS_COLUMNS,
};

/** Columns a phone leaves out, for room beside the form: the difference and points say what
 *  they would. */
const DESK_ONLY: readonly Column[] = ["won", "drawn", "lost", "pointsFor", "pointsAgainst"];

/** A column's cells: names and form read from the left, figures line up on the right, and a phone
 *  leaves out what it has no room for. */
const cellClasses = (column: Column) => cellClassOf(column === "team" || column === "form", DESK_ONLY.includes(column));

/** The league's table and fixtures (spec/12, spec/09; docs/design/approved/table/), for anyone in
 *  it. Head-to-head: League and Cup tabs on the title plate, the competition on the left and the
 *  fixtures of one gameweek at a time on the right, kept as the tabs switch. Total points: the
 *  table alone, titled Table. */
export function TablePage({ league, seam }: { league: LeagueSummary; seam: TableScreenSeam }) {
  const leagueTable = seam.useLeagueTable(league.leagueId);
  const [competition, choose] = useState<Competition>("league");
  const totalPoints = leagueTable !== undefined && !gameModeOf(leagueTable).hasMatchups;
  const aside = leagueTable && (
    <>
      {!totalPoints && <CompetitionTabs chosen={competition} choose={choose} />}
      {leagueTable.season !== null && (
        <span className="self-center text-soft">{seasonLineWords(leagueTable.season, latestOf(leagueTable.results))}</span>
      )}
    </>
  );
  return (
    <PageSection title={totalPoints ? TOTAL_POINTS_PAGE_TITLE : TABLE_PAGE_TITLE} aside={aside} className={PAGE_STACK}>
      {leagueTable === undefined ? (
        <Loading>{loadingWords}</Loading>
      ) : (
        <div className={totalPoints ? PANEL_COLUMNS : "grid items-start gap-2 lg:grid-cols-table"}>
          {totalPoints || competition === "league" ? <StandingsPanel leagueTable={leagueTable} mine={league.teamName} /> : <CupBracket />}
          {!totalPoints && <FixturesPanel league={league} seam={seam} leagueTable={leagueTable} />}
        </div>
      )}
    </PageSection>
  );
}

/** League and Cup, butted on the title plate after the title (the approved picture). */
function CompetitionTabs({ chosen, choose }: { chosen: Competition; choose: (competition: Competition) => void }) {
  return <PlateTabs label={competitionsLabel} tabs={COMPETITIONS} words={competitionWords} chosen={chosen} choose={choose} />;
}

/** The latest gameweek with results, and whether its points may still move. */
function latestOf(results: LeagueTable["results"]): { gameweek: number; live: boolean } | undefined {
  const latest = results.at(-1);
  return latest && { gameweek: latest.gameweek, live: latest.teams.some((team) => team.provisional) };
}

/** The gameweek the table counts up to, or Provisional while a live gameweek's points may move. */
function TableState({ results }: { results: LeagueTable["results"] }) {
  const latest = latestOf(results);
  if (latest === undefined) return null;
  return latest.live ? (
    <span className="text-event">{provisionalWords}</span>
  ) : (
    <span className="text-soft">{afterWords(latest.gameweek)}</span>
  );
}

function StandingsPanel({ leagueTable, mine }: { leagueTable: LeagueTable; mine: string | null }) {
  const { format, table, results, unscored } = leagueTable;
  const shown = COLUMNS_OF[format];
  return (
    <Panel title={TABLE_TITLE} aside={<TableState results={results} />}>
      {unscored.map(({ gameweek, reason }) => (
        <p key={gameweek} className="px-3 py-2 text-event">
          {unscoredWords(gameweek, reason)}
        </p>
      ))}
      {table.every((row) => row.played === 0) && <PanelNote>{noResultsWords}</PanelNote>}
      <table className="w-full border-collapse">
        <ColumnHeads columns={columns} shown={shown} classOf={cellClasses} />
        <tbody>
          {table.map((row, index) => (
            <tr key={row.teamId} aria-current={row.teamName === mine || undefined} className="h-row border-t border-panel-rule aria-current:shadow-current-edge">
              {shown.map((column) => (
                <TableCell key={column} column={column} row={row} position={index + 1} mine={row.teamName === mine} leagueTable={leagueTable} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/** One cell of a team's row: its name heads the row, its points are the table's figure, and its
 *  form is the approved chips, the last outlined while live (My team's header's own). */
function TableCell({ column, row, position, mine, leagueTable }: { column: Column; row: Row; position: number; mine: boolean; leagueTable: LeagueTable }) {
  const className = cellClasses(column);
  switch (column) {
    case "position":
      return <td className={`${className} text-muted`}>{position}</td>;
    case "team":
      return (
        <th scope="row" className={`${className} text-lead font-semibold`}>
          {mine && <span className="sr-only">{yourTeamWords}: </span>}
          <span className="flex items-center gap-2">
            {row.teamName}
            {row.onAutoTeam && <AutoTeamChip />}
          </span>
        </th>
      );
    case "difference":
      return <td className={className}>{differenceWords(row.difference)}</td>;
    case "pointsFor":
    case "pointsAgainst":
      return <td className={className}>{tenthsFigure(row[column])}</td>;
    case "points":
      return <td className={`${className} font-bold text-figure`}>{figureWords(row.points)}</td>;
    case "form": {
      const standing = standingOf(leagueTable, row.teamName);
      return (
        <td className={className}>
          <FormChips form={standing?.form ?? []} live={standing?.last?.score?.provisional ?? false} />
        </td>
      );
    }
    default:
      return <td className={className}>{row[column]}</td>;
  }
}
