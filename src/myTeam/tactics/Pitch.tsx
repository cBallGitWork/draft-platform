import type { CSSProperties, DragEvent } from "react";
import { AREAS, cellKey, LANES, sameCell, type Cell } from "../../../convex/lineup/pitch";
import { roleIn } from "../../../convex/lineup/roles";
import { kitOf, type Ink } from "../../../convex/football/clubColours";
import { markOf } from "./focusMarks";
import { PitchLines } from "./PitchLines";
import { PITCH_ASPECT } from "./pitchMarkings";
import { canStandIn, standingIn, type DraftLineup, type SquadMember } from "./lineupDraft";
import { emptySlotLabel, pitchLabel, playerOnPitchLabel, putHereLabel } from "./words";

// The Tactics tab's pitch (#14; spec/05, The pitch): six areas by five lanes, attack at the top, CM
// style. A player is moved by picking him up (a click, a tap or Enter on him) and then choosing a
// free cell he plays, or by dragging him there; both reach the same `onPlace`.

/** Top to bottom as the pitch is drawn: attack first. */
const ROWS_DRAWN = AREAS.toReversed();

/** On the row that holds the pitch, with the CSS `pitch-room`: the pitch's shape, width over
 *  length, which the CSS sizes the pitch and its panel by. */
export const PITCH_ROOM_STYLE = { "--pitch-aspect": PITCH_ASPECT } as CSSProperties;

/** The pitch's cells: each area's row an equal share of its length, so the lines stand where they
 *  would on a real pitch, and each lane an equal share of its width. Its shape is the CSS `pitch`'s. */
const CELL_GRID: CSSProperties = {
  gridTemplateRows: `repeat(${ROWS_DRAWN.length}, minmax(0, 1fr))`,
  gridTemplateColumns: `repeat(${LANES.length}, minmax(0, 1fr))`,
};

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
  const isSlot = (cell: Cell) => slots.some((slot) => sameCell(slot, cell));
  const opensTo = (cell: Cell) => picked !== null && canStandIn(draft, picked.positions, cell);
  return (
    <div role="group" aria-label={pitchLabel} style={CELL_GRID} className="pitch relative mx-auto grid">
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
            <div key={cellKey(cell)} onDragOver={allowDrop} onDrop={drop} className="relative flex min-h-0 min-w-0 items-center justify-center p-0.5">
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
      {...markOf("player", player.playerCode)}
      aria-pressed={isPicked}
      aria-label={playerOnPitchLabel(player.name, player.positions, cell.area, cell.lane)}
      onClick={() => moving.onPick(player.playerCode)}
      onDragStart={(event) => startDrag(event, player.playerCode, moving)}
      onDragEnd={moving.onDragEnd}
      className="flex w-full min-w-0 cursor-grab flex-col items-center"
    >
      <Shirt number={player.number} clubCode={player.clubCode} goalkeeper={cell.area === "goalkeeper"} />
      <span className={`max-w-full truncate px-1 text-lead font-semibold ${plate}`}>{player.name}</span>
      {/* Up to two lines, so "Defensive full-back" and "Defensive winger" stay apart on a phone. */}
      <span className={`line-clamp-2 max-w-full px-1 text-center ${isPicked ? plate : "bg-name-plate text-soft"}`}>{role}</span>
    </button>
  );
}

/** A shirt's number and outline, in the ink that reads on its colour: either ink stands out on both
 *  stripes of the grass too, so a white or a dark kit keeps its edge. */
const INK_CLASSES: Record<Ink, string> = { dark: "fill-ground stroke-ground", light: "fill-fact stroke-fact" };

/** Our own shirt outline in his club's colours (plate.md, Marks; a keeper in its second colour),
 *  with his squad number on it once his manager gives him one (#13). The colour is only a look:
 *  his name says who he is, so screen readers skip the shirt. */
function Shirt({ number, clubCode, goalkeeper }: { number: number | null; clubCode: number; goalkeeper: boolean }) {
  const kit = kitOf(clubCode, goalkeeper);
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={`size-shirt shrink-0 ${INK_CLASSES[kit.ink]}`}>
      <path style={{ fill: kit.shirt }} d="M13 4 L7 7 L2 13 L7 18 L10 16 L10 37 L30 37 L30 16 L33 18 L38 13 L33 7 L27 4 Q20 10 13 4 Z" />
      {number !== null && (
        // In the shirt's own units, as the shirt is drawn 40 wide and shown smaller (size-shirt).
        <text x="20" y="29" textAnchor="middle" fontSize="14" className="stroke-none font-bold">
          {number}
        </text>
      )}
    </svg>
  );
}
