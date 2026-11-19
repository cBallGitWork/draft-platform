import type { ReactNode } from "react";
import { firstRunFrom } from "../../convex/waivers/waiverTimes";
import type { LeagueHome } from "./seam";
import {
  claimsWaitingWords,
  countdownWords,
  draftBoxLabel,
  figureWords,
  flaggedStarterWords,
  gapWords,
  lineupNotSetWords,
  lineupSetWords,
  locksLabel,
  moreFlaggedWords,
  noFigureWords,
  placeWords,
  pointsShortWords,
  seasonBoxLabel,
  seasonOverWords,
  stripBoxes,
  stripLabel,
  weekdayTimeWords,
} from "./words";

/** The deadline strip under the tabs, as the picture has it (Craig, 13 Nov 2026, on #1976): where
 *  the season stands (`firstBox`), the reader's lineup, when claims close and how many he has
 *  waiting, and his place in the table. It reads only; none of its boxes opens anything. "—" where
 *  he runs no team in the league. */
export function DeadlineStrip({ home, gameweek, now }: { home: LeagueHome; gameweek: number | null; now: number }) {
  const first = firstBox(home, gameweek, now);
  if (first === null) return null;
  const [, lineup, claims, table] = stripBoxes(first.label);
  return (
    <ul aria-label={stripLabel} className="flex flex-wrap bg-panel">
      <Box label={first.label}>{first.value}</Box>
      <Box label={lineup}>
        <Lineup lineup={home.yours?.lineup ?? null} />
      </Box>
      <Box label={claims}>
        <Claims yours={home.yours} now={now} />
      </Box>
      <Box label={table}>
        <Place home={home} />
      </Box>
    </ul>
  );
}

function Box({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-1 border-r border-panel-rule px-4 py-2">
      <span className="text-soft">{label}</span>
      <span className="text-lead">{children}</span>
    </li>
  );
}

/** The first box, saying where the season stands (S12.22): the draft and when it starts until it is
 *  over, then when this gameweek locks, and "Season over" once the last is final. Null with no
 *  gameweek once the draft is over, as in total points: no strip. */
function firstBox({ stage, deadline }: LeagueHome, gameweek: number | null, now: number): { label: string; value: ReactNode } | null {
  if (stage.kind === "draft") return { label: draftBoxLabel, value: <When at={stage.startsAt} now={now} /> };
  if (gameweek === null) return null;
  if (stage.kind === "over") return { label: seasonBoxLabel, value: seasonOverWords };
  return { label: locksLabel(gameweek), value: <When at={deadline} now={now} /> };
}

/** A day and time, with how long is left while it is to come; "—" with none. */
function When({ at, now }: { at: number | null; now: number }) {
  if (at === null) return noFigureWords;
  return (
    <>
      {weekdayTimeWords(at)}
      {at > now && <span className="text-derived"> {countdownWords(at - now)}</span>}
    </>
  );
}

function Lineup({ lineup }: { lineup: NonNullable<LeagueHome["yours"]>["lineup"] }) {
  if (lineup === null) return noFigureWords;
  if (!lineup.set) return <span className="text-event">{lineupNotSetWords}</span>;
  const [first, ...more] = lineup.flagged;
  if (first === undefined) return lineupSetWords;
  return (
    <span className="text-event">
      {flaggedStarterWords(first.name, first.chanceOfPlaying)}
      {more.length > 0 && moreFlaggedWords(more.length)}
    </span>
  );
}

function Claims({ yours, now }: { yours: LeagueHome["yours"]; now: number }) {
  const run = yours === null ? null : firstRunFrom(yours.waiverRuns, now);
  if (yours === null || run === null) return noFigureWords;
  return (
    <>
      {weekdayTimeWords(run)}, <span className="font-bold text-figure">{figureWords(yours.claims)}</span> {claimsWaitingWords(yours.claims)}
    </>
  );
}

/** His place and points; in head-to-head, how far he is behind the top, or ahead of the second. */
function Place({ home: { format, table } }: { home: LeagueHome }) {
  const mine = table.find((row) => row.mine);
  if (mine === undefined) return noFigureWords;
  const onTop = mine === table[0];
  const other = onTop ? table[1] : table[0];
  return (
    <>
      {placeWords(mine.position)}, <span className="font-bold text-figure">{figureWords(mine.points)}</span> {pointsShortWords}
      {format === "headToHead" && other !== undefined && `, ${gapWords(Math.abs(mine.points - other.points), onTop)}`}
    </>
  );
}
