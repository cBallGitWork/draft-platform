import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { CatalogueStat } from "../../convex/scoring/statCatalogueList";
import { ClubShort } from "../premierLeague/ClubName";
import { Filters } from "../scouting/Filters";
import { statFigure } from "../scouting/figures";
import type { ListedPlayer, PlayersFilters, PlayersSort, SortColumn } from "../scouting/seam";
import { columns, figureWords, noFigureWords, noneMatchWords, statLabel } from "../scouting/words";
import { useLastLoaded } from "../shared/useLastLoaded";
import { cellClassOf, ColumnHeads, type ColumnWords } from "../ui/ColumnHeads";
import { Loading, Panel, PanelNote } from "../ui/Panel";
import { PositionChip } from "../ui/PositionChip";
import type { DraftSeam, GreyedPlayer } from "./seam";
import { leftWords, loadingPlayersWords, notLegalWords, PLAYERS_TITLE, selectLabel } from "./words";

// The draft room's players list (spec/04, The draft room; #1099): Scouting's list and filters
// (spec/19). Players already drafted drop out of it, and Scouting's owner filter shows them (Craig,
// 4 Nov 2026, on #1099: "rec yes"). A player the reader's team can't take stays in his place,
// greyed out, with why (Craig, 4 Nov 2026). A row opens his panel beside the list (PickPanel.tsx).

/** The list opens on the players nobody has drafted yet, by name, as Scouting's does. */
const OPENING_FILTERS: PlayersFilters = { availability: "freeAgents", position: null, clubCode: null };
type Column = "positions" | "name" | "seasonPoints" | "stat";
const SORTABLE = ["name", "seasonPoints", "stat"] as const satisfies readonly (Column & SortColumn)[];
type Sortable = (typeof SORTABLE)[number];
type Sort = PlayersSort & { by: Sortable };

const OPENING_SORT: Sort = { by: "name", descending: false };
/** A head pressed first sorts names A to Z and figures most first, as Scouting's do. */
const FIRST_DESCENDING: Record<Sortable, boolean> = { name: false, seasonPoints: true, stat: true };
const cellClasses = (column: Column) => cellClassOf(column === "positions" || column === "name");

/** Why each greyed-out player can't be taken, by his code. */
export type WhyNot = ReadonlyMap<number, GreyedPlayer["reason"]>;

export function DraftPlayers({
  leagueId,
  usePlayersList,
  whyNot,
  selected,
  select,
}: {
  leagueId: Id<"leagues">;
  usePlayersList: DraftSeam["usePlayersList"];
  whyNot: WhyNot;
  selected: ListedPlayer | null;
  select: (player: ListedPlayer) => void;
}) {
  const [filters, setFilters] = useState(OPENING_FILTERS);
  const [sort, setSort] = useState(OPENING_SORT);
  const [stat, setStat] = useState<CatalogueStat | null>(null);
  // While a changed filter or sort loads, the last list stays up, so the club filter keeps its clubs.
  const list = useLastLoaded(usePlayersList(leagueId, filters, sort, stat?.stat ?? null));
  const sortBy = (by: Sortable) => setSort(by === sort.by ? { by, descending: !sort.descending } : { by, descending: FIRST_DESCENDING[by] });
  const show = (chosen: CatalogueStat | null) => {
    setStat(chosen);
    if (chosen !== null) setSort({ by: "stat", descending: FIRST_DESCENDING.stat });
    else if (sort.by === "stat") setSort(OPENING_SORT);
  };
  const shown: readonly Column[] = stat === null ? ["positions", "name", "seasonPoints"] : ["positions", "name", "seasonPoints", "stat"];
  return (
    <Panel title={PLAYERS_TITLE} aside={list && <span className="text-soft">{leftWords(list.players.length)}</span>} className="min-w-0 grow basis-squad-table">
      <Filters filters={filters} clubs={list?.clubs} filterBy={(change) => setFilters({ ...filters, ...change })} stat={stat} show={show} />
      {list === undefined ? (
        <Loading className="px-3 py-2">{loadingPlayersWords}</Loading>
      ) : list.players.length === 0 ? (
        <PanelNote>{noneMatchWords}</PanelNote>
      ) : (
        <table className="w-full border-collapse">
          <ColumnHeads<Column, Sortable> columns={headsOf(stat)} shown={shown} classOf={cellClasses} sort={{ ...sort, sortable: SORTABLE, sortBy }} />
          <tbody>
            {list.players.map((player) => (
              <PlayerRow key={player.code} player={player} shown={shown} whyNot={whyNot.get(player.code)} current={selected?.code === player.code} select={select} />
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** The columns' heads, Scouting's own; the stat column's is the shown stat's short code, named by
 *  its catalogue name. */
const headsOf = (stat: CatalogueStat | null): Record<Column, ColumnWords> => ({
  positions: columns.positions,
  name: columns.name,
  seasonPoints: columns.seasonPoints,
  stat: stat === null ? { short: statLabel, long: statLabel } : { short: stat.shortCode, long: stat.name },
});

/** A player's row: greyed out, with why, when the reader's team can't take him; a drafted player
 *  (shown by the owner filter) by the team that has him. */
function PlayerRow({
  player,
  shown,
  whyNot,
  current,
  select,
}: {
  player: ListedPlayer;
  shown: readonly Column[];
  whyNot: GreyedPlayer["reason"] | undefined;
  current: boolean;
  select: (player: ListedPlayer) => void;
}) {
  const greyed = whyNot !== undefined || player.ownerTeamName !== null;
  const note = player.ownerTeamName ?? (whyNot === undefined ? null : notLegalWords[whyNot]);
  return (
    <tr aria-current={current || undefined} className={`border-t border-panel-rule aria-current:bg-name-plate aria-current:shadow-current-edge lg:h-row ${greyed ? "text-muted" : ""}`}>
      {shown.map((column) => {
        const className = cellClasses(column);
        switch (column) {
          case "positions":
            return <td key={column} className={className}>{player.positions[0] !== undefined && <PositionChip label={player.positions[0]} />}</td>;
          case "name":
            return (
              <th key={column} scope="row" title={player.fullName} className={`${className} font-normal whitespace-nowrap`}>
                <button
                  type="button"
                  aria-label={selectLabel(player.name)}
                  aria-pressed={current}
                  onClick={() => select(player)}
                  className={`inline-flex min-h-tap min-w-tap items-center font-semibold lg:min-h-0 lg:min-w-0 ${greyed ? "" : "text-lead"}`}
                >
                  {player.name}
                </button>
                <ClubShort club={player.club} className="ml-1 text-muted" />
                {note !== null && <span className="ml-2 text-muted">{note}</span>}
              </th>
            );
          case "seasonPoints":
            return (
              <td key={column} className={`${className} ${greyed ? "" : "font-bold text-figure"}`}>
                {player.seasonPoints === null ? noFigureWords : figureWords(player.seasonPoints)}
              </td>
            );
          case "stat":
            return (
              <td key={column} className={className}>
                {player.stat === null ? noFigureWords : statFigure(player.stat)}
              </td>
            );
        }
      })}
    </tr>
  );
}
