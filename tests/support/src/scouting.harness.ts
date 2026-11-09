// Scouting's tests' fake seam (shell.harness.tsx hands it to the app): the players it holds and
// their season totals, filtered and sorted by the server's own rule (listOf), so a test sees what a
// filter keeps, and any two of them side by side.

import { vi } from "vitest";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { listOf, shownStat } from "../../../convex/scouting/playersOrder";
import type { Stats } from "../../../convex/stats/statTotals";
import { raceOrder } from "../../../convex/scouting/raceOrder";
import type { ComparedPlayer, PlayersList, RacingTeam, ScoutingSeam, StatRace } from "../../../src/scouting/seam";
import { fakeShortlist, type ShortlistData } from "./shortlist.harness";

/** What the fake server holds: its clubs, the site set's own stats, players and their season totals by code, each one's
 *  season to compare (matches and stats added up) by his code, or nothing yet while the list or
 *  the comparison loads, and the shortlist. */
export type ScoutingData = {
  clubs?: PlayersList["clubs"];
  ownStats?: PlayersList["ownStats"];
  players?: readonly ListedPlayer[];
  totals?: Record<number, Stats>;
  seasons?: Record<number, Pick<ComparedPlayer, "matches" | "stats">>;
  /** The season the points are from while they are last season's; null (the default) for this season's. */
  pointsSeason?: number | null;
  loading?: boolean;
  comparing?: boolean;
  shortlist?: ShortlistData;
  /** The stat race's categories, teams and start (#800); its teams are ranked here by the stat
   *  asked, by the server's own rule (raceOrder). None held reads as loading. */
  race?: Omit<StatRace, "teams"> & { teams: readonly Omit<RacingTeam, "stat">[] };
};

/** A player with no season held: no matches yet. */
const NO_SEASON = { matches: 0, stats: {} };

export function fakeScouting({ clubs = [], ownStats = [], players = [], totals = {}, seasons = {}, pointsSeason = null, loading = false, comparing = false, shortlist, race }: ScoutingData = {}) {
  const addToQueue = vi.fn<ReturnType<ScoutingSeam["useAddToQueue"]>>(async () => shortlist?.refusal ?? null);
  return {
    ...fakeShortlist(shortlist),
    useAddToQueue: () => addToQueue,
    addToQueue,
    usePlayersList: vi.fn<ScoutingSeam["usePlayersList"]>((_leagueId, filters, sort, stat) =>
      loading
        ? undefined
        : { clubs, ownStats, players: listOf(players.map((player) => ({ ...player, stat: shownStat(totals[player.code], stat) })), filters, sort), pointsSeason },
    ),
    useComparison: vi.fn<ScoutingSeam["useComparison"]>((_leagueId, codes) =>
      codes === null || comparing
        ? undefined
        : codes.map((code) => ({ ...players.find((player) => player.code === code)!, ...(seasons[code] ?? NO_SEASON) })),
    ),
    useStatRace: vi.fn<ScoutingSeam["useStatRace"]>((_leagueId, stat) =>
      race === undefined ? undefined : { ...race, teams: raceOrder(race.teams.map((team) => ({ ...team, stat: team.stats[stat] ?? 0 })), true) },
    ),
  };
}
