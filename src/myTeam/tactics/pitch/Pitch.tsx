import type { CSSProperties, DragEvent } from "react";
import { AREAS, cellKey, LANES, sameCell, type Cell } from "../../../../convex/lineup/pitch";
import { roleIn } from "../../../../convex/lineup/roles";
import { kitOf, type Ink } from "../../../../convex/football/clubColours";
import { markOf } from "../focusMarks";
import { PitchLines } from "./PitchLines";
import { RoleRuns } from "./RoleRuns";
import { drawnDeeper, SWEEPER_DEPTH_SHARE } from "./runs";
import { PITCH_ASPECT } from "./pitchMarkings";
import { standingIn, type DraftLineup, type Reach, type SquadMember } from "../lineupDraft";
import { emptySlotLabel, pitchLabel, playerOnPitchLabel, putHereLabel, swapLabel } from "../words";

// The Tactics tab's pitch (#14; spec/05, The pitch): six areas by five lanes, attack at the top, CM
// style. A player is moved by picking him up (a click, a tap or Enter on him) and then choosing one
// of the cells that light up, free or holding a player to swap with, or by dragging him there; both
// reach the same `onPlace`.

/** Top to bottom as the pitch is drawn: attack first. */
export const ROWS_DRAWN = AREAS.toReversed();

/** On the row that holds the pitch, with the CSS `pitch-room`: the pitch's shape, width over
 *  length, which the CSS sizes the pitch and its panel by, and how much deeper a sweeper is drawn. */
export const PITCH_ROOM_STYLE = { "--pitch-aspect": PITCH_ASPECT, "--sweeper-depth": SWEEPER_DEPTH_SHARE } as CSSProperties;

/** The CSS utility that draws a sweeper's cell a little deeper than the line (pitch.css). */
export const SWEEPER_DEPTH = "pitch-sweeper";

/** The pitch's cells: each area's row an equal share of its length, so the lines stand where they
 *  would on a real pitch, and each lane an equal share of its width. Its shape is the CSS `pitch`'s;
 *  the formation window's thumbnails and preview draw on it too. */
export const CELL_GRID: CSSProperties = {
  gridTemplateRows: `repeat(${ROWS_DRAWN.length}, minmax(0, 1fr))`,
  gridTemplateColumns: `repeat(${LANES.length}, minmax(0, 1fr))`,
};

/** Who is picked up and how to move him: the page holds it, as the squad beside picks up too. */
export type Moving = {
  picked: SquadMember | null;
  /** Where the player picked up can go, lit; null with nobody picked up. */
  reach: Reach | null;
  /** The player whose panel is open, tapped on the pitch or in a row; null with none. */
  selected: number | null;
  /** A click, a tap or Enter on a player: opens his panel, or closes it if it is open. */
  onSelect(playerCode: number): void;
  /** Move, in his panel: picks him up, or puts him back if he is already. */
  onPick(playerCode: number): void;
  /** A drag starting: picks him up, whoever was. */
  onGrab(playerCode: number): void;
  /** Into the cell if it is free, swapped with its player if not. */
  onPlace(cell: Cell): void;
  /** Swapped with the player, on the pitch or the bench. */
  onSwap(playerCode: number): void;
  onDragEnd(): void;
};

/** Every drag carries the player's code, as some browsers start no drag without data. */
export function startDrag(event: DragEvent, playerCode: number, moving: Moving) {
  event.dataTransfer.setData("text/plain", String(playerCode));
  event.dataTransfer.effectAllowed = "move";
  moving.onGrab(playerCode);
}

/** `slots` are the cells of the preset last picked, if any: those still empty are marked, to show
 *  where to drag (spec/05). `runsShown` is the desk's switch for the roles' runs (spec/05 Runs). */
export function Pitch({
  draft,
  squad,
  moving,
  slots,
  runsShown,
}: {
  draft: DraftLineup;
  squad: ReadonlyMap<number, SquadMember>;
  moving: Moving;
  slots: readonly Cell[];
  runsShown: boolean;
}) {
  const { picked, reach } = moving;
  const isSlot = (cell: Cell) => slots.some((slot) => sameCell(slot, cell));
  const opensTo = (cell: Cell) => reach !== null && reach.cells.some((each) => sameCell(each, cell));
  return (
    <div role="group" aria-label={pitchLabel} style={CELL_GRID} className="pitch relative mx-auto grid">
      <PitchLines />
      <RoleRuns draft={draft} tapped={picked?.playerCode ?? moving.selected} switchedOn={runsShown} />
      {ROWS_DRAWN.flatMap((area) =>
        LANES.map((lane) => {
          const cell = { area, lane };
          const standing = standingIn(draft, cell);
          const depth = standing !== undefined && drawnDeeper(cell, standing.role) ? SWEEPER_DEPTH : "";
          const allowDrop = (event: DragEvent) => {
            if (opensTo(cell)) event.preventDefault();
          };
          const drop = (event: DragEvent) => {
            event.preventDefault();
            if (opensTo(cell)) moving.onPlace(cell);
          };
          return (
            <div key={cellKey(cell)} onDragOver={allowDrop} onDrop={drop} className={`relative flex min-h-0 min-w-0 items-center justify-center p-0.5 ${depth}`}>
              {standing !== undefined ? (
                <PlayerBlock player={squad.get(standing.playerCode)!} cell={cell} role={roleIn(cell, standing.role).name} lit={opensTo(cell)} moving={moving} />
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
 *  Roles; his positions are in his name for screen readers). A tap opens his panel, and his block
 *  is ringed while it is open; picked up, the plate turns white; one the player picked up can swap
 *  with is lit, dashed like a free cell, and a tap swaps them. */
function PlayerBlock({ player, cell, role, lit, moving }: { player: SquadMember; cell: Cell; role: string; lit: boolean; moving: Moving }) {
  const { picked } = moving;
  const isPicked = picked?.playerCode === player.playerCode;
  const isSelected = moving.selected === player.playerCode;
  const plate = isPicked ? "bg-fact text-ground" : "bg-name-plate";
  const swapsWith = lit && picked !== null;
  return (
    <button
      type="button"
      draggable
      {...markOf("player", player.playerCode)}
      aria-pressed={isSelected}
      aria-label={swapsWith ? swapLabel(picked.name, player.name) : playerOnPitchLabel(player.name, player.positions, cell.area, cell.lane)}
      onClick={() => (swapsWith ? moving.onPlace(cell) : moving.onSelect(player.playerCode))}
      onDragStart={(event) => startDrag(event, player.playerCode, moving)}
      onDragEnd={moving.onDragEnd}
      className={`flex w-full min-w-0 cursor-grab flex-col items-center ${swapsWith ? "outline-2 outline-dashed outline-pitch-line" : isSelected ? "outline-2 outline-pitch-line" : ""}`}
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
function Shirt({ number, clubCode, goalkeeper }: { number: number | null; clubCode: number | null; goalkeeper: boolean }) {
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
