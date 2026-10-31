import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Lineup } from "../../../convex/lineup/lineup";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { FOUR_FOUR_TWO, holdPlayers, holdSquad, nameOf, passNextDeadline, SQUAD, squadMoves } from "../../support/convex/lineupSquad.harness";
import { lineupInGameweek } from "../../../convex/lineup/lineups";

// A team's first lineup, stored as its squad is made (#637, spec/05): each squad move picks it
// again from the squad until the manager saves one. The rest of storing a lineup is in
// lineups.test.ts.

const [ANN, BOB] = MANAGERS;
const NEXT = 9;
/** A player in the Premier League on no team in the league. */
const FREE_AGENT = 999;
/** Bob's player. */
const BOBS = 998;
/** A keeper in the Premier League, held only by the test that adds him. */
const SECOND_KEEPER = 997;

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
let bobsTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
  [annsTeam, bobsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
  await holdSquad(t, leagueId, annsTeam);
  await holdSquad(t, leagueId, bobsTeam, [BOBS]);
  await holdPlayers(t, [FREE_AGENT]);
});

/** The lineup as a browser sends it. */
const sent = (lineup: Lineup) => ({ starters: [...lineup.starters], bench: [...lineup.bench] });

const as = async (email: string) => {
  const person = await actingAs(t, email);
  return {
    save: (lineup: Lineup) => person.mutation(api.lineup.lineups.save, { leagueId, lineup: sent(lineup) }),
    mine: (gameweek: number) => t.run((ctx) => lineupInGameweek(ctx, leagueId, teamOf(email), gameweek)),
  };
};
/** The team the manager runs: only Ann and Bob run one. */
const teamOf = (email: string): Id<"teams"> => {
  if (email === ANN) return annsTeam;
  if (email === BOB) return bobsTeam;
  throw new Error(`${email} runs no team in the league`);
};
const saved = (lineup: Lineup, fromGameweek: number | null) => ({
  fromGameweek,
  noLineup: false,
  starters: lineup.starters,
  bench: lineup.bench,
  leftSquad: [],
  joinedBench: [],
  vacated: [],
});
/** The lineup with its bench reversed: another lineup of the same squad. */
const REVERSED_BENCH: Lineup = { ...FOUR_FOUR_TWO, bench: FOUR_FOUR_TWO.bench.toReversed() };
const lineupRows = () => t.run((ctx) => ctx.db.query("lineups").collect());

describe("a team's first lineup, stored as its squad is made (#637)", () => {
  /** Ann's squad built again by the commissioner, one player at a time, in SQUAD's order. */
  const buildAnnsSquad = async () => {
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("squadPlayers").withIndex("by_teamId", (q) => q.eq("teamId", annsTeam)).collect()) {
        await ctx.db.delete("squadPlayers", row._id);
      }
    });
    const by = await squadMoves(t, leagueId, COMMISSIONER);
    for (const playerCode of SQUAD) await by.assign(playerCode, annsTeam);
    return by;
  };
  const lineupOf = (gameweek: number) => t.run((ctx) => lineupInGameweek(ctx, leagueId, annsTeam, gameweek));
  const annsRows = async () => (await lineupRows()).filter((row) => row.teamId === annsTeam);

  test("a squad built one player at a time ends on its whole 4-4-2, one row from the next gameweek", async () => {
    await buildAnnsSquad();
    expect(await (await as(ANN)).mine(NEXT)).toEqual(saved(FOUR_FOUR_TWO, NEXT));
    expect(await annsRows()).toMatchObject([{ fromGameweek: NEXT, firstLineup: true }]);
  });

  test("a starter released from it is replaced by the first on the bench who plays his slot", async () => {
    const by = await buildAnnsSquad();
    const [keeper, ...outfield] = FOUR_FOUR_TWO.starters;
    // A second keeper joins: the bench is the only place for him while the first plays.
    await t.run(async (ctx) => {
      await ctx.db.insert("players", { code: SECOND_KEEPER, name: nameOf(SECOND_KEEPER), fullName: nameOf(SECOND_KEEPER), clubCode: 1 });
      await ctx.db.insert("playerPositions", { code: SECOND_KEEPER, starts: [], approved: [], set: ["GK"], removed: [] });
    });
    await by.assign(SECOND_KEEPER, annsTeam);
    expect((await (await as(ANN)).mine(NEXT)).bench).toEqual([...FOUR_FOUR_TWO.bench, SECOND_KEEPER]);
    await by.release(keeper.playerCode);
    expect(await (await as(ANN)).mine(NEXT)).toEqual(saved({ starters: [{ ...keeper, playerCode: SECOND_KEEPER }, ...outfield], bench: FOUR_FOUR_TWO.bench }, NEXT));
  });

  test("a player moved between teams is picked again in both: out of the one, into the other", async () => {
    const by = await buildAnnsSquad();
    const [keeper, ...outfield] = FOUR_FOUR_TWO.starters;
    await by.move(keeper.playerCode, bobsTeam);
    // Ann has no keeper left, so her goal stands empty; Bob's new keeper goes in his.
    expect(await (await as(ANN)).mine(NEXT)).toEqual(saved({ starters: outfield, bench: FOUR_FOUR_TWO.bench }, NEXT));
    expect(await (await as(BOB)).mine(NEXT)).toEqual(
      saved({ starters: [{ ...keeper }, { playerCode: BOBS, area: "midfield", lane: "left" }], bench: [] }, NEXT),
    );
  });

  test("once the manager saves, it is theirs: a newcomer goes to the end of the bench and nothing is picked again", async () => {
    const by = await buildAnnsSquad();
    await (await as(ANN)).save(REVERSED_BENCH);
    expect(await annsRows()).toHaveLength(1);
    expect((await annsRows())[0].firstLineup).toBeUndefined();
    await by.assign(FREE_AGENT, annsTeam);
    expect(await (await as(ANN)).mine(NEXT)).toEqual({ ...saved(REVERSED_BENCH, NEXT), bench: [...REVERSED_BENCH.bench, FREE_AGENT], joinedBench: [FREE_AGENT] });
  });

  test("a change after the deadline picks it again only from the gameweek after: the begun one keeps what it locked", async () => {
    const by = await buildAnnsSquad();
    await passNextDeadline(t);
    await by.assign(FREE_AGENT, annsTeam);
    expect(await lineupOf(NEXT)).toEqual(saved(FOUR_FOUR_TWO, NEXT));
    expect(await lineupOf(NEXT + 1)).toEqual(saved({ ...FOUR_FOUR_TWO, bench: [...FOUR_FOUR_TWO.bench, FREE_AGENT] }, NEXT + 1));
    expect(await annsRows()).toMatchObject([{ fromGameweek: NEXT, firstLineup: true }, { fromGameweek: NEXT + 1, firstLineup: true }]);
  });

  test("a squad with nobody placed yet, for want of positions, holds an empty first lineup, not one marked as none", async () => {
    await t.run(async (ctx) => {
      const row = await ctx.db.query("playerPositions").withIndex("by_code", (q) => q.eq("code", BOBS)).unique();
      await ctx.db.patch("playerPositions", row!._id, { set: [] });
    });
    expect(await (await as(BOB)).mine(NEXT)).toEqual(saved({ starters: [], bench: [BOBS] }, null));
  });

  test("a pick benched for having no positions stays on the bench once he has some and the squad changes again (#836)", async () => {
    const setBobsPositions = (set: "CM"[]) =>
      t.run(async (ctx) => {
        const row = await ctx.db.query("playerPositions").withIndex("by_code", (q) => q.eq("code", BOBS)).unique();
        await ctx.db.patch("playerPositions", row!._id, { set });
      });
    const by = await squadMoves(t, leagueId, COMMISSIONER);
    await setBobsPositions([]);
    await by.release(BOBS);
    await by.assign(BOBS, bobsTeam);
    expect(await (await as(BOB)).mine(NEXT)).toEqual(saved({ starters: [], bench: [BOBS] }, NEXT));
    await setBobsPositions(["CM"]);
    // FREE_AGENT plays midfield as BOBS now does: he takes the slot BOBS was kept out of.
    await by.assign(FREE_AGENT, bobsTeam);
    expect(await (await as(BOB)).mine(NEXT)).toEqual(
      saved({ starters: [{ playerCode: FREE_AGENT, area: "midfield", lane: "left" }], bench: [BOBS] }, NEXT),
    );
  });

  test("a begun gameweek with no row in force, from before #637, keeps its squad on the bench as it was scored, marked so", async () => {
    await passNextDeadline(t);
    expect(await lineupOf(NEXT)).toEqual({ ...saved({ starters: [], bench: SQUAD }, null), noLineup: true });
  });
});
