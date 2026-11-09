import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { begunGameweeks } from "../gameweekScorer/gameweekScores";
import { FIRST_GAMEWEEK } from "../gameweeks/usedGameweeks";
import { CATALOGUE_STATS, checkCatalogueStat } from "../scoring/statCatalogue";
import { setOf, siteVersions } from "../scoring/siteVersions";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import type { Stats } from "../stats/statTotals";
import { teamTotals } from "../stats/teamSeasonTotals";

// Scouting's stat race (#800, spec/19 The stat race): each of the league's teams with its season
// total in every stat of the catalogue, and the scoring categories the screen races them in, counting only its starters and the bench players who came
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

/** Minutes are scored (appearance points) but never raced: the approved picture leaves them out. */
const NOT_RACED: ReadonlySet<string> = new Set(["minutes"]);

const statRace = v.object({
  /** The scoring categories, by the stat's key: each catalogue stat the site's scoring set scores
   *  (its newest version, as Player scoring shows it), in the set's order, minutes left out. */
  categories: v.array(v.string()),
  /** The league's first begun gameweek when it is after FPL's first, as a league drafted
   *  mid-season counts from there (Craig, 6 Nov 2026, on #800: "Since GW10"); null otherwise, and
   *  before any gameweek has begun. */
  since: v.union(v.number(), v.null()),
  teams: v.array(racingTeam),
});
export type StatRace = Infer<typeof statRace>;

/** Every team in the league, most of `stat` first (fewest with `descending` false), ties by name,
 *  and the gameweek its totals start in. Anyone not in the league is refused, as is a stat the
 *  catalogue doesn't hold. */
export const teams = query({
  args: { leagueId: v.id("leagues"), stat: v.string(), descending: v.boolean() },
  returns: statRace,
  handler: async (ctx, { leagueId, stat, descending }) => {
    const { league } = await memberOf(ctx, leagueId);
    checkCatalogueStat(stat);
    const totals = await teamTotals(ctx, leagueId);
    const rows = (await teamsOf(ctx, leagueId)).map((team) => {
      const stats = catalogueOnly(totals.get(team._id) ?? {});
      return { teamId: team._id, name: team.name, stats, stat: stats[stat] ?? 0 };
    });
    const direction = descending ? -1 : 1;
    rows.sort((one, other) => direction * (one.stat - other.stat) || one.name.localeCompare(other.name));
    const first = (await begunGameweeks(ctx, league))[0];
    const scored = setOf((await siteVersions(ctx)).at(-1)).rules.map((rule) => rule.stat);
    const categories = [...new Set(scored)].filter((each) => CATALOGUE_STATS.has(each) && !NOT_RACED.has(each));
    return { categories, since: first !== undefined && first > FIRST_GAMEWEEK ? first : null, teams: rows };
  },
});

/** The catalogue's stats alone: a record's other figures (FPL's own bonus, say) are never shown. */
function catalogueOnly(stats: Stats): Stats {
  return Object.fromEntries(Object.entries(stats).filter(([stat]) => CATALOGUE_STATS.has(stat)));
}
