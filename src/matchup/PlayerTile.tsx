import type { MatchupBenchSlot, MatchupStarter } from "../../convex/matchup/matchupShape";
import { Shirt } from "../ui/pitch/Shirt";
import { chipColoursOf } from "../ui/PositionChip";
import { autoSubWords, badgeText, figureWords, noFigureWords, notCountingLabel, offWords, overriddenLabel, pitchPlayerLabel, statusLabels, statusText, tileButtonLabel } from "./words";

// A man on the matchup as FPL's points pitch draws him (the approved picture; Craig, 8 Nov 2026:
// "Look at how FPL and draft and sleeper have the player tiles on pitch, much easier to read"): a
// card with a big shirt in his club's colours, his match's minute, "FT" or day in its corner and his
// points in the figure badge, a white name plate, an orange edge down its left when he came on as
// an auto-sub, then a strip in his area's colour with his slot's position label and his role. On
// the bench the same tile, greyed on a grey ground, without the strip or his match's badge, and an
// orange "Off" on a starter who didn't play and was replaced. A tap opens his breakdown at the top
// of the centre column (#798).

/** A man on a tile: a starter, or a bench player, with his slot and role once he stands in one. */
export type TileMan = MatchupStarter | MatchupBenchSlot;

/** Which man's breakdown is open, if any, and opening another's. */
export type Picking = { picked: number | null; pick(playerCode: number): void };

/** All a tile says, read out: "Delap, ST Poacher, 5, Finished FT", then whether his points count
 *  and what the auto-subs did with him. */
function tileLabel({ name, place, role, points, counts, overridden, status, autoSub }: TileMan): string {
  const figure = points === null ? noFigureWords : figureWords(points);
  const head = place !== null && role !== null ? pitchPlayerLabel(name, place.label, role.name, figure) : `${name}, ${figure}`;
  const atHalfTime = status.kind === "playing" && status.state === "halfTime";
  const parts = [head, `${atHalfTime ? statusLabels.halfTime : statusLabels[status.kind]} ${statusText(status)}`];
  if (overridden) parts.push(overriddenLabel);
  if (!counts) parts.push(notCountingLabel);
  if (autoSub !== null) parts.push(autoSub.kind === "unreplaced" ? autoSubWords.unreplaced : autoSubWords[autoSub.kind](autoSub.playerName));
  return parts.join(", ");
}

/** The figure's ink: muted while his points don't count or haven't arrived, a colour of its own once
 *  the league overrode them (spec/14 S14.31), else the figure yellow. */
const figureInk = (counting: boolean, overridden: boolean) => (!counting ? "text-muted" : overridden ? "text-overridden" : "text-figure");

/** `strip` is the pitch's: the bench's tiles have none, and are greyed. `className` is the tile's
 *  place in its pitch cell or bench row. */
export function PlayerTile({ man, picking, strip, className }: { man: TileMan; picking: Picking; strip: boolean; className: string }) {
  const { playerCode, name, area, clubCode, number, points, counts, overridden, status, autoSub, place, role } = man;
  const picked = picking.picked === playerCode;
  const wentOff = autoSub?.kind === "off";
  const colours = place === null ? null : chipColoursOf(place.label);
  const badge = strip || wentOff ? (wentOff ? offWords : badgeText(status)) : null;
  const figure = points === null ? noFigureWords : figureWords(points);
  const roleStrip = strip && colours !== null && role !== null && place !== null ? { colours, label: place.label, role: role.name } : null;
  // Every bit of text the tile shows, in its order, starts its button's name (WCAG 2.5.3; S12.14).
  const shown = [badge, number, figure, name, roleStrip?.label, roleStrip?.role].filter((bit) => bit !== null && bit !== undefined).join(" ");
  return (
    <li aria-label={tileLabel(man)} aria-current={picked || undefined} className={`flex min-w-0 ${className}`}>
      <button
        type="button"
        aria-label={tileButtonLabel(shown, name)}
        aria-expanded={picked}
        onClick={() => picking.pick(playerCode)}
        className={`relative flex w-tile max-w-full min-w-0 flex-col ${picked ? "outline-2 outline-fact" : ""}`}
      >
        {/* The bench's tile is greyed, its badge not: an orange "Off" at half strength fails WCAG 2.1 AA's
            contrast (S12.14; #2450). The badge stays first, so the button's name reads in the tile's order
            (WCAG 2.5.3), and z-10 paints it over the greyed part. */}
        {badge !== null && (
          <span aria-hidden="true" className={`absolute top-0 left-0 z-10 bg-name-plate px-0.5 text-data ${wentOff ? "text-event" : status.kind === "playing" ? "text-derived" : "text-soft"}`}>
            {badge}
          </span>
        )}{" "}
        <span className={`flex w-full min-w-0 flex-col ${strip ? "" : "opacity-50"}`}>
          {/* The bench's tiles stand on a dark grey ground, not the grass (the approved picture). */}
          <span aria-hidden="true" className={`relative flex justify-center pt-1 ${strip ? "bg-pitch-stripe" : "bg-panel-edge"}`}>
            {/* A space between each bit of text, so none runs into the next as one word (WCAG 2.5.3). */}
            <Shirt number={number} clubCode={clubCode} goalkeeper={area === "goalkeeper"} size="size-shirt-tile" />{" "}
            <span className={`absolute top-0 right-0 bg-name-plate px-1 font-bold ${figureInk(counts && points !== null, overridden)}`}>{figure}</span>
          </span>{" "}
          <span aria-hidden="true" className={`truncate bg-fact px-1 text-center font-semibold text-ground ${autoSub?.kind === "on" ? "shadow-event-edge" : ""}`}>
            {name}
          </span>{" "}
          {roleStrip !== null && (
            <span aria-hidden="true" className={`line-clamp-2 px-0.5 text-center text-data leading-pitch-role ${roleStrip.colours.fill} ${roleStrip.colours.ink}`}>
              <span data-slot-label>{roleStrip.label}</span> {roleStrip.role}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
