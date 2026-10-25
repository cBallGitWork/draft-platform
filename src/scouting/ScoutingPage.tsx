import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { POSITIONS, type Position } from "../../convex/positions/positionTables";
import { COMPARED_PLAYERS } from "../../convex/scouting/comparedPlayers";
import { Loading, PANEL_BODY, PageSection, PanelNote, PanelTitle } from "../frame/Panel";
import { playerCardPath } from "../playerCard/paths";
import { Choice } from "../rules/Choice";
import { TickBox } from "../rules/TickBox";
import { PositionCodes } from "../PositionCodes";
import { POSITION_NAMES } from "../words";
import { ComparePanel, type PickedPlayer } from "./ComparePanel";
import type { Availability, ListedPlayer, PlayersFilters, PlayersList, PlayersSort, ScoutingSeam, SortColumn } from "./seam";
import { ShortlistPanel } from "./ShortlistPanel";
import {
  availabilityLabel,
  ascendingGlyph,
  availabilityWords,
  clubLabel,
  columns,
  compareLabel,
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
  noWaiversWords,
  PLAYERS_TITLE,
  positionLabel,
  SCOUTING_TITLE,
  sortByLabel,
} from "./words";

const TITLE_ID = "players-title";
const POSITION_ID = "players-position";
const CLUB_ID = "players-club";
/** A select's value for "every one": no position or club code is empty. */
const EVERY = "";

const AVAILABILITIES: readonly Availability[] = ["all", "freeAgents", "onWaivers", "owned"];
const OPENING_FILTERS: PlayersFilters = { availability: "all", position: null, clubCode: null };
/** The list opens by name: no player has season points to rank by until matches are scored (#29).
 *  A head pressed first sorts names A to Z and figures most first. */
const OPENING_SORT: PlayersSort = { by: "name", descending: false };
const FIRST_DESCENDING: Record<SortColumn, boolean> = { name: false, club: false, seasonPoints: true };

type Column = keyof typeof columns;
const COLUMNS: readonly Column[] = ["compare", "name", "club", "positions", "owner", "seasonPoints", "roleFit"];
const SORTED_BY: Partial<Record<Column, SortColumn>> = { name: "name", club: "club", seasonPoints: "seasonPoints" };
/** Columns a phone leaves out, for room: the filters say who owns whom. */
const DESK_ONLY: readonly Column[] = ["owner", "roleFit"];
const FIGURES: readonly Column[] = ["seasonPoints", "roleFit"];

/** A column's cells: names read from the left, figures line up on the right, and a phone leaves
 *  out what it has no room for. */
const cellClasses = (column: Column) =>
  `px-2 align-middle ${FIGURES.includes(column) ? "text-right" : "text-left"} ${DESK_ONLY.includes(column) ? "hidden sm:table-cell" : ""}`;

/** Scouting (spec/19), for anyone in the league: every Premier League player, filtered by who holds
 *  him, his position and his club, and sorted by a column's head, all on the server; any two
 *  ticked are compared side by side above the list. */
export function ScoutingPage({ league, seam }: { league: LeagueSummary; seam: ScoutingSeam }) {
  const [filters, setFilters] = useState(OPENING_FILTERS);
  const [sort, setSort] = useState(OPENING_SORT);
  const loaded = seam.usePlayersList(league.leagueId, filters, sort);
  // While a changed filter or sort loads, the last list stays up, so the club filter keeps its clubs.
  const lastLoaded = useRef(loaded);
  useEffect(() => {
    if (loaded !== undefined) lastLoaded.current = loaded;
  }, [loaded]);
  const list = loaded ?? lastLoaded.current;
  const [picked, setPicked] = useState<readonly PickedPlayer[]>([]);
  const comparison = seam.useComparison(league.leagueId, picked.length === COMPARED_PLAYERS ? picked.map((each) => each.code) : null);
  // A third ticked takes the place of the first, so the comparison always holds the last two.
  const pick = ({ code, name }: ListedPlayer, ticked: boolean) =>
    setPicked(ticked ? [...picked, { code, name }].slice(-COMPARED_PLAYERS) : picked.filter((each) => each.code !== code));
  const filterBy = (change: Partial<PlayersFilters>) => setFilters({ ...filters, ...change });
  const sortBy = (by: SortColumn) => setSort(by === sort.by ? { by, descending: !sort.descending } : { by, descending: FIRST_DESCENDING[by] });
  return (
    <PageSection title={SCOUTING_TITLE} className="flex max-w-6xl flex-col gap-2">
      {picked.length > 0 && <ComparePanel picked={picked} comparison={comparison} clear={() => setPicked([])} />}
      <ShortlistPanel leagueId={league.leagueId} seam={seam} />
      <section aria-labelledby={TITLE_ID} className="bg-panel">
        <PanelTitle id={TITLE_ID}>{PLAYERS_TITLE}</PanelTitle>
        <Filters filters={filters} clubs={list?.clubs} filterBy={filterBy} />
        {list === undefined ? (
          <Loading className="px-3 py-2">{loadingWords}</Loading>
        ) : list.players.length === 0 ? (
          <PanelNote>{filters.availability === "onWaivers" ? noWaiversWords : noneMatchWords}</PanelNote>
        ) : (
          <>
            <PanelNote edge="b">{countWords(list.players.length)}</PanelNote>
            <PlayersTable leagueId={league.leagueId} players={list.players} sort={sort} sortBy={sortBy} picked={picked} pick={pick} />
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
}: {
  filters: PlayersFilters;
  clubs: PlayersList["clubs"] | undefined;
  filterBy: (change: Partial<PlayersFilters>) => void;
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
      </div>
    </div>
  );
}

function PlayersTable({
  leagueId,
  players,
  sort,
  sortBy,
  picked,
  pick,
}: {
  leagueId: Id<"leagues">;
  players: readonly ListedPlayer[];
  sort: PlayersSort;
  sortBy: (by: SortColumn) => void;
  picked: readonly PickedPlayer[];
  pick: (player: ListedPlayer, ticked: boolean) => void;
}) {
  return (
    <table className="w-full border-collapse">
      <thead className="bg-head text-ground">
        <tr>
          {COLUMNS.map((column) => (
            <ColumnHead key={column} column={column} sort={sort} sortBy={sortBy} />
          ))}
        </tr>
      </thead>
      <tbody>
        {players.map((player) => (
          <tr key={player.code} className="border-t border-panel-rule">
            {COLUMNS.map((column) => (
              <PlayerCell
                key={column}
                column={column}
                player={player}
                leagueId={leagueId}
                ticked={picked.some((each) => each.code === player.code)}
                pick={pick}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A column's head: its short code, the full name on hover; a sortable one is a button, and the
 *  column sorted by says which way. */
function ColumnHead({ column, sort, sortBy }: { column: Column; sort: PlayersSort; sortBy: (by: SortColumn) => void }) {
  const { short, long } = columns[column];
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
function PlayerCell({
  column,
  player,
  leagueId,
  ticked,
  pick,
}: {
  column: Column;
  player: ListedPlayer;
  leagueId: Id<"leagues">;
  ticked: boolean;
  pick: (player: ListedPlayer, ticked: boolean) => void;
}) {
  const className = cellClasses(column);
  switch (column) {
    case "compare":
      return (
        <td className={className}>
          <TickBox checked={ticked} onChange={(checked) => pick(player, checked)}>
            <span className="sr-only">{compareLabel(player.name)}</span>
          </TickBox>
        </td>
      );
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
