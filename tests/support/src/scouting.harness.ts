// Scouting's tests' fake seam (shell.harness.tsx hands it to the app): the players it holds and
// their season totals, filtered and sorted by the server's own rule (listOf), so a test sees what a
// filter keeps, and any two of them side by side.

import { vi } from "vitest";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { mainArea, per90FiguresIn, per90PanelOf } from "../../../convex/scouting/per90Figures";
import { listOf, shownStat } from "../../../convex/scouting/playersOrder";
import { MINUTES_STAT } from "../../../convex/stats/matchRecords";
import type { Stats } from "../../../convex/stats/statTotals";
import { raceOrder } from "../../../convex/scouting/raceOrder";
import type { PlayersList, RacingTeam, ScoutingSeam, StatRace, YourPlayer } from "../../../src/scouting/seam";
import type { PendingClaim } from "../../../src/myTeam/claims/seam";
import type { CardAction } from "../../../src/playerCard/seam";
import { fakePlayerCard } from "./playerCard.harness";
import { fakeScouts, type ScoutsData } from "./scouts.harness";
import { fakeShortlist, type ShortlistData } from "./shortlist.harness";

/** What the fake server holds: its clubs, the site set's own stats, players and their season totals
 *  by code, which the comparison and the per-90 figures read too, or nothing yet while the list or
 *  the comparison loads, and the shortlist. */
export type ScoutingData = {
  clubs?: PlayersList["clubs"];
  ownStats?: PlayersList["ownStats"];
  players?: readonly ListedPlayer[];
  totals?: Record<number, Stats>;
  /** The season the points are from while they are last season's; null (the default) for this season's. */
  pointsSeason?: number | null;
  loading?: boolean;
  comparing?: boolean;
  shortlist?: ShortlistData;
  scouts?: ScoutsData;
  /** The stat race's categories, teams and start (#800); its teams are ranked here by the stat
   *  asked, by the server's own rule (raceOrder). None held reads as loading. */
  race?: Omit<StatRace, "teams"> & { teams: readonly Omit<RacingTeam, "stat">[] };
  /** The selected player's pickup or claim, by his code, as the player card's tests hold them;
   *  none for a player not named. */
  actions?: ReadonlyMap<number, CardAction>;
  /** The manager's pending claims, as My team's Transactions tab reads them. */
  claims?: PendingClaim[];
  /** The manager's own player at the selected player's main position, and whether his squad is
   *  full; null (the default) for someone running no team. */
  yours?: YourPlayer;
};

/** The gameweeks the fake server says each short period counts: 9 have finished. */
export const PERIOD_GAMEWEEKS_SHOWN = { last4: [6, 7, 8, 9], last6: [4, 5, 6, 7, 8, 9] };

export function fakeScouting({ clubs = [], ownStats = [], players = [], totals = {}, pointsSeason = null, loading = false, comparing = false, shortlist, scouts, race, actions, claims = [], yours = null }: ScoutingData = {}) {
  const addToQueue = vi.fn<ReturnType<ScoutingSeam["useAddToQueue"]>>(async () => shortlist?.refusal ?? null);
  const playerOf = (playerCode: number) => players.find(({ code }) => code === playerCode)!;
  const weighed = (player: ListedPlayer) => ({ area: mainArea(player.positions), totals: totals[player.code] ?? {} });
  const { useCardAction, useWaiverChanges, waiverChanges } = fakePlayerCard({ actions });
  return {
    useCardAction,
    useWaiverChanges,
    waiverChanges,
    usePendingClaims: () => claims,
    ...fakeShortlist(shortlist),
    ...fakeScouts(scouts),
    useAddToQueue: () => addToQueue,
    addToQueue,
    // The totals are the same over every period; a test of the period reads what the screen asks.
    // With a `keep` code, his row whatever the filters keep, as the server answers it.
    usePlayersList: vi.fn<ScoutingSeam["usePlayersList"]>((_leagueId, filters, sort, stat, period, keep) => {
      if (loading) return undefined;
      const rows = players.map((player) => ({ ...player, stat: shownStat(totals[player.code], stat) }));
      return {
        clubs,
        ownStats,
        players: listOf(rows, filters, sort),
        pointsSeason,
        periodGameweeks: period === undefined || period === "season" ? [] : PERIOD_GAMEWEEKS_SHOWN[period],
        ...(keep === undefined ? {} : { kept: rows.find(({ code }) => code === keep) ?? null }),
      };
    }),
    // Both players' per-90 figures by the first's area, as the server weighs them (per90FiguresIn).
    useComparison: vi.fn<ScoutingSeam["useComparison"]>((_leagueId, codes, stat) => {
      if (codes === null || comparing) return undefined;
      const area = mainArea(playerOf(codes[0]).positions);
      return codes.map((code) => {
        const { totals: his } = weighed(playerOf(code));
        const figures = area === null ? [] : per90FiguresIn(area, his, players.map(weighed), stat);
        return { ...playerOf(code), minutes: his[MINUTES_STAT] ?? 0, figures };
      });
    }),
    // Each player's per-90 panel from his season totals, by the server's own rule (per90PanelOf).
    usePer90: vi.fn<ScoutingSeam["usePer90"]>((_leagueId, playerCode, stat) => per90PanelOf(weighed(playerOf(playerCode)), players.map(weighed), stat)),
    useYourPlayer: vi.fn<ScoutingSeam["useYourPlayer"]>(() => yours),
    useStatRace: vi.fn<ScoutingSeam["useStatRace"]>((_leagueId, stat) =>
      race === undefined ? undefined : { ...race, teams: raceOrder(race.teams.map((team) => ({ ...team, stat: team.stats[stat] ?? 0 })), true) },
    ),
  };
}
