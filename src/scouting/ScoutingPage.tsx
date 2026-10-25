import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { POSITIONS, type Position } from "../../convex/positions/positionTables";
import { STAT_CATALOGUE, type CatalogueStat } from "../../convex/scoring/statCatalogue";
import { Loading, PANEL_BODY, PageSection, PanelNote, PanelTitle } from "../frame/Panel";
import { playerCardPath } from "../playerCard/paths";
import { Choice } from "../rules/Choice";
import { PositionCodes } from "../PositionCodes";
import { statFigure } from "./figures";
import { POSITION_NAMES } from "../words";
import type { Availability, ListedPlayer, PlayersFilters, PlayersList, PlayersSort, ScoutingSeam, SortColumn } from "./seam";
import { ShortlistPanel } from "./ShortlistPanel";
import {
  availabilityLabel,
  ascendingGlyph,
  availabilityWords,
  clubLabel,
  columns,
  countWords,
  descendingGlyph,
  everyClubWords,
  everyPositionWords,
  freeAgentWords,
  loadingWords,
  noFigureWords,
  noneMatchWords,
  noPointsYetWords,
  noRoleFitYetWords,
  noStatWords,
  noWaiversWords,
  PLAYERS_TITLE,
  positionLabel,
  SCOUTING_TITLE,
  sortByLabel,
  statLabel,
} from "./words";

const TITLE_ID = "players-title";
const POSITION_ID = "players-position";
const CLUB_ID = "players-club";
const STAT_ID = "players-stat";
/** A select's value for "every one": no position or club code is empty. */
const EVERY = "";

const AVAILABILITIES: readonly Availability[] = ["all", "freeAgents", "onWaivers", "owned"];
const OPENING_FILTERS: PlayersFilters = { availability: "all", position: null, clubCode: null };
/** The list opens by name: no player has season points to rank by until matches are scored (#29).
 *  A head pressed first sorts names A to Z and figures most first. */
const OPENING_SORT: PlayersSort = { by: "name", descending: false };
const FIRST_DESCENDING: Record<SortColumn, boolean> = { name: false, club: false, seasonPoints: true, stat: true };

/** The list's columns: the fixed ones, and "stat" for the shown stat's season total. */
type Column = keyof typeof columns | "stat";
const COLUMNS: readonly Column[] = ["name", "club", "positions", "owner", "seasonPoints", "roleFit"];
const SORTED_BY: Partial<Record<Column, SortColumn>> = { name: "name", club: "club", seasonPoints: "seasonPoints", stat: "stat" };
/** Columns a phone leaves out, for room: the filters say who owns whom. */
const DESK_ONLY: readonly Column[] = ["owner", "roleFit"];
const FIGURES: readonly Column[] = ["seasonPoints", "roleFit", "stat"];
const STAT_BY_KEY = new Map(STAT_CATALOGUE.map((each) => [each.stat, each]));

/** A column's cells: names read from the left, figures line up on the right, and a phone leaves
 *  out what it has no room for. */
const cellClasses = (column: Column) =>
  `px-2 align-middle ${FIGURES.includes(column) ? "text-right" : "text-left"} ${DESK_ONLY.includes(column) ? "hidden sm:table-cell" : ""}`;

/** Scouting (spec/19), for anyone in the league: every Premier League player, filtered by who holds
 *  him, his position and his club, any stat shown as a season total, and sorted by a column's head,
 *  all on the server. */
export function ScoutingPage({ league, seam }: { league: LeagueSummary; seam: ScoutingSeam }) {
  const [filters, setFilters] = useState(OPENING_FILTERS);
  const [sort, setSort] = useState(OPENING_SORT);
  const [stat, setStat] = useState<CatalogueStat | null>(null);
  const loaded = seam.usePlayersList(league.leagueId, filters, sort, stat?.stat ?? null);
  // While a changed filter or sort loads, the last list stays up, so the club filter keeps its clubs.
  const lastLoaded = useRef(loaded);
  useEffect(() => {
    if (loaded !== undefined) lastLoaded.current = loaded;
  }, [loaded]);
  const list = loaded ?? lastLoaded.current;
  const filterBy = (change: Partial<PlayersFilters>) => setFilters({ ...filters, ...change });
  const sortBy = (by: SortColumn) => setSort(by === sort.by ? { by, descending: !sort.descending } : { by, descending: FIRST_DESCENDING[by] });
  // A stat chosen is sorted by, most first; with none, a sort by the stat goes back to the opening one.
  const show = (chosen: CatalogueStat | null) => {
    setStat(chosen);
    if (chosen !== null) setSort({ by: "stat", descending: FIRST_DESCENDING.stat });
    else if (sort.by === "stat") setSort(OPENING_SORT);
  };
  return (
    <PageSection title={SCOUTING_TITLE} className="flex max-w-6xl flex-col gap-2">
      <ShortlistPanel leagueId={league.leagueId} seam={seam} />
      <section aria-labelledby={TITLE_ID} className="bg-panel">
        <PanelTitle id={TITLE_ID}>{PLAYERS_TITLE}</PanelTitle>
        <Filters filters={filters} clubs={list?.clubs} filterBy={filterBy} stat={stat} show={show} />
        {list === undefined ? (
          <Loading className="px-3 py-2">{loadingWords}</Loading>
        ) : list.players.length === 0 ? (
          <PanelNote>{filters.availability === "onWaivers" ? noWaiversWords : noneMatchWords}</PanelNote>
        ) : (
          <>
            <PanelNote edge="b">{countWords(list.players.length)}</PanelNote>
            <PlayersTable leagueId={league.leagueId} players={list.players} stat={stat} sort={sort} sortBy={sortBy} />
          </>
        )}
      </section>
    </PageSection>
  );
}

function Filters({
  filters,
  clubs,
  filterBy,
  stat,
  show,
}: {
  filters: PlayersFilters;
  clubs: PlayersList["clubs"] | undefined;
  filterBy: (change: Partial<PlayersFilters>) => void;
  stat: CatalogueStat | null;
  show: (chosen: CatalogueStat | null) => void;
}) {
  return (
    <div className={PANEL_BODY}>
      <Choice
        label={availabilityLabel}
        name="players-availability"
        options={AVAILABILITIES}
        words={availabilityWords}
        chosen={filters.availability}
        onChoose={(availability) => filterBy({ availability })}
      />
      <div className="flex flex-wrap gap-3">
        <span className="flex items-center gap-2">
          <label htmlFor={POSITION_ID} className="text-soft">
            {positionLabel}
          </label>
          <select
            id={POSITION_ID}
            value={filters.position ?? EVERY}
            onChange={(event) => filterBy({ position: event.target.value === EVERY ? null : (event.target.value as Position) })}
            className="text-box"
          >
            <option value={EVERY}>{everyPositionWords}</option>
            {POSITIONS.map((position) => (
              <option key={position} value={position}>
                {POSITION_NAMES[position]}
              </option>
            ))}
          </select>
        </span>
        <span className="flex items-center gap-2">
          <label htmlFor={CLUB_ID} className="text-soft">
            {clubLabel}
          </label>
          <select
            id={CLUB_ID}
            value={filters.clubCode ?? EVERY}
            onChange={(event) => filterBy({ clubCode: event.target.value === EVERY ? null : Number(event.target.value) })}
            className="text-box"
          >
            <option value={EVERY}>{everyClubWords}</option>
            {(clubs ?? []).map((club) => (
              <option key={club.code} value={club.code}>
                {club.name}
              </option>
            ))}
          </select>
        </span>
        <span className="flex items-center gap-2">
          <label htmlFor={STAT_ID} className="text-soft">
            {statLabel}
          </label>
          <select
            id={STAT_ID}
            value={stat?.stat ?? EVERY}
            onChange={(event) => show(STAT_BY_KEY.get(event.target.value) ?? null)}
            className="text-box"
          >
            <option value={EVERY}>{noStatWords}</option>
            {STAT_CATALOGUE.map((each) => (
              <option key={each.stat} value={each.stat}>
                {each.name}
              </option>
            ))}
          </select>
        </span>
      </div>
    </div>
  );
}

function PlayersTable({
  leagueId,
  players,
  stat,
  sort,
  sortBy,
}: {
  leagueId: Id<"leagues">;
  players: readonly ListedPlayer[];
  stat: CatalogueStat | null;
  sort: PlayersSort;
  sortBy: (by: SortColumn) => void;
}) {
  const shown: readonly Column[] = stat === null ? COLUMNS : [...COLUMNS, "stat"];
  return (
    <table className="w-full border-collapse">
      <thead className="bg-head text-ground">
        <tr>
          {shown.map((column) => (
            <ColumnHead key={column} column={column} stat={stat} sort={sort} sortBy={sortBy} />
          ))}
        </tr>
      </thead>
      <tbody>
        {players.map((player) => (
          <tr key={player.code} className="border-t border-panel-rule">
            {shown.map((column) => (
              <PlayerCell key={column} column={column} player={player} leagueId={leagueId} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A column's head: its short code, the full name on hover (the shown stat's from the catalogue); a
 *  sortable one is a button, and the column sorted by says which way. */
function ColumnHead({
  column,
  stat,
  sort,
  sortBy,
}: {
  column: Column;
  stat: CatalogueStat | null;
  sort: PlayersSort;
  sortBy: (by: SortColumn) => void;
}) {
  const { short, long } = column === "stat" ? { short: stat!.shortCode, long: stat!.name } : columns[column];
  const by = SORTED_BY[column];
  const sorted = by !== undefined && by === sort.by;
  return (
    <th
      scope="col"
      title={long}
      aria-sort={sorted ? (sort.descending ? "descending" : "ascending") : undefined}
      className={cellClasses(column)}
    >
      {by === undefined ? (
        short
      ) : (
        <button type="button" aria-label={sortByLabel(long)} onClick={() => sortBy(by)} className="min-h-tap font-bold">
          {short}
          {sorted && <span aria-hidden="true"> {sort.descending ? descendingGlyph : ascendingGlyph}</span>}
        </button>
      )}
    </th>
  );
}

/** One cell of a player's row: his name heads it, his points are its figure. */
function PlayerCell({ column, player, leagueId }: { column: Column; player: ListedPlayer; leagueId: Id<"leagues"> }) {
  const className = cellClasses(column);
  switch (column) {
    case "name":
      return (
        <th scope="row" title={player.fullName} className={`${className} text-lead font-semibold`}>
          <Link to={playerCardPath(leagueId, player.code)} className="flex min-h-tap items-center">
            {player.name}
          </Link>
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
    case "positions":
      return (
        <td className={className}>
          <PositionCodes positions={player.positions} />
        </td>
      );
    case "owner":
      return <td className={player.ownerTeamName === null ? `${className} text-muted` : className}>{player.ownerTeamName ?? freeAgentWords}</td>;
    case "seasonPoints":
      return player.seasonPoints === null ? (
        <td title={noPointsYetWords} className={`${className} text-muted`}>
          {noFigureWords}
        </td>
      ) : (
        <td className={`${className} font-bold text-figure`}>{player.seasonPoints}</td>
      );
    case "stat":
      return <td className={`${className} font-bold text-figure`}>{player.stat === null ? noFigureWords : statFigure(player.stat)}</td>;
    case "roleFit":
      // Role stars show for every player until scouts exist (spec/19, Role stars); roles aren't
      // built yet, so none has any.
      return (
        <td title={noRoleFitYetWords} className={`${className} text-muted`}>
          {noFigureWords}
        </td>
      );
  }
}
