import type { DragEvent } from "react";
import { AREAS, LANES, type Cell } from "../../convex/lineup/pitch";
import { roleIn } from "../../convex/lineup/roles";
import { canStandIn, standingIn, type DraftLineup, type SquadMember } from "./lineupDraft";
import { emptySlotLabel, pitchLabel, playerOnPitchLabel, putHereLabel } from "./tacticsWords";

// The Tactics tab's pitch (#14; spec/05, The pitch): six areas by five lanes, attack at the top, CM
// style. A player is moved by picking him up (a click, a tap or Enter on him) and then choosing a
// free cell he plays, or by dragging him there; both reach the same `onPlace`.

/** Top to bottom as the pitch is drawn: attack first. */
const ROWS_DRAWN = AREAS.toReversed();

/** Who is picked up and how to move him: the page holds it, as the squad beside picks up too. */
export type Moving = {
  picked: SquadMember | null;
  /** A click, a tap or Enter: picks him up, or puts him back if he is already. */
  onPick(playerCode: number): void;
  /** A drag starting: picks him up, whoever was. */
  onGrab(playerCode: number): void;
  onPlace(cell: Cell): void;
  onDragEnd(): void;
};

/** Every drag carries the player's code, as some browsers start no drag without data. */
export function startDrag(event: DragEvent, playerCode: number, moving: Moving) {
  event.dataTransfer.setData("text/plain", String(playerCode));
  event.dataTransfer.effectAllowed = "move";
  moving.onGrab(playerCode);
}

/** `slots` are the cells of the preset last picked, if any: those still empty are marked, to show
 *  where to drag (spec/05). */
export function Pitch({
  draft,
  squad,
  moving,
  slots,
}: {
  draft: DraftLineup;
  squad: ReadonlyMap<number, SquadMember>;
  moving: Moving;
  slots: readonly Cell[];
}) {
  const { picked } = moving;
  const isSlot = (cell: Cell) => slots.some((slot) => slot.area === cell.area && slot.lane === cell.lane);
  const opensTo = (cell: Cell) => picked !== null && canStandIn(draft, picked.positions, cell);
  return (
    <div role="group" aria-label={pitchLabel} className="pitch relative grid grid-cols-5">
      <PitchLines />
      {ROWS_DRAWN.flatMap((area) =>
        LANES.map((lane) => {
          const cell = { area, lane };
          const standing = standingIn(draft, cell);
          const allowDrop = (event: DragEvent) => {
            if (opensTo(cell)) event.preventDefault();
          };
          const drop = (event: DragEvent) => {
            event.preventDefault();
            if (opensTo(cell)) moving.onPlace(cell);
          };
          return (
            <div key={`${area}/${lane}`} onDragOver={allowDrop} onDrop={drop} className="relative flex h-pitch-row min-w-0 items-center justify-center p-1">
              {standing !== undefined ? (
                <PlayerBlock player={squad.get(standing.playerCode)!} cell={cell} role={roleIn(cell, standing.role).name} moving={moving} />
              ) : picked !== null && opensTo(cell) ? (
                <button
                  type="button"
                  aria-label={putHereLabel(picked.name, area, lane)}
                  onClick={() => moving.onPlace(cell)}
                  className="h-full w-full border-2 border-dashed border-pitch-line"
                />
              ) : (
                // Quieter than a put-here target (bold dashes), so a slot to fill never reads as a place to tap.
                isSlot(cell) && <div role="img" aria-label={emptySlotLabel(area, lane)} className="h-full w-full border border-dotted border-pitch-line" />
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}

/** A player on the pitch: his shirt over his name plate, the role he plays under his name (spec/05
 *  Roles; his positions are in his name for screen readers). Picked up, the plate turns white. */
function PlayerBlock({ player, cell, role, moving }: { player: SquadMember; cell: Cell; role: string; moving: Moving }) {
  const isPicked = moving.picked?.playerCode === player.playerCode;
  const plate = isPicked ? "bg-fact text-ground" : "bg-name-plate";
  return (
    <button
      type="button"
      draggable
      data-player={player.playerCode}
      aria-pressed={isPicked}
      aria-label={playerOnPitchLabel(player.name, player.positions, cell.area, cell.lane)}
      onClick={() => moving.onPick(player.playerCode)}
      onDragStart={(event) => startDrag(event, player.playerCode, moving)}
      onDragEnd={moving.onDragEnd}
      className="flex w-full min-w-0 cursor-grab flex-col items-center"
    >
      <Shirt number={player.number} />
      <span className={`max-w-full truncate px-1 text-lead font-semibold ${plate}`}>{player.name}</span>
      {/* Up to two lines, so "Defensive full-back" and "Defensive winger" stay apart on a phone. */}
      <span className={`line-clamp-2 max-w-full px-1 text-center ${isPicked ? plate : "bg-name-plate text-soft"}`}>{role}</span>
    </button>
  );
}

/** Our own shirt outline (plate.md, Marks), with his squad number on it once his manager gives
 *  him one (#13). Club colours aren't held yet. */
function Shirt({ number }: { number: number | null }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="size-shirt shrink-0 fill-fact stroke-name-plate">
      <path d="M13 4 L7 7 L2 13 L7 18 L10 16 L10 37 L30 37 L30 16 L33 18 L38 13 L33 7 L27 4 Q20 10 13 4 Z" />
      {number !== null && (
        // In the shirt's own units, as the shirt is drawn 40 wide and shown smaller (size-shirt).
        <text x="20" y="29" textAnchor="middle" fontSize="14" className="fill-ground stroke-none font-bold">
          {number}
        </text>
      )}
    </svg>
  );
}

/** The halfway line, the centre circle and the two penalty boxes, drawn behind the cells. */
function PitchLines() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-1/2 border-t-2 border-pitch-line" />
      <div className="absolute top-1/2 left-1/2 size-centre-circle -translate-1/2 rounded-circle border-2 border-pitch-line" />
      <div className="absolute inset-x-1/4 top-0 h-penalty-box border-2 border-t-0 border-pitch-line" />
      <div className="absolute inset-x-1/4 bottom-0 h-penalty-box border-2 border-b-0 border-pitch-line" />
    </div>
  );
}
