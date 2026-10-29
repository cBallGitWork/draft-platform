import { Link } from "@tanstack/react-router";
import type { DragEvent } from "react";
import { ColumnHeads } from "../ui/ColumnHeads";
import { playerCardPath } from "../playerCard/paths";
import { roleIn, rolesOfSlot } from "../../convex/lineup/roles";
import { markOf } from "./focusMarks";
import { startersInOrder, type DraftLineup, type SquadMember, type Starter } from "./lineupDraft";
import { startDrag, type Moving } from "./Pitch";
import {
  BENCH_TITLE,
  downLabel,
  downWords,
  emptyBenchWords,
  moveLabel,
  moveWords,
  roleLabel,
  movingWords,
  positionsWords,
  squadColumns,
  squadTableLabel,
  toBenchWords,
  upLabel,
  upWords,
} from "./tacticsWords";

const COLUMNS = ["position", "player", "role", "move"] as const;

/** The eleven back to front, then the bench in order under its own plate (plate.md, Marks). Each
 *  row's Move picks the player up, and a row drags onto the pitch; with a starter picked up, the
 *  bench's plate offers to take him. A bench row's Up and Down set the bench order, and a player
 *  dropped on a bench row takes its place (spec/05 Auto-subs). */
export function SquadTable({
  leagueId,
  draft,
  squad,
  moving,
  onBench,
  onBenchAt,
  onRole,
}: {
  leagueId: string;
  draft: DraftLineup;
  squad: ReadonlyMap<number, SquadMember>;
  moving: Moving;
  onBench(): void;
  onBenchAt(playerCode: number, index: number, pressed?: "up" | "down"): void;
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
  const row = (playerCode: number, benchIndex: number | null, starter: Starter | null = null) => (
    <SquadRow
      key={playerCode}
      leagueId={leagueId}
      player={squad.get(playerCode)!}
      bench={benchIndex === null ? null : { index: benchIndex, last: draft.bench.length - 1, onBenchAt }}
      starter={starter}
      onRole={onRole}
      moving={moving}
    />
  );
  return (
    <table aria-label={squadTableLabel} className="w-full border-collapse">
      <ColumnHeads columns={squadColumns} shown={COLUMNS} classOf={() => "px-2 text-left"} />
      <tbody>{startersInOrder(draft).map((starter) => row(starter.playerCode, null, starter))}</tbody>
      <tbody onDragOver={allowDrop} onDrop={drop}>
        <tr>
          <th scope="rowgroup" colSpan={COLUMNS.length} className="bg-plate px-2 text-left font-bold">
            <span className="flex flex-wrap items-center justify-between gap-2">
              {BENCH_TITLE}
              {pickedStarts && (
                <button type="button" onClick={onBench} className="secondary-action">
                  {toBenchWords(picked.name)}
                </button>
              )}
            </span>
          </th>
        </tr>
        {draft.bench.length === 0 ? (
          <tr>
            <td colSpan={COLUMNS.length} className="px-2 text-muted">
              {emptyBenchWords}
            </td>
          </tr>
        ) : (
          draft.bench.map((playerCode, index) => row(playerCode, index))
        )}
      </tbody>
    </table>
  );
}

/** Up and Down: a whole tap wide on the phone, as "Up" alone is narrower (plate.md, The phone). */
const BENCH_ORDER_BUTTON = "min-h-tap min-w-tap font-semibold text-fact underline disabled:text-muted disabled:no-underline lg:min-h-0 lg:min-w-0";

/** A bench row's place in the bench order, the last place, and how to move a player to one. */
type BenchPlace = { index: number; last: number; onBenchAt(playerCode: number, index: number, pressed?: "up" | "down"): void };

function SquadRow({
  leagueId,
  player,
  bench,
  starter,
  onRole,
  moving,
}: {
  leagueId: string;
  player: SquadMember;
  bench: BenchPlace | null;
  /** His slot and role, for a starter; null on the bench, where no one has a role. */
  starter: Starter | null;
  onRole(playerCode: number, role: string): void;
  moving: Moving;
}) {
  const isPicked = moving.picked?.playerCode === player.playerCode;
  const onBenchRow = bench !== null;
  const picked = moving.picked;
  // A player dragged onto a bench row takes its place; the bench's own drop (to the end) is for
  // the rest of it.
  const allowDrop = (event: DragEvent) => {
    if (bench !== null && picked !== null) event.preventDefault();
  };
  const drop = (event: DragEvent) => {
    if (bench === null || picked === null) return;
    event.preventDefault();
    event.stopPropagation();
    bench.onBenchAt(picked.playerCode, bench.index);
  };
  return (
    <tr
      draggable
      onDragStart={(event) => startDrag(event, player.playerCode, moving)}
      onDragEnd={moving.onDragEnd}
      onDragOver={allowDrop}
      onDrop={drop}
      aria-current={isPicked || undefined}
      className={`border-t border-panel-rule aria-current:shadow-current-edge ${onBenchRow ? "text-muted" : ""}`}
    >
      <td className="px-2">{positionsWords(player.positions)}</td>
      <td className="px-2">
        <Link to={playerCardPath(leagueId, player.playerCode)} className="inline-flex min-h-tap items-center font-semibold lg:min-h-0">
          {player.name}
        </Link>{" "}
        <span className="text-muted">{player.clubShortName}</span>
      </td>
      {/* The bench plays no role, so its buttons take the Role column's room too. */}
      {starter !== null && (
        <td className="px-2">
          <select
            aria-label={roleLabel(player.name)}
            {...markOf("role", player.playerCode)}
            value={roleIn(starter, starter.role).key}
            onChange={(event) => onRole(player.playerCode, event.target.value)}
            className="text-box w-full"
          >
            {rolesOfSlot(starter).map(({ key, name }) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </td>
      )}
      <td colSpan={starter === null ? 2 : 1} className="px-2">
        <button
          type="button"
          {...(onBenchRow ? markOf("player", player.playerCode) : {})}
          aria-pressed={isPicked}
          aria-label={moveLabel(player.name)}
          onClick={() => moving.onPick(player.playerCode)}
          className="min-h-tap font-semibold text-fact underline lg:min-h-0"
        >
          {isPicked ? movingWords : moveWords}
        </button>
        {bench !== null && (
          <>
            {" "}
            <button
              type="button"
              aria-label={upLabel(player.name)}
              {...markOf("bench-up", player.playerCode)}
              disabled={bench.index === 0}
              onClick={() => bench.onBenchAt(player.playerCode, bench.index - 1, "up")}
              className={BENCH_ORDER_BUTTON}
            >
              {upWords}
            </button>{" "}
            <button
              type="button"
              aria-label={downLabel(player.name)}
              {...markOf("bench-down", player.playerCode)}
              disabled={bench.index === bench.last}
              onClick={() => bench.onBenchAt(player.playerCode, bench.index + 1, "down")}
              className={BENCH_ORDER_BUTTON}
            >
              {downWords}
            </button>
          </>
        )}
      </td>
    </tr>
  );
}
