import { Link } from "@tanstack/react-router";
import { useId } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { roleIn, rolesOfSlot, slotLabel } from "../../../../convex/lineup/roles";
import { playerCardPath } from "../../../playerCard/paths";
import { closeGlyph, nextGlyph } from "../../../shared/words";
import { Placeholder } from "../../../ui/Placeholder";
import { PositionChip } from "../../../ui/PositionChip";
import { figureWords, noFigureWords } from "../../words";
import { markOf } from "../focusMarks";
import { benchBestRole, placeOf, type SquadMember } from "../lineupDraft";
import type { Moving } from "../pitch/Pitch";
import type { SeasonOf } from "../SquadTable";
import { NextMatches } from "../../squad/SquadTable";
import { statusNotSettledLabel } from "../../squad/words";
import {
  benchWhereWords,
  closePanelLabel,
  downLabel,
  downWords,
  lastFiveHead,
  lastFivePlaceholder,
  lastShort,
  moveLabel,
  movingWords,
  moveWords,
  nextThreeHead,
  nowWords,
  playerCardLabel,
  playerCardWords,
  playsHead,
  pointsHead,
  pointsPerActionHead,
  pointsPerActionPlaceholder,
  roleStarsPlaceholder,
  rolesHead,
  seasonShort,
  startingWhereWords,
  teamTacticLinePlaceholder,
  upLabel,
  upWords,
} from "../words";

/** How many of his gameweeks in the role the panel shows. */
const GAMEWEEKS_BACK = 5;

/** Move, Up and Down: the secondary action, desk-sized; Up or Down greys at either end of the bench. */
const PANEL_ACTION = "secondary-action lg:min-h-0 lg:py-1";
const BENCH_ORDER_ACTION = `${PANEL_ACTION} disabled:border-muted disabled:text-muted`;

/** Where he stands: his starter's slot, or his place on the bench and how long it is. */
type PanelPlace = NonNullable<ReturnType<typeof placeOf>>;

/** The selected player's panel, on top of the right-hand column (plate.md, Tables and panels; the
 *  approved Tactics picture, selected): where he stands, his status, the roles his slot offers (a
 *  bench player's, his main position's) with the one he plays marked, the team tactic's line for
 *  him, his positions, his next fixtures, his points, and what can be done to him: Move, Up and
 *  Down on the bench, and his player card. The cross closes it. Data not held yet is its
 *  placeholder (plate.md, Marks). */
export function PlayerPanel({
  leagueId,
  player,
  place,
  season,
  moving,
  onClose,
  onBenchAt,
}: {
  leagueId: Id<"leagues">;
  player: SquadMember;
  place: PanelPlace;
  season: SeasonOf;
  moving: Moving;
  onClose(): void;
  onBenchAt(playerCode: number, index: number, pressed: "up" | "down"): void;
}) {
  const titleId = useId();
  const isPicked = moving.picked?.playerCode === player.playerCode;
  const starter = "starter" in place ? place.starter : null;
  const slot = starter === null ? (benchBestRole(player)?.cell ?? null) : starter;
  const label = slot === null ? null : slotLabel(slot, starter?.role);
  const playing = starter === null ? null : roleIn(starter, starter.role).key;
  const row = season?.get(player.playerCode);
  const where = "starter" in place ? startingWhereWords(player.clubShortName, slotLabel(place.starter, place.starter.role)) : benchWhereWords(player.clubShortName, place.benchIndex);
  return (
    <section aria-labelledby={titleId} className="bg-panel">
      <div className="flex items-center gap-2 bg-plate py-1 pl-3 shadow-bevel-plate">
        <h2 id={titleId} className="text-lead font-bold">
          {player.name}
        </h2>
        <span className="grow text-soft">{where}</span>
        <button type="button" aria-label={closePanelLabel(player.name)} onClick={onClose} className="flex min-h-tap min-w-tap items-center justify-center text-lead font-bold lg:min-h-0">
          <span aria-hidden="true">{closeGlyph}</span>
        </button>
      </div>
      {/* As on the Squad tab: only a player FPL holds news on has a status, until its data is settled. */}
      {row?.chanceOfPlaying != null && (
        <p className="px-3 py-2">
          <Placeholder label={statusNotSettledLabel} className="h-5 w-full" />
        </p>
      )}
      {label !== null && slot !== null && (
        <>
          <div className="flex justify-between bg-head px-3 font-semibold text-ground">
            <span>{rolesHead(label)}</span>
            <span>{pointsPerActionHead}</span>
          </div>
          <ul>
            {rolesOfSlot(slot).map((role) => (
              <li key={role.key} aria-current={role.key === playing || undefined} className="flex flex-col gap-1 border-b border-panel-rule px-3 py-2 aria-current:bg-name-plate aria-current:shadow-current-edge">
                <span className="flex items-center gap-2">
                  <span className="text-lead font-semibold">{role.name}</span>
                  {role.key === playing && <span className="text-soft">{nowWords}</span>}
                  <Placeholder label={roleStarsPlaceholder(role.name)} className="ml-auto h-3 w-16" />
                </span>
                <Placeholder label={pointsPerActionPlaceholder(role.name)} className="h-5 w-full" />
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="border-b border-panel-rule px-3 py-2">
        <Placeholder label={teamTacticLinePlaceholder} className="h-5 w-full" />
      </p>
      <dl className="grid grid-cols-facts items-center gap-x-3 gap-y-2 px-3 py-2">
        <dt className="text-muted">{playsHead}</dt>
        <dd className="flex gap-1">
          {player.positions.map((position) => (
            <PositionChip key={position} label={position} />
          ))}
        </dd>
        <dt className="text-muted">{nextThreeHead}</dt>
        <dd>{row !== undefined && <NextMatches matches={row.nextFixtures} />}</dd>
        <dt className="text-muted">{lastFiveHead}</dt>
        <dd className="grid grid-cols-5 gap-1">
          {Array.from({ length: GAMEWEEKS_BACK }, (_, index) => (
            <Placeholder key={index} label={lastFivePlaceholder} className="h-5" />
          ))}
        </dd>
        <dt className="text-muted">{pointsHead}</dt>
        <dd className="flex gap-3">
          <span>
            {lastShort} <Figure points={row?.lastGameweekPoints} />
          </span>
          <span>
            {seasonShort} <Figure points={row?.seasonPoints} />
          </span>
        </dd>
      </dl>
      <div className="flex flex-wrap items-center gap-2 border-t border-panel-rule px-3 py-2">
        <button
          type="button"
          aria-pressed={isPicked}
          aria-label={moveLabel(player.name)}
          onClick={() => moving.onPick(player.playerCode)}
          className={PANEL_ACTION}
        >
          {isPicked ? movingWords : moveWords}
        </button>
        {"benchIndex" in place && (
          <>
            <button
              type="button"
              aria-label={upLabel(player.name)}
              {...markOf("bench-up", player.playerCode)}
              disabled={place.benchIndex === 0}
              onClick={() => onBenchAt(player.playerCode, place.benchIndex - 1, "up")}
              className={BENCH_ORDER_ACTION}
            >
              {upWords}
            </button>
            <button
              type="button"
              aria-label={downLabel(player.name)}
              {...markOf("bench-down", player.playerCode)}
              disabled={place.benchIndex === place.benchLast}
              onClick={() => onBenchAt(player.playerCode, place.benchIndex + 1, "down")}
              className={BENCH_ORDER_ACTION}
            >
              {downWords}
            </button>
          </>
        )}
        {/* One the football sync doesn't hold has no card to open (#323). */}
        {!player.unheld && (
          <Link to={playerCardPath(leagueId, player.playerCode)} aria-label={playerCardLabel(player.name)} className="ml-auto flex min-h-tap items-center gap-1 font-semibold lg:min-h-0">
            {playerCardWords} <span aria-hidden="true">{nextGlyph}</span>
          </Link>
        )}
      </div>
    </section>
  );
}

function Figure({ points }: { points: number | null | undefined }) {
  if (points === undefined) return null;
  return points === null ? <span className="text-muted">{noFigureWords}</span> : <span className="font-bold text-figure">{figureWords(points)}</span>;
}
