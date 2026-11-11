import type { HeldMatchup, Matchup } from "./matchupShape";

// Commentary as the screen shows it at its minute (#1550). A query may not read the clock, and one
// taking the minute as an argument runs again, uncached, every minute for every open screen; so a
// query sends the moment its commentary is delayed from (matchCommentary.ts's `delayedFrom`), and
// the screen, holding the minute, says whether it is. Pure, so the screen and the tests agree.

/** Whether commentary delayed from `from` is delayed at `now`: never with null. */
export const isDelayedAt = (from: number | null, now: number): boolean => from !== null && now >= from;

type Held<Line> = { kind: "read"; lines: Line[]; delayedFrom: number | null } | { kind: "unread"; reason: string };
type Shown<Line> = { kind: "read"; lines: Line[]; delayed: boolean } | { kind: "unread"; reason: string };

/** Held commentary as shown at `now`. */
export function commentaryAt<Line>(held: Held<Line>, now: number): Shown<Line> {
  if (held.kind === "unread") return held;
  const { delayedFrom, ...read } = held;
  return { ...read, delayed: isDelayedAt(delayedFrom, now) };
}

/** The matchup `ofTeam` sends, as shown at `now`. */
export function matchupAt(held: HeldMatchup, now: number): Matchup {
  if (held.kind !== "headToHead") return held;
  const { game } = held;
  if (game.kind !== "scored") return { ...held, game };
  return { ...held, game: { ...game, commentary: commentaryAt(game.commentary, now) } };
}
