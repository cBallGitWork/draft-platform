import { Link } from "@tanstack/react-router";
import type { DragEvent } from "react";
import { playerCardPath } from "../playerCard/paths";
import { startersInOrder, type DraftLineup, type SquadMember } from "./lineupDraft";
import { startDrag, type Moving } from "./Pitch";
import {
  BENCH_TITLE,
  emptyBenchWords,
  moveLabel,
  moveWords,
  movingWords,
  positionsWords,
  squadColumns,
  squadTableLabel,
  toBenchWords,
} from "./tacticsWords";

/** The eleven back to front, then the bench in order under its own plate (plate.md, Marks). Each
 *  row's Move picks the player up, and a row drags onto the pitch; with a starter picked up, the
 *  bench's plate offers to take him. */
export function SquadTable({
  leagueId,
  draft,
  squad,
  moving,
  onBench,
}: {
  leagueId: string;
  draft: DraftLineup;
  squad: ReadonlyMap<number, SquadMember>;
  moving: Moving;
  onBench(): void;
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
  const row = (playerCode: number, onBenchRow: boolean) => (
    <SquadRow key={playerCode} leagueId={leagueId} player={squad.get(playerCode)!} onBenchRow={onBenchRow} moving={moving} />
  );
  return (
    <table aria-label={squadTableLabel} className="w-full border-collapse">
      <thead className="bg-head text-ground">
        <tr>
          {(["position", "player", "move"] as const).map((column) => (
            <th key={column} scope="col" title={squadColumns[column].long} aria-label={squadColumns[column].long} className="px-2 text-left">
              {squadColumns[column].short}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{startersInOrder(draft).map(({ playerCode }) => row(playerCode, false))}</tbody>
      <tbody onDragOver={allowDrop} onDrop={drop}>
        <tr>
          <th scope="rowgroup" colSpan={3} className="bg-plate px-2 text-left font-bold">
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
            <td colSpan={3} className="px-2 text-muted">
              {emptyBenchWords}
            </td>
          </tr>
        ) : (
          draft.bench.map((playerCode) => row(playerCode, true))
        )}
      </tbody>
    </table>
  );
}

function SquadRow({ leagueId, player, onBenchRow, moving }: { leagueId: string; player: SquadMember; onBenchRow: boolean; moving: Moving }) {
  const isPicked = moving.picked?.playerCode === player.playerCode;
  return (
    <tr
      draggable
      onDragStart={(event) => startDrag(event, player.playerCode, moving.onPick)}
      onDragEnd={moving.onDragEnd}
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
      <td className="px-2">
        <button
          type="button"
          data-player={onBenchRow ? player.playerCode : undefined}
          aria-pressed={isPicked}
          aria-label={moveLabel(player.name)}
          onClick={() => moving.onPick(player.playerCode)}
          className="min-h-tap font-semibold text-fact underline lg:min-h-0"
        >
          {isPicked ? movingWords : moveWords}
        </button>
      </td>
    </tr>
  );
}
