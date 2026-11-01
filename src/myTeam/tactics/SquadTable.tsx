import type { DragEvent, ReactNode } from "react";
import { roleIn, rolesOfSlot, slotLabel } from "../../../convex/lineup/roles";
import { cellClassOf, ColumnHeads } from "../../ui/ColumnHeads";
import { Placeholder } from "../../ui/Placeholder";
import { PositionChip } from "../../ui/PositionChip";
import type { SquadRow } from "../../../convex/squads/teamSquad";
import { figureWords, nextFixtureLong, nextFixtureShort, noFigureWords, noNextFixtureWords, noPointsWords, whenWords } from "../words";
import { markOf } from "./focusMarks";
import { benchBestRole, startersInOrder, type DraftLineup, type SquadMember, type Starter } from "./lineupDraft";
import { startDrag, type Moving } from "./pitch/Pitch";
import {
  BEST_ROLE_HEAD,
  BENCH_TITLE,
  benchPlaceLong,
  benchPlaceWords,
  emptyBenchWords,
  nextPlaceholder,
  roleFitPlaceholder,
  roleLabel,
  squadColumns,
  squadTableLabel,
  statusPlaceholder,
  swapLabel,
  toBenchWords,
} from "./words";

type Column = keyof typeof squadColumns;
const COLUMNS: readonly Column[] = ["position", "player", "next", "roleFit", "role", "season", "last"];
/** A phone leaves out the role fit and next fixture, for room (plate.md, The phone: the squad table
 *  keeps the player column and drops Role fit). */
const DESK_ONLY: readonly Column[] = ["next", "roleFit"];
const FIGURES: readonly Column[] = ["season", "last"];
const cellClasses = (column: Column) => cellClassOf(!FIGURES.includes(column), DESK_ONLY.includes(column));
/** The bench plate's first cell spans the columns before Role, where Best role heads the bench's. */
const BEFORE_ROLE = COLUMNS.indexOf("role");

/** Each squad player's row on the Squad tab's read (convex/squads/teamSquad.ts), by his code: his
 *  next fixture and points; undefined while it loads. */
export type SeasonOf = ReadonlyMap<number, SquadRow> | undefined;

/** The Selection table (the approved Tactics picture; plate.md, Tables and panels): the eleven back
 *  to front, each led by his slot's position chip, then the bench in order under its own plate,
 *  each led by his place and his main position, with the role he'd play best there, muted. A tap on
 *  a player opens his panel, where Move is (no action column); a row drags onto the pitch, and with
 *  a starter picked up, the bench's plate offers to take him. A player he can swap with is lit, and
 *  a tap or a drop on him swaps them (spec/05, Moving players); a player dropped on any other bench
 *  row takes its place (spec/05 Auto-subs). */
export function SquadTable({
  draft,
  squad,
  season,
  moving,
  onBench,
  onBenchAt,
  onRole,
}: {
  draft: DraftLineup;
  squad: ReadonlyMap<number, SquadMember>;
  season: SeasonOf;
  moving: Moving;
  onBench(): void;
  onBenchAt(playerCode: number, index: number): void;
  onRole(playerCode: number, role: string): void;
}) {
  const { picked } = moving;
  const pickedStarts = picked !== null && draft.starters.some((starter) => starter.playerCode === picked.playerCode);
  const allowDrop = (event: DragEvent) => {
    if (pickedStarts) event.preventDefault();
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    if (pickedStarts) onBench();
  };
  const row = (playerCode: number, place: { starter: Starter } | { benchIndex: number }) => (
    <SelectionRow key={playerCode} player={squad.get(playerCode)!} season={season?.get(playerCode) ?? (season === undefined ? undefined : null)} place={place} onBenchAt={onBenchAt} onRole={onRole} moving={moving} />
  );
  return (
    <table aria-label={squadTableLabel} className="w-full border-collapse">
      <ColumnHeads columns={squadColumns} shown={COLUMNS} classOf={cellClasses} />
      <tbody>{startersInOrder(draft).map((starter) => row(starter.playerCode, { starter }))}</tbody>
      <tbody onDragOver={allowDrop} onDrop={drop}>
        <tr className="bg-plate">
          <th scope="rowgroup" colSpan={BEFORE_ROLE} className="px-2 text-left font-bold">
            <span className="flex flex-wrap items-center justify-between gap-2">
              {BENCH_TITLE}
              {pickedStarts && (
                <button type="button" onClick={onBench} className="secondary-action lg:min-h-0">
                  {toBenchWords(picked.name)}
                </button>
              )}
            </span>
          </th>
          <th scope="col" className={`${cellClasses("role")} font-bold`}>
            {BEST_ROLE_HEAD}
          </th>
          <td colSpan={COLUMNS.length - BEFORE_ROLE - 1} />
        </tr>
        {draft.bench.length === 0 ? (
          <tr>
            <td colSpan={COLUMNS.length} className="px-2 text-muted">
              {emptyBenchWords}
            </td>
          </tr>
        ) : (
          draft.bench.map((playerCode, benchIndex) => row(playerCode, { benchIndex }))
        )}
      </tbody>
    </table>
  );
}

function SelectionRow({
  player,
  season,
  place,
  onBenchAt,
  onRole,
  moving,
}: {
  player: SquadMember;
  /** His row on the Squad tab's read: undefined while it loads, null where it has none (one the
   *  football sync doesn't hold). */
  season: SquadRow | null | undefined;
  place: { starter: Starter } | { benchIndex: number };
  onBenchAt(playerCode: number, index: number): void;
  onRole(playerCode: number, role: string): void;
  moving: Moving;
}) {
  const { picked } = moving;
  const shown = moving.selected === player.playerCode || picked?.playerCode === player.playerCode;
  const benchIndex = "benchIndex" in place ? place.benchIndex : null;
  const lit = moving.reach?.players.includes(player.playerCode) ?? false;
  const swapsWith = lit && picked !== null;
  // A player dragged onto a lit row swaps with him; onto any other bench row, takes its place. The
  // bench's own drop (to the end) is for the rest of it.
  const takesDrop = picked !== null && (lit || benchIndex !== null);
  const allowDrop = (event: DragEvent) => {
    if (takesDrop) event.preventDefault();
  };
  const drop = (event: DragEvent) => {
    if (!takesDrop) return;
    event.preventDefault();
    event.stopPropagation();
    if (lit) moving.onSwap(player.playerCode);
    else if (benchIndex !== null) onBenchAt(picked.playerCode, benchIndex);
  };
  return (
    <tr
      draggable
      onDragStart={(event) => startDrag(event, player.playerCode, moving)}
      onDragEnd={moving.onDragEnd}
      onDragOver={allowDrop}
      onDrop={drop}
      aria-current={shown || undefined}
      className="border-t border-panel-rule aria-current:bg-name-plate aria-current:shadow-current-edge lg:h-7"
    >
      <td className={cellClasses("position")}>
        <PositionCell player={player} place={place} />
      </td>
      <th scope="row" className={`${cellClasses("player")} font-normal whitespace-nowrap`}>
        <button
          type="button"
          {...(benchIndex !== null ? markOf("player", player.playerCode) : {})}
          aria-pressed={swapsWith ? undefined : moving.selected === player.playerCode}
          aria-label={swapsWith ? swapLabel(picked.name, player.name) : undefined}
          onClick={() => (swapsWith ? moving.onSwap(player.playerCode) : moving.onSelect(player.playerCode))}
          className={`inline-flex min-h-tap items-center text-lead font-semibold lg:min-h-0 ${player.unheld ? "max-w-error-name text-event lg:max-w-none" : ""} ${swapsWith ? "outline-2 outline-dashed outline-pitch-line" : ""}`}
        >
          {player.name}
        </button>
        {player.clubShortName !== null && <span className="ml-1 text-muted">{player.clubShortName}</span>}
        <Placeholder label={statusPlaceholder(player.name)} className="ml-1 size-3 align-middle" />
      </th>
      <td className={cellClasses("next")}>
        <NextCell season={season} />
      </td>
      <td className={cellClasses("roleFit")}>
        <Placeholder label={roleFitPlaceholder} className="h-3 w-16 align-middle" />
      </td>
      <td className={cellClasses("role")}>
        {"starter" in place ? <RolePicker player={player} starter={place.starter} onRole={onRole} /> : <span className="text-muted">{benchBestRole(player)?.role.name}</span>}
      </td>
      <PointsCell column="season" points={season?.seasonPoints} />
      <PointsCell column="last" points={season?.lastGameweekPoints} />
    </tr>
  );
}

/** A starter's slot chip; a bench player's place, then his main position's chip. */
function PositionCell({ player, place }: { player: SquadMember; place: { starter: Starter } | { benchIndex: number } }) {
  if ("starter" in place) return <PositionChip label={slotLabel(place.starter, place.starter.role)} />;
  const main = player.positions[0];
  return (
    <span className="inline-flex items-center gap-2">
      <abbr title={benchPlaceLong(place.benchIndex)} className="text-muted no-underline">
        {benchPlaceWords(place.benchIndex)}
      </abbr>
      {main !== undefined && <PositionChip label={main} />}
    </span>
  );
}

/** His next fixture, the whole cell, with an outline in place of its difficulty colour. */
export function NextCell({ season }: { season: SquadRow | null | undefined }) {
  if (season === undefined) return null;
  const next = season?.nextFixture ?? null;
  if (next === null)
    return (
      <span title={noNextFixtureWords} className="text-muted">
        {noFigureWords}
      </span>
    );
  const short = nextFixtureShort(next.opponent.shortName, next.home);
  return (
    <Placeholder label={nextPlaceholder(nextFixtureLong(next.opponent.name, next.home, whenWords(next.kickoff)))} className="w-full px-1 whitespace-nowrap">
      {short}
    </Placeholder>
  );
}

/** A starter's role, one of his slot's (spec/05 Roles): the role card waits on #848. */
function RolePicker({ player, starter, onRole }: { player: SquadMember; starter: Starter; onRole(playerCode: number, role: string): void }) {
  return (
    <select
      aria-label={roleLabel(player.name)}
      {...markOf("role", player.playerCode)}
      value={roleIn(starter, starter.role).key}
      onChange={(event) => onRole(player.playerCode, event.target.value)}
      className="text-box w-full lg:min-h-0"
    >
      {rolesOfSlot(starter).map(({ key, name }) => (
        <option key={key} value={key}>
          {name}
        </option>
      ))}
    </select>
  );
}

function PointsCell({ column, points }: { column: Column; points: number | null | undefined }): ReactNode {
  if (points === undefined) return <td className={cellClasses(column)} />;
  return points === null ? (
    <td title={noPointsWords} className={`${cellClasses(column)} text-muted`}>
      {noFigureWords}
    </td>
  ) : (
    <td className={`${cellClasses(column)} font-bold text-figure`}>{figureWords(points)}</td>
  );
}
