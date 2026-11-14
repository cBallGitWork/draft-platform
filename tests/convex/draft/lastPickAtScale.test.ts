import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { PICK_GAP_MS } from "../../../convex/draft/draftClock";
import { MOST_TEAMS } from "../../../convex/leagues/leagueLimits";
import { SECOND_MS } from "../../../convex/shared/time";
import { insertClubs, insertPlayers, type Club, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules, HELD_FIRST_RULES } from "../../support/convex/leagueRules.harness";
import { actingAs, COMMISSIONER, managersNamed, freshLeague } from "../../support/convex/leagues.harness";
import { clockRunsTo, ROWS_TO_THE_CAP } from "../../support/convex/test.harness";

// A draft's last pick, auto-picked from a full-size player pool, held to Convex's own limits
// (#1532), in a league of the most teams one holds (#2130): each player read once, not once per
// lookup, so every pick stays clear of the 4,096 index reads one transaction may make, and the
// undrafted go on waivers in a job of their own. Before #1532 this pool took the last pick past the
// limit, and the draft sat with its clock run out.

const POOL = 900;
/** Ten clubs of 90, a Premier League club holding at most 100 (shared/players.ts). */
const CLUBS: Club[] = Array.from({ length: 10 }, (_, index) => ({ code: 500 + index, name: `Club ${index}`, shortName: `C${index}` }));
const player = (index: number): HeldPlayer => ({
  code: 10_000 + index,
  name: `Player ${index}`,
  fullName: `Player ${index}`,
  clubCode: CLUBS[index % CLUBS.length].code,
  positions: ["CM"],
});
const EVERY_MANAGER = managersNamed(MOST_TEAMS);
const PICK_MS = PICK_GAP_MS + HELD_FIRST_RULES.draft!.pickSeconds * SECOND_MS;

test(
  `the first pick by hand, then ${MOST_TEAMS - 1} auto-picked from ${POOL} players each priced last season, the last among them, land, and the rest go on waivers`,
  ROWS_TO_THE_CAP,
  async () => {
    const { t, leagueId } = await freshLeague({ managers: EVERY_MANAGER, atConvexLimits: true, maxTeams: MOST_TEAMS });
    const players = Array.from({ length: POOL }, (_, index) => player(index));
    await t.run(async (ctx) => {
      await insertClubs(ctx, CLUBS);
      await insertPlayers(ctx, players);
      for (const [index, { code }] of players.entries()) await ctx.db.insert("pastSeasonPoints", { season: 2025, playerCode: code, points: { CM: index } });
    });
    await changeEveryRules(t, leagueId, (rules) => ({
      ...rules,
      squad: { size: { minimum: 1, maximum: 1 }, minimumByArea: null, maxPerClub: null },
      draft: { ...HELD_FIRST_RULES.draft!, undrafted: "waivers" },
    }));
    await (await actingAs(t, COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
    const [first] = players;
    await (await actingAs(t, EVERY_MANAGER[0])).mutation(api.draft.draftPicks.makePick, { leagueId, pick: 1, playerCode: first.code });
    // Every other clock runs out in turn; the draft ends the last pick's 10 seconds later (#1458).
    for (let pick = 1; pick < MOST_TEAMS; pick++) await clockRunsTo(t, Date.now() + PICK_MS);
    await clockRunsTo(t, Date.now() + PICK_GAP_MS);

    const { picks, onWaivers } = await t.run(async (ctx) => ({
      picks: await ctx.db.query("draftPicks").collect(),
      onWaivers: await ctx.db.query("waiverPlayers").collect(),
    }));
    // Each clock that ran out took the most points last season left: the pool's last players, down.
    const autoPicked = Array.from({ length: MOST_TEAMS - 1 }, (_, index) => ({ playerCode: players[POOL - 1 - index].code, auto: true }));
    expect(picks.map(({ playerCode, auto }) => ({ playerCode, auto }))).toEqual([{ playerCode: first.code, auto: undefined }, ...autoPicked]);
    expect(onWaivers).toHaveLength(POOL - MOST_TEAMS);
  },
);
