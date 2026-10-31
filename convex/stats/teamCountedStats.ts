import { slotInMatch, type TeamInGameweek } from "../gameweekScorer/teamGameweek";
import { countedStats } from "./seasonStats";
import { sumStats, type Stats } from "./statTotals";

// What a team's gameweek counted, as raw stats (#800, spec/19 The stat race: "It counts only what
// counted: a team's starters, and the bench players who came on"). The gameweek scorer
// (teamGameweek.ts) settles who counted, after auto-subs, and in which matches: under a double
// gameweek rule of best match only, his other match's stats count no more than its points do.

/** The stats of every man whose points count in the team's gameweek, in each match his points
 *  count, added up: a starter subbed off and a bench player who stayed on add nothing. A record
 *  adds its stats once whole, as his own season totals do (seasonStats.ts). */
export function countedTeamStats(scored: TeamInGameweek): Stats {
  const counted: Stats[] = [];
  for (const slot of [...scored.team.starters, ...scored.team.bench]) {
    if (!slot.counts) continue;
    const matches = scored.matchesOf.get(slot.playerCode);
    if (matches === undefined) throw new Error(`player ${slot.playerCode} has a slot but no matches in the gameweek`);
    for (const match of matches) {
      const inMatch = slotInMatch(scored, slot.playerCode, match.fixture.code)?.inMatch;
      const record = match.records.get(slot.playerCode);
      if (inMatch?.counted === true && record !== undefined) counted.push(countedStats(record));
    }
  }
  return sumStats(counted);
}
