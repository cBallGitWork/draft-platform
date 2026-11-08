// The game log's rows and what each says beside its figures (spec/12, The player card): his
// matches and his club's postponed ones in one list, newest first, each named from his club's side.

import { inTenths } from "../../convex/scoring/values";
import { nextFixtureShort, scoreWords } from "../shared/words";
import type { PlayedMatch, PlayerCard } from "./seam";

type Fixture = PlayerCard["postponed"][number];

/** A row of the game log: a match he was in, or one of his club's postponed with no new date. */
export type LogRow = (Fixture & { kind: "postponed" }) | (PlayedMatch & { kind: "played"; match: PlayedMatch });

/** His matches, newest first as the server sends them, with each postponed match put in by its
 *  gameweek above the first match from before it; one with no gameweek left goes last. */
export function logRowsOf(card: Pick<PlayerCard, "matches" | "postponed">): LogRow[] {
  const rows: LogRow[] = card.matches.map((match) => ({ ...match, kind: "played", match }));
  const postponed = card.postponed.toSorted((one, other) => (other.gameweek ?? -Infinity) - (one.gameweek ?? -Infinity));
  for (const fixture of postponed) {
    const before = fixture.gameweek === null ? -1 : rows.findIndex((row) => row.gameweek !== null && row.gameweek < fixture.gameweek!);
    rows.splice(before === -1 ? rows.length : before, 0, { ...fixture, kind: "postponed" });
  }
  return rows;
}

/** The match from his club's side: "LIV (A)"; null when neither side is his club now, as for a
 *  match from before he moved, which then names both. */
export function opponentWords(match: Pick<Fixture, "home" | "away">, clubCode: number): string | null {
  if (match.home.code === clubCode) return nextFixtureShort(match.away.shortName, true);
  if (match.away.code === clubCode) return nextFixtureShort(match.home.shortName, false);
  return null;
}

/** The match's score, home side first, or null before a feed has read one. */
export const scoreOf = (match: Pick<PlayedMatch, "score">) => (match.score === null ? null : scoreWords(match.score.home, match.score.away));

/** His points in the match at the `shown`th position: the league's override, else his base points;
 *  null while his record hasn't arrived. */
export const pointsOf = (match: PlayedMatch, shown: number) => match.override?.points ?? match.points[shown].total;

/** His minutes over the matches whose record has arrived, as his points skip the rest (the game log
 *  shows those matches' minutes as no figure); null while none has. */
function minutesOf(matches: readonly PlayedMatch[]) {
  const known = matches.flatMap((match) => (match.minutes === null ? [] : [match.minutes]));
  return known.length === 0 ? null : known.reduce((sum, minutes) => sum + minutes, 0);
}

/** His figures beside his name (spec/12 S12.1; #1027), at the `shown`th position: his base points
 *  this season, overrides in, as Scouting totals them; his points a match and his minutes over the
 *  matches priced; his last five matches' points, newest first. */
export function seasonFigures(matches: readonly PlayedMatch[], shown: number) {
  const priced = matches.map((match) => ({ match, points: pointsOf(match, shown) })).filter((each): each is { match: PlayedMatch; points: number } => each.points !== null);
  const total = inTenths(priced.reduce((sum, { points }) => sum + points, 0));
  return {
    seasonPoints: priced.length === 0 ? null : total,
    aMatch: priced.length === 0 ? null : inTenths(total / priced.length),
    minutes: minutesOf(matches),
    lastFive: priced.slice(0, 5).map(({ match, points }) => ({ fixtureCode: match.fixtureCode, points })),
  };
}
