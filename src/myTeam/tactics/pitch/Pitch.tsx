import type { CSSProperties, DragEvent } from "react";
import { cellKey, GOALKEEPER_AREA, LANES, positionOfSlot, sameCell, type Cell } from "../../../../convex/lineup/pitch";
import { chipColoursOf } from "../../../ui/PositionChip";
import { PitchLines } from "../../../ui/pitch/PitchLines";
import { RoleRuns } from "../../../ui/pitch/RoleRuns";
import { cellGridOf, EVEN_ROWS, ROWS_DRAWN, rowLayoutOf } from "../../../ui/pitch/rowLayout";
import { Shirt } from "../../../ui/pitch/Shirt";
import { MatchMark } from "../../SquadCells";
import { markOf } from "../focusMarks";
import type { SeasonOf } from "../SelectionTable";
import { pitchChipOf, type PitchChip } from "./pitchChip";
import { StarRating } from "../../../ui/StarRating";
import { landingOf, positionsIn, standingIn, type EditedLineup, type Landing, type RatingsOf, type SquadMember } from "../lineupEdits";
import type { DropTarget, Reach } from "../swaps";
import { emptySlotLabel, landingSubject, pitchLabel, playerOnPitchLabel, swapLabel } from "../words";

// The Tactics tab's pitch (#14; spec/05, The pitch): six areas by five lanes, attack at the top, CM
// style, the rows nobody stands in closed up (src/ui/pitch/rowLayout.ts). Presets only (Craig, 1 Nov 2026; #1022): a player is moved by picking him up (Move, in his
// panel) and then tapping a lit player to swap with, or by dragging him onto one; a drop anywhere
// else is refused, and the page says why.

/** The pitch's cells with every row an equal share of its length, as the formation window's
 *  thumbnails draw them; a pitch with players on it shares its length among the rows they stand in
 *  (src/ui/pitch/rowLayout.ts). Its shape is the CSS `pitch`'s. */
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
  /** A starter's role, on the pitch or in his row: opens his role card (spec/05 Roles; #848). */
  onRoleCard(playerCode: number): void;
};

/** Every drag carries the player's code, as some browsers start no drag without data. */
export function startDrag(event: DragEvent, playerCode: number, moving: Moving) {
  event.dataTransfer.setData("text/plain", String(playerCode));
  event.dataTransfer.effectAllowed = "move";
  moving.onGrab(playerCode);
}

/** `slots` are the cells of the preset last picked, if any: those still empty are marked, the
 *  shape's slots nobody fills (spec/05). `runsShown` is the desk's switch for the roles' runs (spec/05 Runs).
 *  `ratingsOf` gives the stars a lit player shows for the swap (#11). `season` is each player's row
 *  on the Squad tab's read, his club's matches among it, and `gameweek` the one being picked for:
 *  the opponents on his chip (#845). */
export function Pitch({
  draft,
  squad,
  moving,
  slots,
  runsShown,
  ratingsOf,
  season,
  gameweek,
}: {
  draft: EditedLineup;
  squad: ReadonlyMap<number, SquadMember>;
  moving: Moving;
  slots: readonly Cell[];
  runsShown: boolean;
  ratingsOf: RatingsOf;
  season: SeasonOf;
  gameweek: number;
}) {
  const { picked, reach } = moving;
  const isSlot = (cell: Cell) => slots.some((slot) => sameCell(slot, cell));
  /** The swap a lit player shows; null on one who isn't lit. */
  const landingOn = (playerCode: number) =>
    picked === null || reach === null || !reach.players.includes(playerCode) ? null : landingOf(draft, picked.playerCode, playerCode, ratingsOf, positionsIn(squad));
  const rows = rowLayoutOf([...draft.starters, ...slots]);
  return (
    <div role="group" aria-label={pitchLabel} style={cellGridOf(rows)} className="pitch relative mx-auto grid">
      <PitchLines rows={rows} />
      <RoleRuns starters={draft.starters} rows={rows} tapped={picked?.playerCode ?? moving.selected} switchedOn={runsShown} />
      {ROWS_DRAWN.flatMap((area) =>
        LANES.map((lane) => {
          const cell = { area, lane };
          const standing = standingIn(draft, cell);
          const player = standing && squad.get(standing.playerCode);
          // A starter missing from his squad is a broken lineup: say so, never draw an empty cell.
          if (standing !== undefined && player === undefined) throw new Error(`Starter ${standing.playerCode} is not in the squad`);
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
              {standing !== undefined && player !== undefined ? (
                <PlayerBlock
                  player={player}
                  cell={cell}
                  chip={pitchChipOf({ cell, role: standing.role, player, season: season && (season.get(standing.playerCode) ?? null), gameweek })}
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

/** A player on the pitch (spec/05 What the pitch shows): his shirt, a little bigger than a list's;
 *  his chip, the role's code in his area's colour, its name on hover, with his stars for it (#845);
 *  his name plate, which opens with his slot's position label ("ST Haaland": the position, never
 *  its side, so a sweeper or libero reads CB; Craig, 4 Nov 2026); his opponents this gameweek,
 *  each outlined until fixture difficulty fills it (Craig, 6 Nov 2026: "Build now, colour later").
 *  His positions are in his name for screen readers. A tap opens his panel, and his block is ringed while it is open; picked up, the plate turns white; one the player picked up can swap
 *  with is lit, dashed, with the picked-up player's stars for the role he'd land on there, his name
 *  under them (spec/05, Moving players; Craig, 7 Nov 2026, #11), and a tap swaps them. `landing`
 *  is null on a player who isn't lit. */
function PlayerBlock({ player, cell, chip, landing, moving }: { player: SquadMember; cell: Cell; chip: PitchChip; landing: Landing | null; moving: Moving }) {
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
      onClick={(event) => {
        if (swapsWith) moving.onSwap(player.playerCode);
        // His role's chip opens his role card; the rest of him, his panel. A keyboard reaches the
        // card by his Role ▾ in the Selection table, as a block holds one button.
        else if (picked === null && event.target instanceof Element && event.target.closest(`[${ROLE_CHIP_MARK}]`) !== null) moving.onRoleCard(player.playerCode);
        else moving.onSelect(player.playerCode);
      }}
      onDragStart={(event) => startDrag(event, player.playerCode, moving)}
      onDragEnd={moving.onDragEnd}
      className={`flex w-full min-w-0 cursor-grab flex-col items-center ${swapsWith ? "outline-2 outline-dashed outline-pitch-line" : isSelected ? "outline-2 outline-pitch-line" : ""}`}
    >
      <Shirt number={player.number} clubCode={player.clubCode} goalkeeper={cell.area === GOALKEEPER_AREA} size="size-pitch-shirt" />
      <RoleChip chip={chip} />
      <span className={`max-w-full truncate px-1 text-lead font-semibold ${plate}`}>
        <span data-slot-label>{positionOfSlot(cell)}</span> {player.name}
      </span>
      {chip.opponents !== undefined && chip.opponents.length > 0 && (
        // One under another: two side by side don't fit a lane in a double gameweek.
        <span className="flex max-w-full flex-col gap-px bg-name-plate leading-pitch-chip">
          {chip.opponents.map((match) => (
            <MatchMark key={match.kickoff} match={match} />
          ))}
        </span>
      )}
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

/** The attribute marking a starter's role chip on the pitch, which opens his role card (#848). */
export const ROLE_CHIP_MARK = "data-role-chip";

/** The role's code on his area's colour, its name on hover, then his stars for it on the plate. */
function RoleChip({ chip }: { chip: PitchChip }) {
  const { fill, ink } = chipColoursOf(chip.position);
  return (
    <span {...{ [ROLE_CHIP_MARK]: "" }} className="flex max-w-full cursor-pointer items-center leading-pitch-chip">
      <abbr title={chip.roleName} className={`px-1 font-bold no-underline ${fill} ${ink}`}>
        {chip.code}
      </abbr>
      <span className="flex items-center self-stretch bg-name-plate px-0.5">
        <StarRating stars={chip.stars} subject={chip.roleName} size="h-pitch-star w-pitch-stars" />
      </span>
    </span>
  );
}
