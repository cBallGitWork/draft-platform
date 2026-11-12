import type { DragEvent } from "react";
import { positionOfSlot } from "../../../convex/lineup/pitch";
import { roleIn, type Formation } from "../../../convex/lineup/roles";
import { menuGlyph } from "../../shared/words";
import { cellClassOf, ColumnHeads } from "../../ui/ColumnHeads";
import { PositionChip } from "../../ui/PositionChip";
import { StarRating } from "../../ui/StarRating";
import { starsIn } from "../../../convex/stars/bestRole";
import type { SquadRow } from "../../../convex/squads/teamSquad";
import { NextMatches, StatusMark } from "../SquadCells";
import { markOf } from "./focusMarks";
import { PositionMarks, positionMarksOf } from "./positionMarks";
import { benchBestRole, landingOf, positionsIn, starts, startersInOrder, type EditedLineup, type Landing, type RatingsOf, type SquadMember, type Starter } from "./lineupEdits";
import { startDrag, type Moving } from "./pitch/Pitch";
import {
  BEST_ROLE_HEAD,
  BENCH_TITLE,
  benchPlaceLong,
  benchPlaceWords,
  emptyBenchWords,
  landingSubject,
  ROLE_FIT_SUBJECT,
  roleLabel,
  selectionColumns,
  selectionTableLabel,
  swapLabel,
} from "./words";

type Column = keyof typeof selectionColumns;
/** Each row opens with the slot's chip, then the role, the player, his stars for the role and his
 *  next fixture; the season's points stay on the Squad tab (spec/12; Craig, 6 Nov 2026, on #847:
 *  "Drop both"). */
const COLUMNS: readonly Column[] = ["position", "role", "player", "roleFit", "next"];
/** A phone leaves out the role fit and next fixture, for room (plate.md, The phone: the squad table
 *  keeps the player column and drops Role fit). */
const DESK_ONLY: readonly Column[] = ["next", "roleFit"];
const cellClasses = (column: Column) => cellClassOf(true, DESK_ONLY.includes(column));
/** The bench plate's first cell spans the columns before Role, where Best role heads the bench's. */
const BEFORE_ROLE = COLUMNS.indexOf("role");

/** Each squad player's row on the Squad tab's read (convex/squads/teamSquad.ts), by his code: his
 *  next fixture and FPL's news on him; undefined while it loads. */
export type SeasonOf = ReadonlyMap<number, SquadRow> | undefined;

/** A starter's row: him, and the cells the eleven stand in, which pick the roles his slot offers. */
type StarterPlace = { starter: Starter; formation: Formation };

/** The Selection table (the approved Tactics picture; plate.md, Tables and panels): the eleven back
 *  to front, each led by his slot's position chip and his role, then the bench in order under its
 *  own plate, each led by his place and his main position, with the role he'd play best there, muted. A tap on
 *  a player opens his panel, where Move is (no action column); a row drags onto the pitch. A player
 *  he can swap with is lit, and a tap or a drop on him swaps them (spec/05, Moving players); a bench
 *  player dropped on another bench row takes its place (spec/05 Auto-subs). A starter leaves the
 *  pitch only by a swap (Craig, 4 Nov 2026), so any other drop of one is refused, saying why. With
 *  a starter picked up, each lit bench row shows, beside his name, his stars for the role he'd land
 *  on in that starter's slot, and his Role fit stays his own (spec/05, Moving players; Craig, 7 Nov
 *  2026, #11); `ratingsOf` gives those stars. */
export function SelectionTable({
  draft,
  squad,
  season,
  moving,
  onBenchAt,
  ratingsOf,
}: {
  draft: EditedLineup;
  squad: ReadonlyMap<number, SquadMember>;
  season: SeasonOf;
  moving: Moving;
  onBenchAt(playerCode: number, index: number): void;
  ratingsOf: RatingsOf;
}) {
  const { picked } = moving;
  const pickedStarts = picked !== null && starts(draft, picked.playerCode);
  const allowDrop = (event: DragEvent) => {
    if (pickedStarts) event.preventDefault();
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    if (pickedStarts) moving.onDrop("bench");
  };
  /** A bench player's swap for the starter picked up, where he is lit; null otherwise. */
  const landingOn = (playerCode: number) =>
    pickedStarts && moving.reach?.players.includes(playerCode) ? landingOf(draft, picked.playerCode, playerCode, ratingsOf, positionsIn(squad)) : null;
  const row = (playerCode: number, place: StarterPlace | { benchIndex: number }) => (
    <SelectionRow
      key={playerCode}
      player={squad.get(playerCode)!}
      season={season?.get(playerCode) ?? (season === undefined ? undefined : null)}
      place={place}
      onBenchAt={onBenchAt}
      moving={moving}
      pickedOnBench={picked !== null && !pickedStarts}
      landing={"benchIndex" in place ? landingOn(playerCode) : null}
    />
  );
  return (
    <table aria-label={selectionTableLabel} className="w-full border-collapse">
      <ColumnHeads columns={selectionColumns} shown={COLUMNS} classOf={cellClasses} />
      <tbody>{startersInOrder(draft).map((starter) => row(starter.playerCode, { starter, formation: draft.starters }))}</tbody>
      <tbody onDragOver={allowDrop} onDrop={drop}>
        <tr className="bg-plate">
          <th scope="rowgroup" colSpan={BEFORE_ROLE} className="px-2 text-left font-bold">
            {BENCH_TITLE}
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
  moving,
  pickedOnBench,
  landing,
}: {
  player: SquadMember;
  /** His row on the Squad tab's read: undefined while it loads, null where it has none (one the
   *  football sync doesn't hold). */
  season: SquadRow | null | undefined;
  place: StarterPlace | { benchIndex: number };
  onBenchAt(playerCode: number, index: number): void;
  moving: Moving;
  /** Whether the player picked up is on the bench. */
  pickedOnBench: boolean;
  /** On a lit bench row with a starter picked up, his stars in that starter's slot; null elsewhere. */
  landing: Landing | null;
}) {
  const { picked } = moving;
  const shown = moving.selected === player.playerCode || picked?.playerCode === player.playerCode;
  const benchIndex = "benchIndex" in place ? place.benchIndex : null;
  const lit = moving.reach?.players.includes(player.playerCode) ?? false;
  const swapsWith = lit && picked !== null;
  // A bench player dragged onto another bench row takes its place; any other drop on another row
  // swaps the two where they may, or is refused, saying why (#1022).
  const takesDrop = picked !== null && picked.playerCode !== player.playerCode;
  const allowDrop = (event: DragEvent) => {
    if (takesDrop) event.preventDefault();
  };
  const drop = (event: DragEvent) => {
    if (!takesDrop) return;
    event.preventDefault();
    event.stopPropagation();
    if (pickedOnBench && benchIndex !== null) onBenchAt(picked.playerCode, benchIndex);
    else moving.onDrop({ playerCode: player.playerCode });
  };
  return (
    <tr
      draggable
      onDragStart={(event) => startDrag(event, player.playerCode, moving)}
      onDragEnd={moving.onDragEnd}
      onDragOver={allowDrop}
      onDrop={drop}
      aria-current={shown || undefined}
      className="border-t border-panel-rule aria-current:bg-name-plate aria-current:shadow-current-edge lg:h-row"
    >
      <td className={cellClasses("position")}>
        <PositionCell player={player} place={place} />
      </td>
      <td className={cellClasses("role")}>
        {"starter" in place ? <RoleButton player={player} starter={place.starter} onRoleCard={moving.onRoleCard} /> : <span className="text-muted">{benchBestRole(player)?.role.name}</span>}
      </td>
      <th scope="row" className={`${cellClasses("player")} font-normal whitespace-nowrap`}>
        <button
          type="button"
          {...(benchIndex !== null ? markOf("player", player.playerCode) : {})}
          aria-pressed={swapsWith ? undefined : moving.selected === player.playerCode}
          aria-label={swapsWith ? swapLabel(picked.name, player.name) : undefined}
          onClick={() => (swapsWith ? moving.onSwap(player.playerCode) : moving.onSelect(player.playerCode))}
          className={`inline-flex min-h-tap min-w-tap items-center text-lead font-semibold lg:min-h-0 lg:min-w-0 ${player.unheld ? "max-w-error-name text-event lg:max-w-none" : ""} ${swapsWith ? "outline-2 outline-dashed outline-pitch-line" : ""}`}
        >
          {player.name}
        </button>
        {landing !== null && (
          <span className="ml-2 inline-flex align-middle">
            <StarRating stars={landing.stars} subject={landingSubject(player.name, landing.role.name)} />
          </span>
        )}
        {/* A phone leaves out the club and the status, for the role's room (plate.md, The phone). */}
        {player.clubShortName !== null && <span className="ml-1 text-muted max-sm:hidden">{player.clubShortName}</span>}
        {/* As on the Squad tab: only a player FPL holds news on gets one, until its data is settled. */}
        <StatusMark player={season} className="ml-1 size-3 align-middle max-sm:hidden" />
        <PositionMarks marks={positionMarksOf(player, "starter" in place ? place.starter : null)} />
      </th>
      <td className={cellClasses("roleFit")}>
        <RoleFit player={player} place={place} />
      </td>
      <td className={cellClasses("next")}>
        {season != null && <NextMatches matches={season.nextFixtures.slice(0, 1)} />}
      </td>
    </tr>
  );
}

/** His stars for the role he plays in his slot; on the bench, for his best role at his main
 *  position's slot, the role the Best role column names (spec/05 Roles; the approved Tactics
 *  picture). Nothing for a bench player with no position that has a slot. */
function RoleFit({ player, place }: { player: SquadMember; place: StarterPlace | { benchIndex: number } }) {
  const rated = "starter" in place ? { cell: place.starter, role: roleIn(place.starter, place.starter.role) } : benchBestRole(player);
  return rated === undefined ? null : <StarRating stars={starsIn(rated.cell, rated.role.key, player.stars)} subject={ROLE_FIT_SUBJECT} />;
}

/** A starter's slot chip; a bench player's place, then his main position's chip. */
function PositionCell({ player, place }: { player: SquadMember; place: { starter: Starter } | { benchIndex: number } }) {
  if ("starter" in place) return <PositionChip label={positionOfSlot(place.starter)} />;
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

/** A starter's Role ▾: his role, which opens his role card, where another his slot offers is picked
 *  (spec/05 Roles; #848). */
function RoleButton({ player, starter, onRoleCard }: { player: SquadMember; starter: Starter; onRoleCard(playerCode: number): void }) {
  return (
    <button
      type="button"
      aria-label={roleLabel(player.name)}
      {...markOf("role", player.playerCode)}
      onClick={() => onRoleCard(player.playerCode)}
      className="text-box flex w-full items-center justify-between gap-1 text-left lg:min-h-0"
    >
      <span className="truncate">{roleIn(starter, starter.role).name}</span>
      <span aria-hidden="true">{menuGlyph}</span>
    </button>
  );
}
