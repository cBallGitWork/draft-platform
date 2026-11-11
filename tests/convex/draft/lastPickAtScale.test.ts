import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { PICK_GAP_MS } from "../../../convex/draft/draftClock";
import { SECOND_MS } from "../../../convex/shared/time";
import { insertClubs, insertPlayers, type Club, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules, HELD_FIRST_RULES } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { clockRunsTo, elapse, ROWS_TO_THE_CAP } from "../../support/convex/test.harness";

// A draft's last pick, auto-picked from a full-size player pool, held to Convex's own limits
// (#1532): each player read once, not once per lookup, so the pick stays clear of the 4,096 index
// reads one transaction may make, and the undrafted go on waivers in a job of their own. Before
// #1532 this pool took the last pick past the limit, and the draft sat with its clock run out.

const POOL = 900;
const [ANN, BOB] = MANAGERS;
/** Ten clubs of 90, a Premier League club holding at most 100 (shared/players.ts). */
const CLUBS: Club[] = Array.from({ length: 10 }, (_, index) => ({ code: 500 + index, name: `Club ${index}`, shortName: `C${index}` }));
const player = (index: number): HeldPlayer => ({
  code: 10_000 + index,
  name: `Player ${index}`,
  fullName: `Player ${index}`,
  clubCode: CLUBS[index % CLUBS.length].code,
  positions: ["CM"],
});

test(
  `the last pick, auto-picked from ${POOL} players each priced last season, lands, and the rest go on waivers`,
  ROWS_TO_THE_CAP,
  async () => {
    const t = await signInDeployment(undefined, true);
    fakeResend();
    const leagueId = await adminCreatesLeague(t, 5);
    await addManagers(t, leagueId, [ANN, BOB]);
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
    await (await actingAs(t, ANN)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode: first.code });
    await elapse(t, PICK_GAP_MS + HELD_FIRST_RULES.draft!.pickSeconds * SECOND_MS);
    await clockRunsTo(t, Date.now());

    const { picks, onWaivers } = await t.run(async (ctx) => ({
      picks: await ctx.db.query("draftPicks").collect(),
      onWaivers: await ctx.db.query("waiverPlayers").collect(),
    }));
    // Bob's clock ran out: the most points last season is the last player.
    expect(picks.map(({ playerCode, auto }) => ({ playerCode, auto }))).toEqual([
      { playerCode: first.code, auto: undefined },
      { playerCode: players[POOL - 1].code, auto: true },
    ]);
    expect(onWaivers).toHaveLength(POOL - 2);
  },
);
