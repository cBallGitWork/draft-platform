import { useId, type CSSProperties, type DragEvent } from "react";
import { cellKey, LANES, positionOfSlot, sameCell, type Cell } from "../../../../convex/lineup/pitch";
import { roleIn } from "../../../../convex/lineup/roles";
import { kitOf, type Ink } from "../../../../convex/football/clubColours";
import { markOf } from "../focusMarks";
import { PitchLines } from "./PitchLines";
import { RoleRuns } from "./RoleRuns";
import { PITCH_ASPECT } from "./pitchMarkings";
import { cellGridOf, EVEN_ROWS, ROWS_DRAWN, rowLayoutOf } from "./rowLayout";
import { StarRating } from "../../../ui/StarRating";
import { landingOf, standingIn, type DraftLineup, type DropTarget, type Landing, type RatingsOf, type Reach, type SquadMember } from "../lineupDraft";
import { emptySlotLabel, landingSubject, pitchLabel, playerOnPitchLabel, swapLabel } from "../words";

// The Tactics tab's pitch (#14; spec/05, The pitch): six areas by five lanes, attack at the top, CM
// style, the rows nobody stands in closed up (./rowLayout.ts). Presets only (Craig, 1 Nov 2026; #1022): a player is moved by picking him up (Move, in his
// panel) and then tapping a lit player to swap with, or by dragging him onto one; a drop anywhere
// else is refused, and the page says why.

/** On the row that holds the pitch, with the CSS `pitch-room`: the pitch's shape, width over
 *  length, which the CSS sizes the pitch and its panel by. */
export const PITCH_ROOM_STYLE = { "--pitch-aspect": PITCH_ASPECT } as CSSProperties;

/** The pitch's cells with every row an equal share of its length, as the formation window's
 *  thumbnails draw them; a pitch with players on it shares its length among the rows they stand in
 *  (./rowLayout.ts). Its shape is the CSS `pitch`'s. */
export const CELL_GRID: CSSProperties = cellGridOf(EVEN_ROWS);

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
  /** Swapped with the player, on the pitch or the bench: a lit one tapped. */
  onSwap(playerCode: number): void;
  /** The player picked up dropped on a cell of the pitch, on a player in the Selection table, or on
   *  the bench's plate: swapped where he may be, the refusal said where not. */
  onDrop(target: DropTarget): void;
  onDragEnd(): void;
};

/** Every drag carries the player's code, as some browsers start no drag without data. */
export function startDrag(event: DragEvent, playerCode: number, moving: Moving) {
  event.dataTransfer.setData("text/plain", String(playerCode));
  event.dataTransfer.effectAllowed = "move";
  moving.onGrab(playerCode);
}

/** `slots` are the cells of the preset last picked, if any: those still empty are marked, the
 *  shape's slots nobody fills (spec/05). `runsShown` is the desk's switch for the roles' runs (spec/05 Runs).
 *  `ratingsOf` gives the stars a lit player shows for the swap (#11). */
export function Pitch({
  draft,
  squad,
  moving,
  slots,
  runsShown,
  ratingsOf,
}: {
  draft: DraftLineup;
  squad: ReadonlyMap<number, SquadMember>;
  moving: Moving;
  slots: readonly Cell[];
  runsShown: boolean;
  ratingsOf: RatingsOf;
}) {
  const { picked, reach } = moving;
  const isSlot = (cell: Cell) => slots.some((slot) => sameCell(slot, cell));
  /** The swap a lit player shows; null on one who isn't lit. */
  const landingOn = (playerCode: number) =>
    picked === null || reach === null || !reach.players.includes(playerCode) ? null : landingOf(draft, picked.playerCode, playerCode, ratingsOf);
  const rows = rowLayoutOf([...draft.starters, ...slots]);
  return (
    <div role="group" aria-label={pitchLabel} style={cellGridOf(rows)} className="pitch relative mx-auto grid">
      <PitchLines rows={rows} />
      <RoleRuns draft={draft} rows={rows} tapped={picked?.playerCode ?? moving.selected} switchedOn={runsShown} />
      {ROWS_DRAWN.flatMap((area) =>
        LANES.map((lane) => {
          const cell = { area, lane };
          const standing = standingIn(draft, cell);
          // Any cell takes the drop of the player picked up, so a refused one can say why (#1022);
          // his own cell is no move.
          const takesDrop = picked !== null && standing?.playerCode !== picked.playerCode;
          const allowDrop = (event: DragEvent) => {
            if (takesDrop) event.preventDefault();
          };
          const drop = (event: DragEvent) => {
            event.preventDefault();
            if (takesDrop) moving.onDrop({ cell });
          };
          return (
            <div key={cellKey(cell)} onDragOver={allowDrop} onDrop={drop} className="relative flex min-h-0 min-w-0 items-center justify-center p-0.5">
              {standing !== undefined ? (
                <PlayerBlock
                  player={squad.get(standing.playerCode)!}
                  cell={cell}
                  role={roleIn(cell, standing.role).name}
                  landing={landingOn(standing.playerCode)}
                  moving={moving}
                />
              ) : (
                isSlot(cell) && <div role="img" aria-label={emptySlotLabel(area, lane)} className="h-full w-full border border-dotted border-pitch-line" />
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}

/** A player on the pitch: his shirt over his name plate, which opens with his slot's position label
 *  ("ST Haaland": the position, never its side, so a sweeper or libero reads CB; spec/05 What the
 *  pitch shows; Craig, 4 Nov 2026), the role he plays under his name (spec/05 Roles;his positions are in his name for screen readers). A tap opens his panel, and his block
 *  is ringed while it is open; picked up, the plate turns white; one the player picked up can swap
 *  with is lit, dashed, with the picked-up player's stars for the role he'd land on there, his name
 *  under them (spec/05, Moving players; Craig, 7 Nov 2026, #11), and a tap swaps them. `landing`
 *  is null on a player who isn't lit. */
function PlayerBlock({ player, cell, role, landing, moving }: { player: SquadMember; cell: Cell; role: string; landing: Landing | null; moving: Moving }) {
  const { picked } = moving;
  const isPicked = picked?.playerCode === player.playerCode;
  const isSelected = moving.selected === player.playerCode;
  const plate = isPicked ? "bg-fact text-ground" : "bg-name-plate";
  const swapsWith = landing !== null && picked !== null;
  return (
    <button
      type="button"
      draggable
      {...markOf("player", player.playerCode)}
      aria-pressed={isSelected}
      aria-label={swapsWith ? swapLabel(picked.name, player.name) : playerOnPitchLabel(player.name, player.positions, cell.area, cell.lane)}
      onClick={() => (swapsWith ? moving.onSwap(player.playerCode) : moving.onSelect(player.playerCode))}
      onDragStart={(event) => startDrag(event, player.playerCode, moving)}
      onDragEnd={moving.onDragEnd}
      className={`flex w-full min-w-0 cursor-grab flex-col items-center ${swapsWith ? "outline-2 outline-dashed outline-pitch-line" : isSelected ? "outline-2 outline-pitch-line" : ""}`}
    >
      <Shirt number={player.number} clubCode={player.clubCode} goalkeeper={cell.area === "goalkeeper"} />
      <span className={`max-w-full truncate px-1 text-lead font-semibold ${plate}`}>
        <span data-slot-label>{positionOfSlot(cell)}</span> {player.name}
      </span>
      {/* Up to two lines, so "Defensive full-back" and "Defensive winger" stay apart on a phone,
          set closer there so a two-line role still fits his row (--leading-pitch-role). */}
      <span className={`line-clamp-2 max-w-full px-1 text-center max-lg:leading-pitch-role ${isPicked ? plate : "bg-name-plate text-soft"}`}>{role}</span>
      {swapsWith && (
        // His name under the stars, as a pitch cell is too narrow for both on one line.
        <span className="flex max-w-full flex-col items-center bg-name-plate px-1">
          <StarRating stars={landing.stars} subject={landingSubject(picked.name, landing.role.name)} />
          <span className="max-w-full truncate text-soft">{picked.name}</span>
        </span>
      )}
    </button>
  );
}

/** A shirt's number and outline, in the ink that reads on its colour: either ink stands out on both
 *  stripes of the grass too, so a white or a dark kit keeps its edge. */
const INK_CLASSES: Record<Ink, string> = { dark: "fill-ground stroke-ground", light: "fill-fact stroke-fact" };

/** On a patterned shirt the number crosses both colours, so it gets an outline in the other ink
 *  (spec/12, Club colours), drawn under its fill (`paintOrder`). */
const OUTLINE_CLASSES: Record<Ink, string> = { dark: "stroke-fact", light: "stroke-ground" };

/** The shirt's outline, in its own 40-unit box. */
const SHIRT_PATH = "M13 4 L7 7 L2 13 L7 18 L10 16 L10 37 L30 37 L30 16 L33 18 L38 13 L33 7 L27 4 Q20 10 13 4 Z";

/** A striped shirt's trim stripes: 4 wide, 8 apart, one down the middle under the number. */
const STRIPES_AT = [2, 10, 18, 26, 34];
const STRIPE_WIDTH = 4;

/** Our own shirt outline in his club's colours and pattern (plate.md, Marks; a keeper in its
 *  second colour, plain), with his squad number on it once his manager gives him one (#13). The
 *  colour is only a look: his name says who he is, so screen readers skip the shirt. */
export function Shirt({ number, clubCode, goalkeeper }: { number: number | null; clubCode: number | null; goalkeeper: boolean }) {
  const kit = kitOf(clubCode, goalkeeper);
  const striped = kit.pattern === "stripes";
  const clipId = useId();
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={`size-shirt shrink-0 ${INK_CLASSES[kit.ink]}`}>
      <path style={{ fill: kit.shirt }} d={SHIRT_PATH} />
      {striped && (
        <>
          <clipPath id={clipId}>
            <path d={SHIRT_PATH} />
          </clipPath>
          <g clipPath={`url(#${clipId})`} className="stroke-none" style={{ fill: kit.trim }}>
            {STRIPES_AT.map((x) => (
              <rect key={x} x={x} y="0" width={STRIPE_WIDTH} height="40" />
            ))}
          </g>
          {/* The edge again, over the stripes' ends. */}
          <path style={{ fill: "none" }} d={SHIRT_PATH} />
        </>
      )}
      {number !== null && (
        // In the shirt's own units, as the shirt is drawn 40 wide and shown smaller (size-shirt).
        <text
          x="20"
          y="29"
          textAnchor="middle"
          fontSize="14"
          strokeWidth="3"
          strokeLinejoin="round"
          paintOrder="stroke"
          className={`font-bold ${striped ? OUTLINE_CLASSES[kit.ink] : "stroke-none"}`}
        >
          {number}
        </text>
      )}
    </svg>
  );
}
