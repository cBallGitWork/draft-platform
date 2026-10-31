import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { STAT_CATALOGUE } from "../scoring/statCatalogue";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import type { Stats } from "../stats/statTotals";
import { teamTotals } from "../stats/teamSeasonStats";

// Scouting's stat race (#800, spec/19 The stat race): each of the league's teams with its season
// total in every stat of the catalogue, counting only its starters and the bench players who came
// on (teamSeasonStats.ts), ranked by the stat the manager picks. Raw stats, not points. Totals are
// added once a gameweek is final, so the gameweek in play joins them about an hour after its last
// match, when that match locks (spec/07).

const racingTeam = v.object({
  teamId: v.id("teams"),
  name: v.string(),
  /** Its season total of each catalogue stat it has any of, by the stat's key; one left out is 0. */
  stats: v.record(v.string(), v.number()),
  /** Its season total of the stat ranked by, 0 if none. */
  stat: v.number(),
});
export type RacingTeam = Infer<typeof racingTeam>;

/** The catalogue's stats alone: a record's other figures (FPL's own bonus, say) are never shown. */
const CATALOGUE_KEYS = new Set(STAT_CATALOGUE.map((each) => each.stat));

/** Refuses a stat the catalogue doesn't hold, for any of Scouting's reads that shows one. */
export function checkCatalogueStat(stat: string): void {
  if (!CATALOGUE_KEYS.has(stat)) throw new Error(`No stat ${stat} is in the catalogue`);
}

/** Every team in the league, most of `stat` first (fewest with `descending` false), ties by name.
 *  Anyone not in the league is refused, as is a stat the catalogue doesn't hold. */
export const teams = query({
  args: { leagueId: v.id("leagues"), stat: v.string(), descending: v.boolean() },
  returns: v.array(racingTeam),
  handler: async (ctx, { leagueId, stat, descending }) => {
    await memberOf(ctx, leagueId);
    checkCatalogueStat(stat);
    const totals = await teamTotals(ctx, leagueId);
    const rows = (await teamsOf(ctx, leagueId)).map((team) => {
      const stats = catalogueOnly(totals.get(team._id) ?? {});
      return { teamId: team._id, name: team.name, stats, stat: stats[stat] ?? 0 };
    });
    const direction = descending ? -1 : 1;
    return rows.sort((one, other) => direction * (one.stat - other.stat) || one.name.localeCompare(other.name));
  },
});

function catalogueOnly(stats: Stats): Stats {
  return Object.fromEntries(Object.entries(stats).filter(([stat]) => CATALOGUE_KEYS.has(stat)));
}
