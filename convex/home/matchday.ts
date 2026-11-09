// League home's matchday mode (spec/12, League home; #387): from `beforeMs` before a matchday's
// first kickoff to `afterMs` after its last final whistle (platformSettings.ts's hours), the home is
// live. A matchday is one UK calendar day with Premier League matches, so a gameweek from Saturday
// to Monday has three; where two overlap, a late kickoff and the next day's early one, they join
// into one (Craig, 6 Nov 2026, #387). Pure: leagueHome.ts reads what it needs.

import { LIVE_WINDOW_MS } from "../stats/liveStats";
import { groupedBy } from "../shared/groupedBy";
import { londonDay } from "../shared/moments";

export interface MatchdayMatch {
  fixtureCode: number;
  /** Null while the match has no time: it is on no matchday. */
  kickoff: number | null;
  /** When a read first found it at full time; null before. */
  fullTimeAt: number | null;
}

export interface Matchday {
  start: number;
  end: number;
  /** The matches it holds, whose lines the home's Vidiprinter shows. */
  fixtureCodes: number[];
}

/** The matchday mode open at `now` among the matches, or null while the home is quiet. */
export function matchdayAt(matches: readonly MatchdayMatch[], margins: { beforeMs: number; afterMs: number }, now: number): Matchday | null {
  return matchdays(matches, margins).find(({ start, end }) => start <= now && now < end) ?? null;
}

/** Each matchday's window, in order, overlapping ones joined. */
export function matchdays(matches: readonly MatchdayMatch[], { beforeMs, afterMs }: { beforeMs: number; afterMs: number }): Matchday[] {
  const timed = matches.flatMap((match) => (match.kickoff === null ? [] : [{ ...match, kickoff: match.kickoff }]));
  const days = groupedBy(timed, ({ kickoff }) => londonDay(kickoff));
  const windows = [...days.values()]
    .map((day) => ({
      start: Math.min(...day.map(({ kickoff }) => kickoff)) - beforeMs,
      end: Math.max(...day.map(finalWhistle)) + afterMs,
      fixtureCodes: day.map(({ fixtureCode }) => fixtureCode),
    }))
    .toSorted((one, other) => one.start - other.start);
  const joined: Matchday[] = [];
  for (const window of windows) {
    const last = joined.at(-1);
    if (last !== undefined && window.start <= last.end) {
      last.end = Math.max(last.end, window.end);
      last.fixtureCodes.push(...window.fixtureCodes);
    } else joined.push({ ...window, fixtureCodes: [...window.fixtureCodes] });
  }
  return joined;
}

/** When a match's final whistle went: its full-time read, or while it has none, the latest it may
 *  still be on, the live tick's own horizon (liveStats.ts), so a feed that never reads full time
 *  can't hold the home live for good. */
const finalWhistle = ({ kickoff, fullTimeAt }: { kickoff: number; fullTimeAt: number | null }) => fullTimeAt ?? kickoff + LIVE_WINDOW_MS;
