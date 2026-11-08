import type { MatchupBenchSlot, MatchupStarter } from "../../convex/matchup/matchupShape";
import { Shirt } from "../myTeam/tactics/pitch/Pitch";
import { chipColoursOf } from "../ui/PositionChip";
import { autoSubWords, figureWords, noFigureWords, notCountingLabel, offWords, openBreakdownLabel, pitchPlayerLabel, statusLabels, statusText } from "./words";

// A man on the matchup as FPL's points pitch draws him (the approved picture; Craig, 8 Nov 2026:
// "Look at how FPL and draft and sleeper have the player tiles on pitch, much easier to read"): a
// card with a big shirt in his club's colours, his match's minute, "FT" or day in its corner and his
// points in the figure badge, a white name plate, an orange edge down its left when he came on as
// an auto-sub, then a strip in his area's colour with his slot's position label and his role. On
// the bench the same tile, greyed, without the strip, and an orange "Off" on a starter who didn't
// play and was replaced. A tap opens his breakdown at the top of the centre column (#798).

/** A man on a tile: a starter, or a bench player, with his slot and role once he stands in one. */
export type TileMan = MatchupStarter | MatchupBenchSlot;

/** Which man's breakdown is open, if any, and opening another's. */
export type Picking = { picked: number | null; pick(playerCode: number): void };

/** All a tile says, read out: "Delap, ST Poacher, 5, Finished FT", then whether his points count
 *  and what the auto-subs did with him. */
export function tileLabel({ name, place, role, points, counts, status, autoSub }: TileMan): string {
  const figure = points === null ? noFigureWords : figureWords(points);
  const head = place !== null && role !== null ? pitchPlayerLabel(name, place.label, role.name, figure) : `${name}, ${figure}`;
  const atHalfTime = status.kind === "playing" && status.state === "halfTime";
  const parts = [head, `${atHalfTime ? statusLabels.halfTime : statusLabels[status.kind]} ${statusText(status)}`];
  if (!counts) parts.push(notCountingLabel);
  if (autoSub !== null) parts.push(autoSub.kind === "unreplaced" ? autoSubWords.unreplaced : autoSubWords[autoSub.kind](autoSub.playerName));
  return parts.join(", ");
}

/** `strip` is the pitch's: the bench's tiles have none, and are greyed. `className` is the tile's
 *  place in its pitch cell or bench row. */
export function PlayerTile({ man, picking, strip, className }: { man: TileMan; picking: Picking; strip: boolean; className: string }) {
  const { playerCode, name, area, clubCode, number, points, counts, status, autoSub, place, role } = man;
  const picked = picking.picked === playerCode;
  const wentOff = autoSub?.kind === "off";
  const colours = place === null ? null : chipColoursOf(place.label);
  return (
    <li aria-label={tileLabel(man)} aria-current={picked || undefined} className={`flex min-w-0 ${className}`}>
      <button
        type="button"
        aria-label={openBreakdownLabel(name)}
        aria-expanded={picked}
        onClick={() => picking.pick(playerCode)}
        className={`flex w-tile max-w-full min-w-0 flex-col ${strip ? "" : "opacity-50"} ${picked ? "outline-2 outline-fact" : ""}`}
      >
        <span aria-hidden="true" className="relative flex justify-center bg-pitch-stripe pt-1">
          <span className={`absolute top-0 left-0 bg-name-plate px-0.5 text-data ${wentOff ? "text-event" : status.kind === "playing" ? "text-derived" : "text-soft"}`}>
            {wentOff ? offWords : statusText(status)}
          </span>
          <Shirt number={number} clubCode={clubCode} goalkeeper={area === "goalkeeper"} size="size-shirt-tile" />
          <span className={`absolute top-0 right-0 bg-name-plate px-1 font-bold ${counts && points !== null ? "text-figure" : "text-muted"}`}>
            {points === null ? noFigureWords : figureWords(points)}
          </span>
        </span>
        <span aria-hidden="true" className={`truncate bg-fact px-1 text-center font-semibold text-ground ${autoSub?.kind === "on" ? "shadow-event-edge" : ""}`}>
          {name}
        </span>
        {strip && colours !== null && role !== null && place !== null && (
          <span aria-hidden="true" className={`line-clamp-2 px-0.5 text-center text-data leading-pitch-role ${colours.fill} ${colours.ink}`}>
            <span data-slot-label>{place.label}</span> {role.name}
          </span>
        )}
      </button>
    </li>
  );
}
