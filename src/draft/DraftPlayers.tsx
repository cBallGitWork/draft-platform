import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { cardOpensAt } from "../../convex/playerCard/cardPoints";
import type { Position } from "../../convex/positions/positionTables";
import type { CatalogueStat } from "../../convex/scoring/statCatalogueList";
import { ClubShort } from "../ui/ClubName";
import { StatBox } from "../ui/StatBox";
import { statFigure } from "../shared/figures";
import type { ListedPlayer, PlayersFilters, PlayersSort } from "../scouting/seam";
import { columns, figureWords, noFigureWords, noneMatchWords, statLabel } from "../scouting/words";
import { useLastLoaded } from "../shared/useLastLoaded";
import { useListSort } from "../shared/useListSort";
import { cellClassOf, ColumnHeads, type ColumnWords } from "../ui/ColumnHeads";
import { Loading, Panel, PanelNote } from "../ui/Panel";
import { PositionChip } from "../ui/PositionChip";
import {
  FIRST_DESCENDING,
  keptPlayers,
  OPENING_SORT,
  OVERVIEW_COLUMNS,
  sortedPlayers,
  withFigures,
  type RoomPlayer,
  type RoomSortColumn,
} from "./playersView";
import { PositionTabs } from "./PositionTabs";
import type { DraftSeam, GreyedPlayer, RoomFigures } from "./seam";
import {
  draftColumns,
  findLabel,
  findPlaceholder,
  lastSeasonPointsColumn,
  leftWords,
  loadingPlayersWords,
  notLegalWords,
  overviewWords,
  PLAYERS_TITLE,
  queueMarkWords,
  selectLabel,
  statsLabel,
  takenWords,
} from "./words";

// The draft room's players list (spec/04, The draft room; #1099), as its approved picture draws it:
// Scouting's players (spec/19) nobody has drafted (Craig, 4 Nov 2026, on #1099: "rec yes"), a
// position tab and Find in the title bar, and the overview's stats, with Scouting's stat box for
// the others ("a easy to see view first, and section to allow user to deepdive"). It opens on the
// site's ranking. A player the reader's team can't take stays in his place, greyed out, with why
// (Craig, 4 Nov 2026); one in the reader's queue says where. A row opens his panel beside the list
// (PickPanel.tsx).

/** The list asks Scouting for every player nobody has drafted, by name; the tab, Find and the
 *  column heads work on them here, as the figures they sort by are the draft room's own. */
const UNDRAFTED: PlayersFilters = { availability: "freeAgents", position: null, clubCode: null };
const BY_NAME: PlayersSort = { by: "name", descending: false };

type Column = "positions" | RoomSortColumn;
const cellClasses = (column: Column) => cellClassOf(column === "positions" || column === "name");

const FIND_ID = "draft-players-find";
const STATS_ID = "draft-players-stats";

/** Why each greyed-out player can't be taken, by his code. */
export type WhyNot = ReadonlyMap<number, GreyedPlayer["reason"]>;

export function DraftPlayers({
  leagueId,
  usePlayersList,
  figures,
  whyNot,
  queue,
  selected,
  select,
}: {
  leagueId: Id<"leagues">;
  usePlayersList: DraftSeam["usePlayersList"];
  figures: RoomFigures | undefined;
  whyNot: WhyNot;
  /** The reader's queue, by code, first choice first. */
  queue: readonly number[];
  selected: ListedPlayer | null;
  select: (player: RoomPlayer) => void;
}) {
  const [position, setPosition] = useState<Position | null>(null);
  const [find, setFind] = useState("");
  const { sort, sortBy, stat, show } = useListSort<RoomSortColumn>(OPENING_SORT, FIRST_DESCENDING);
  // While a changed stat loads, the last list stays up.
  const list = useLastLoaded(usePlayersList(leagueId, UNDRAFTED, BY_NAME, stat?.stat ?? null));
  const shown: readonly Column[] = ["positions", "name", "rank", "lastSeasonPoints", ...(stat === null ? OVERVIEW_COLUMNS : (["stat"] as const))];
  const sortable = shown.filter((column): column is RoomSortColumn => column !== "positions");
  const queuePlace = new Map(queue.map((code, index) => [code, index + 1]));
  const players = list && figures && sortedPlayers(keptPlayers(withFigures(list.players, figures.players), position, find), sort);
  const titleBar = (
    <span className="ml-3 flex grow flex-wrap items-center gap-x-3 lg:flex-nowrap">
      <PositionTabs chosen={position} choose={setPosition} />
      <span className="flex items-center gap-2">
        <label htmlFor={FIND_ID} className="text-soft">
          {findLabel}
        </label>
        <input id={FIND_ID} type="search" value={find} placeholder={findPlaceholder} onChange={(event) => setFind(event.target.value)} className="text-box w-full lg:min-h-bar-control lg:w-40" />
      </span>
      <span className="ml-auto flex items-center gap-3">
        {list && <span className="text-soft">{leftWords(list.players.length)}</span>}
        <StatBox id={STATS_ID} label={statsLabel} noneWords={overviewWords} stat={stat} show={show} look="button" />
      </span>
    </span>
  );
  return (
    <Panel title={PLAYERS_TITLE} aside={titleBar} className="min-w-0 grow basis-squad-table">
      {players === undefined ? (
        <Loading className="px-3 py-2">{loadingPlayersWords}</Loading>
      ) : players.length === 0 ? (
        <PanelNote>{noneMatchWords}</PanelNote>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <ColumnHeads<Column, RoomSortColumn>
              columns={headsOf(stat, figures?.lastSeason ?? null)}
              shown={shown}
              classOf={cellClasses}
              sort={{ ...sort, sortable, sortBy }}
              deskRow
            />
            <tbody>
              {players.map((player) => (
                <PlayerRow
                  key={player.code}
                  player={player}
                  shown={shown}
                  whyNot={whyNot.get(player.code)}
                  queuePlace={queuePlace.get(player.code)}
                  current={selected?.code === player.code}
                  select={select}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** The columns' heads: Scouting's Pos and Player, the draft room's figures, and the stat column's
 *  head, the shown stat's short code, named by its catalogue name. */
const headsOf = (stat: CatalogueStat | null, lastSeason: number | null): Record<Column, ColumnWords> => ({
  positions: columns.positions,
  name: columns.name,
  ...draftColumns,
  lastSeasonPoints: lastSeasonPointsColumn(lastSeason),
  stat: stat === null ? { short: statLabel, long: statLabel } : { short: stat.shortCode, long: stat.name },
});

/** Why the reader's team can't take a player: the team that already has him, or the squad rule his
 *  pick would break; null when it can. */
export const whyNotWords = (player: ListedPlayer, whyNot: GreyedPlayer["reason"] | undefined): string | null =>
  player.ownerTeamName !== null ? takenWords(player.ownerTeamName) : whyNot === undefined ? null : notLegalWords[whyNot];

/** A figure's cell words: the figure, or "—" where there is none. */
const figureCell = (figure: number | null) => (figure === null ? noFigureWords : figureWords(figure));

/** A player's row: greyed out, chip and all, with why, when the reader's team can't take him; his
 *  place in the reader's queue after his club. */
function PlayerRow({
  player,
  shown,
  whyNot,
  queuePlace,
  current,
  select,
}: {
  player: RoomPlayer;
  shown: readonly Column[];
  whyNot: GreyedPlayer["reason"] | undefined;
  queuePlace: number | undefined;
  current: boolean;
  select: (player: RoomPlayer) => void;
}) {
  const note = whyNotWords(player, whyNot);
  const greyed = note !== null;
  return (
    <tr aria-current={current || undefined} className={`border-t border-panel-rule aria-current:bg-name-plate aria-current:shadow-current-edge lg:h-row ${greyed ? "text-muted" : ""}`}>
      {shown.map((column) => {
        const className = cellClasses(column);
        switch (column) {
          case "positions": {
            const main = cardOpensAt(player.positions);
            return <td key={column} className={className}>{main !== null && <PositionChip label={main} dimmed={greyed} />}</td>;
          }
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
                {note !== null ? (
                  <span className="ml-2 text-muted">{note}</span>
                ) : (
                  queuePlace !== undefined && <span className="ml-2 text-soft">{queueMarkWords(queuePlace)}</span>
                )}
              </th>
            );
          case "lastSeasonPoints": {
            const points = player.figure?.lastSeasonPoints ?? null;
            return (
              <td key={column} className={`${className} ${greyed || points === null ? "text-muted" : "font-bold text-figure"}`}>
                {figureCell(points)}
              </td>
            );
          }
          case "rank":
            return (
              <td key={column} className={className}>
                {figureCell(player.figure?.rank ?? null)}
              </td>
            );
          case "stat":
            return (
              <td key={column} className={className}>
                {player.stat === null ? noFigureWords : statFigure(player.stat)}
              </td>
            );
          default:
            return (
              <td key={column} className={className}>
                {figureCell(player.figure?.overview[column] ?? null)}
              </td>
            );
        }
      })}
    </tr>
  );
}
