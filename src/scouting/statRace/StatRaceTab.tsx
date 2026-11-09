import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../../convex/leagues/myLeagues";
import { categoryName, categoryShortCode } from "../../../convex/scoring/categories";
import { rankAmong } from "../../../convex/scouting/raceOrder";
import { cellClassOf, ColumnHeads } from "../../ui/ColumnHeads";
import { Loading, Panel } from "../../ui/Panel";
import { useLastLoaded } from "../../shared/useLastLoaded";
import { statFigure } from "../../shared/figures";
import type { RacingTeam, ScoutingSeam, StatRace } from "../seam";
import {
  categoryColumns,
  countsWhatCountedWords,
  everyCategoryWords,
  raceColumns,
  raceLoadingWords,
  rankByLabel,
  rankWords,
  sinceWords,
  STAT_RACE_TITLE,
} from "../words";

/** The race opens on goals, the first category the site's scoring has always scored. */
const OPENING_STAT = "goals_scored";
const RANK_BY_ID = "stat-race-rank-by";

/** Scouting's Stat race tab (#800, spec/19 The stat race; docs/design/approved/scouting/
 *  1440-stat-race.png): every team's season total in each scoring category, as raw counts, ranked
 *  by the one picked in Rank by or by a category's head; on the right, the selected team's every
 *  category with its rank, opening on the manager's own team. */
export function StatRaceTab({ league, seam }: { league: LeagueSummary; seam: ScoutingSeam }) {
  const [stat, setStat] = useState(OPENING_STAT);
  // While a new ranking loads, the last one stays up.
  const race = useLastLoaded(seam.useStatRace(league.leagueId, stat));
  const [selectedId, select] = useState<Id<"teams"> | null>(null);
  const selected = race && (race.teams.find((team) => team.teamId === selectedId) ?? race.teams.find((team) => team.name === league.teamName) ?? race.teams[0]);
  return (
    <div className="grid items-start gap-2 lg:grid-cols-table">
      <Panel title={STAT_RACE_TITLE}>
        {race === undefined ? (
          <Loading className="px-3 py-2">{raceLoadingWords}</Loading>
        ) : (
          <>
            <RankBy categories={race.categories} stat={stat} rankBy={setStat} since={race.since} />
            <RaceTable race={race} stat={stat} rankBy={setStat} selected={selected?.teamId ?? null} select={select} />
          </>
        )}
      </Panel>
      {race !== undefined && selected !== undefined && <TeamPanel team={selected} race={race} />}
    </div>
  );
}

/** Rank by, the line on what counts, and where a mid-season league's totals start. */
function RankBy({ categories, stat, rankBy, since }: { categories: readonly string[]; stat: string; rankBy: (stat: string) => void; since: number | null }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <span className="flex items-center gap-2">
        <label htmlFor={RANK_BY_ID} className="text-soft">
          {rankByLabel}
        </label>
        <select id={RANK_BY_ID} value={stat} onChange={(event) => rankBy(event.target.value)} className="text-box">
          {categories.map((category) => (
            <option key={category} value={category}>
              {categoryName(category)}
            </option>
          ))}
        </select>
      </span>
      <span className="text-soft">{countsWhatCountedWords}</span>
      {since !== null && <span className="font-semibold text-fact">{sinceWords(since)}</span>}
    </div>
  );
}

/** A column's cells: the rank and the team read from the left, each category's column (by its
 *  stat's key) lines up on the right. */
const cellClasses = (column: string) => cellClassOf(column === "rank" || column === "team");

/** The race: a row per team in rank order, a column per category, its head ranking by it. */
function RaceTable({
  race,
  stat,
  rankBy,
  selected,
  select,
}: {
  race: StatRace;
  stat: string;
  rankBy: (stat: string) => void;
  selected: Id<"teams"> | null;
  select: (teamId: Id<"teams">) => void;
}) {
  const heads = Object.fromEntries(race.categories.map((category) => [category, { short: categoryShortCode(category), long: categoryName(category) }]));
  const totals = race.teams.map((team) => team.stat);
  return (
    <table className="w-full border-collapse">
      <ColumnHeads
        columns={{ ...raceColumns, ...heads }}
        shown={["rank", "team", ...race.categories]}
        classOf={cellClasses}
        sort={{ by: stat, descending: true, sortable: race.categories, sortBy: rankBy }}
      />
      <tbody>
        {race.teams.map((team) => {
          const current = team.teamId === selected;
          return (
            <tr key={team.teamId} aria-current={current || undefined} className="border-t border-panel-rule aria-current:shadow-current-edge">
              <td className={`${cellClasses("rank")} text-soft`}>{rankAmong(team.stat, totals)}</td>
              <th scope="row" className={cellClasses("team")}>
                <button type="button" aria-pressed={current} onClick={() => select(team.teamId)} className="min-h-tap min-w-tap text-left font-semibold text-lead">
                  {team.name}
                </button>
              </th>
              {race.categories.map((category) => (
                <td key={category} className={`${cellClasses(category)} font-bold text-figure`}>
                  {statFigure(team.stats[category] ?? 0)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const categoryCells = (column: keyof typeof categoryColumns) => cellClassOf(column === "category");

/** The selected team's every category: its season total, and its rank among the league's teams. */
function TeamPanel({ team, race }: { team: RacingTeam; race: StatRace }) {
  return (
    <Panel title={team.name} namesTeam aside={<span className="text-soft">{everyCategoryWords}</span>}>
      <table className="w-full border-collapse">
        <ColumnHeads columns={categoryColumns} classOf={categoryCells} />
        <tbody>
          {race.categories.map((category) => {
            const total = team.stats[category] ?? 0;
            const rank = rankAmong(
              total,
              race.teams.map((each) => each.stats[category] ?? 0),
            );
            return (
              <tr key={category} className="border-t border-panel-rule">
                <th scope="row" className={`${categoryCells("category")} font-normal`}>
                  {categoryName(category)}
                </th>
                <td className={`${categoryCells("total")} font-bold text-figure`}>{statFigure(total)}</td>
                <td className={`${categoryCells("rank")} text-soft`}>{rankWords(rank, race.teams.length)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
