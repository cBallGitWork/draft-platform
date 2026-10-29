import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Lineup } from "../../../convex/lineup/lineup";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { FIRST_SUB } from "../../support/convex/lineup.harness";
import { FOUR_FOUR_TWO, holdPlayers, holdSquad, nameOf, passNextDeadline, squadMoves, STARTERS } from "../../support/convex/lineupSquad.harness";
import { lineupInGameweek, lineupsInGameweek } from "../../../convex/lineup/lineups";
import { SQUAD_MOVES_READ_MOST } from "../../../convex/squads/squadPlace";

// A begun gameweek keeps the squad as it stood at its deadline (#415): a lineup read for it undoes
// the squad moves made since, while the gameweek after takes the squad as it is now.
// The rest of storing a lineup is in lineups.test.ts.

const [ANN, BOB] = MANAGERS;
const NEXT = 9;
/** A player in the Premier League on no team in the league. */
const FREE_AGENT = 999;
/** Bob's player. */
const BOBS = 998;

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

describe("a begun gameweek keeps the squad as it stood at its deadline (#415)", () => {
  const commissioner = () => squadMoves(t, leagueId, COMMISSIONER);
  /** Bob's lineup, written as it is stored: his one player on the bench. */
  const bobsLineup = () =>
    t.run((ctx) => ctx.db.insert("lineups", { leagueId, teamId: bobsTeam, fromGameweek: NEXT, starters: [], bench: [BOBS] }));
  const lineupOf = (teamId: Id<"teams">, gameweek: number) => t.run((ctx) => lineupInGameweek(ctx, leagueId, teamId, gameweek));

  test("a starter released, one moved and a newcomer assigned after it change only the next gameweek", async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    await bobsLineup();
    await passNextDeadline(t);
    const [released, moved] = STARTERS;
    const by = await commissioner();
    await by.release(released);
    await by.move(moved, bobsTeam);
    await by.assign(FREE_AGENT, annsTeam);

    expect(await lineupOf(annsTeam, NEXT)).toEqual(saved(FOUR_FOUR_TWO, NEXT));
    expect(await lineupOf(bobsTeam, NEXT)).toEqual(saved({ starters: [], bench: [BOBS] }, NEXT));
    expect(await lineupOf(annsTeam, NEXT + 1)).toEqual({
      fromGameweek: NEXT,
      noLineup: false,
      starters: FOUR_FOUR_TWO.starters.filter(({ playerCode }) => playerCode !== released && playerCode !== moved),
      bench: [...FOUR_FOUR_TWO.bench, FREE_AGENT],
      leftSquad: [released, moved],
      joinedBench: [FREE_AGENT],
      vacated: FOUR_FOUR_TWO.starters.filter(({ playerCode }) => playerCode === released || playerCode === moved),
    });
    expect(await lineupOf(bobsTeam, NEXT + 1)).toEqual({ ...saved({ starters: [], bench: [BOBS] }, NEXT), bench: [BOBS, moved], joinedBench: [moved] });
  });

  test("read for both teams at once, each undoes only its own moves from the one list", async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    await bobsLineup();
    await passNextDeadline(t);
    const [moved] = STARTERS;
    await (await commissioner()).move(moved, bobsTeam);

    // As entries: t.run returns only Convex values.
    const lineups = new Map(await t.run(async (ctx) => [...(await lineupsInGameweek(ctx, leagueId, [annsTeam, bobsTeam], NEXT))]));
    expect(lineups.get(annsTeam)).toEqual(saved(FOUR_FOUR_TWO, NEXT));
    expect(lineups.get(bobsTeam)).toEqual(saved({ starters: [], bench: [BOBS] }, NEXT));
  });

  test("a player released after it and assigned back is in it once, as he was", async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    await passNextDeadline(t);
    const by = await commissioner();
    await by.release(FIRST_SUB);
    await by.assign(FIRST_SUB, annsTeam);

    expect(await lineupOf(annsTeam, NEXT)).toEqual(saved(FOUR_FOUR_TWO, NEXT));
  });

  test("a player who left before it stays out of it, though he is back since", async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    const by = await commissioner();
    await by.release(FIRST_SUB);
    await passNextDeadline(t);
    await by.assign(FIRST_SUB, annsTeam);

    expect(await lineupOf(annsTeam, NEXT)).toEqual({
      ...saved(FOUR_FOUR_TWO, NEXT),
      bench: FOUR_FOUR_TWO.bench.filter((playerCode) => playerCode !== FIRST_SUB),
      leftSquad: [FIRST_SUB],
    });
  });

  test("a player who joined before it but after the lineup was saved sits at the end of its bench", async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    const by = await commissioner();
    await by.assign(FREE_AGENT, annsTeam);
    await passNextDeadline(t);
    await by.release(FREE_AGENT);

    expect(await lineupOf(annsTeam, NEXT)).toEqual({ ...saved(FOUR_FOUR_TWO, NEXT), bench: [...FOUR_FOUR_TWO.bench, FREE_AGENT], joinedBench: [FREE_AGENT] });
  });

  test("a squad history that doesn't fit the squad throws, never a quiet guess", async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    await passNextDeadline(t);
    await (await commissioner()).assign(FREE_AGENT, annsTeam);
    // His row taken away by hand, with no event saying so.
    await t.run(async (ctx) => {
      const row = await ctx.db.query("squadPlayers").filter((q) => q.eq(q.field("playerCode"), FREE_AGENT)).unique();
      if (row !== null) await ctx.db.delete("squadPlayers", row._id);
    });

    await expect(lineupOf(annsTeam, NEXT)).rejects.toThrow(`put player ${FREE_AGENT} on team ${annsTeam}, but he isn't in its squad after it`);
  });

  test(`more than ${SQUAD_MOVES_READ_MOST} moves of a kind since the deadline throws, never a cut`, async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    await passNextDeadline(t);
    const event = { kind: "playerReleased" as const, playerCode: FREE_AGENT, playerName: nameOf(FREE_AGENT), teamId: bobsTeam, teamName: "Bob's" };
    await t.run(async (ctx) => {
      for (let n = 0; n <= SQUAD_MOVES_READ_MOST; n += 1) await ctx.db.insert("leagueEvents", { leagueId, at: Date.now(), by: COMMISSIONER, event });
    });

    await expect(lineupOf(annsTeam, NEXT)).rejects.toThrow(`more than ${SQUAD_MOVES_READ_MOST} playerReleased moves`);
  });
});
