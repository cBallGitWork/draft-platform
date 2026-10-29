import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Lineup } from "../../../convex/lineup/lineup";
import { lineupRefusals } from "../../../convex/lineup/lineupWords";
import { refusals } from "../../../convex/shared/leagueAccess";
import { FIRST_GAMEWEEK, GAMEWEEKS, noSuchGameweek } from "../../../convex/gameweeks/usedGameweeks";
import { MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { FPL_DEADLINE_RULE } from "../../../convex/gameweeks/deadline";
import type { Position } from "../../../convex/positions/positionTables";
import { holdGameweeks, KICKS_OFF_IN, rulesWith } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { FIRST_SUB, filledLineup, presetNamed } from "../../support/convex/lineup.harness";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { lineupInGameweek, lineupsInGameweek } from "../../../convex/lineup/lineups";
import { SQUAD_MOVES_READ_MOST } from "../../../convex/squads/squads";
import { openingLineup, shownLineup } from "../../../src/myTeam/lineupDraft";

// Storing a lineup (#8, spec/05: "A lineup rolls over to the next gameweek if the manager doesn't
// touch it"): a save is from the next gameweek not begun, a read takes the newest from that
// gameweek or before, and the squad decides who is still in it: as it is now for a gameweek not
// begun, as it stood at the deadline for one begun (#415).

const [ANN, BOB, , , OUTSIDER] = MANAGERS;
const NEXT = 9;
const { lineup: FOUR_FOUR_TWO, positions: STARTER_POSITIONS } = filledLineup(presetNamed("4-4-2"));
const STARTERS = FOUR_FOUR_TWO.starters.map(({ playerCode }) => playerCode);
const SQUAD = [...STARTERS, ...FOUR_FOUR_TWO.bench];
/** A player in the Premier League on no team in the league. */
const FREE_AGENT = 999;
/** Bob's player. */
const BOBS = 998;
/** A keeper in the Premier League, held only by the test that adds him. */
const SECOND_KEEPER = 997;
const BENCH_POSITION: Position = "CM";
/** Each test player is named for his code. */
const nameOf = (code: number) => `Player ${code}`;

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
  await t.run(async (ctx) => {
    for (const code of [...SQUAD, FREE_AGENT, BOBS]) {
      await ctx.db.insert("players", { code, name: nameOf(code), fullName: nameOf(code), clubCode: 1 });
      const positions = STARTER_POSITIONS.get(code) ?? [BENCH_POSITION];
      await ctx.db.insert("playerPositions", { code, starts: [], approved: [], set: [...positions], removed: [] });
    }
    for (const playerCode of SQUAD) await ctx.db.insert("squadPlayers", { leagueId, teamId: annsTeam, playerCode });
    await ctx.db.insert("squadPlayers", { leagueId, teamId: bobsTeam, playerCode: BOBS });
  });
});

/** The lineup as a browser sends it. */
const sent = (lineup: Lineup) => ({ starters: [...lineup.starters], bench: [...lineup.bench] });

const as = async (email: string) => {
  const person = await actingAs(t, email);
  return {
    save: (lineup: Lineup) => person.mutation(api.lineup.lineups.save, { leagueId, lineup: sent(lineup) }),
    mine: (gameweek: number) => person.query(api.lineup.lineups.mine, { leagueId, gameweek }),
  };
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

describe("a saved lineup", () => {
  test("is saved from the next gameweek not begun and rolls over to every one after it", async () => {
    const ann = await as(ANN);
    expect(await ann.save(FOUR_FOUR_TWO)).toBe(NEXT);

    expect(await ann.mine(NEXT)).toEqual(saved(FOUR_FOUR_TWO, NEXT));
    expect(await ann.mine(NEXT + 3)).toEqual(saved(FOUR_FOUR_TWO, NEXT));
    // Before it, no row is in force: the team holds the first lineup picked from its squad.
    expect(await ann.mine(NEXT - 1)).toEqual(saved(FOUR_FOUR_TWO, null));
  });

  test("keeps each starter's role as given, and refuses one his slot doesn't offer (#10)", async () => {
    const ann = await as(ANN);
    const [keeper, ...rest] = FOUR_FOUR_TWO.starters;
    const sweeper: Lineup = { ...FOUR_FOUR_TWO, starters: [{ ...keeper, role: "sweeperKeeper" }, ...rest] };
    await ann.save(sweeper);
    expect(await ann.mine(NEXT)).toEqual(saved(sweeper, NEXT));
    const misplaced: Lineup = { ...FOUR_FOUR_TWO, starters: [{ ...keeper, role: "poacher" }, ...rest] };
    await expectRefused(ann.save(misplaced), `The centre cell in Goalkeeper doesn't offer the role "poacher" ${nameOf(keeper.playerCode)} was given.`);
  });

  test("saved again before the same deadline replaces the first, one row for the gameweek", async () => {
    const ann = await as(ANN);
    await ann.save(FOUR_FOUR_TWO);
    expect(await ann.save(REVERSED_BENCH)).toBe(NEXT);

    expect(await ann.mine(NEXT)).toEqual(saved(REVERSED_BENCH, NEXT));
    expect(await lineupRows()).toHaveLength(1);
  });

  test("saved once the deadline has passed is from the gameweek after, and the begun one keeps the old", async () => {
    const ann = await as(ANN);
    await ann.save(FOUR_FOUR_TWO);
    vi.advanceTimersByTime(KICKS_OFF_IN - FPL_DEADLINE_RULE.minutesBeforeFirstKickoff * MINUTE_MS);

    expect(await ann.save(REVERSED_BENCH)).toBe(NEXT + 1);
    expect(await ann.mine(NEXT)).toEqual(saved(FOUR_FOUR_TWO, NEXT));
    expect(await ann.mine(NEXT + 1)).toEqual(saved(REVERSED_BENCH, NEXT + 1));
  });

  test("is from gameweek 1 before the season's gameweeks have arrived", async () => {
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("gameweeks").collect()) await ctx.db.delete("gameweeks", row._id);
    });
    expect(await (await as(ANN)).save(FOUR_FOUR_TWO)).toBe(FIRST_GAMEWEEK);
  });

  test("is refused once every gameweek has begun", async () => {
    vi.advanceTimersByTime((GAMEWEEKS - NEXT + 1) * WEEK_MS);
    await expectRefused((await as(ANN)).save(FOUR_FOUR_TWO), lineupRefusals.seasonOver);
  });
});

test("a team that has never saved a lineup holds its first, picked from its squad (spec/05, #637)", async () => {
  expect(await (await as(ANN)).mine(NEXT)).toEqual(saved(FOUR_FOUR_TWO, null));
  // Bob's one player, a centre midfielder, stands in the 4-4-2's first midfield slot.
  expect(await (await as(BOB)).mine(NEXT)).toEqual(saved({ starters: [{ playerCode: BOBS, area: "midfield", lane: "left" }], bench: [] }, null));
});

describe("read against the squad as it is now", () => {
  test("a starter and a sub who left drop out, and a newcomer goes to the end of the bench", async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    const [goneStarter] = STARTERS;
    const goneSub = FIRST_SUB;
    const newcomer = FREE_AGENT;
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("squadPlayers").collect()) {
        if (row.playerCode === goneStarter || row.playerCode === goneSub) await ctx.db.delete("squadPlayers", row._id);
      }
      await ctx.db.insert("squadPlayers", { leagueId, teamId: annsTeam, playerCode: newcomer });
    });

    expect(await (await as(ANN)).mine(NEXT)).toEqual({
      fromGameweek: NEXT,
      noLineup: false,
      starters: FOUR_FOUR_TWO.starters.filter(({ playerCode }) => playerCode !== goneStarter),
      bench: [...FOUR_FOUR_TWO.bench.filter((playerCode) => playerCode !== goneSub), newcomer],
      leftSquad: [goneStarter, goneSub],
      joinedBench: [newcomer],
      vacated: FOUR_FOUR_TWO.starters.filter(({ playerCode }) => playerCode === goneStarter),
    });
  });

  test("the Tactics screen shows the lineup the server reads, by the same rule (#597)", async () => {
    const ann = await as(ANN);
    await ann.save(FOUR_FOUR_TWO);
    // The screen holds the lineup it opened on while the squad changes under it.
    const opened = openingLineup({ lineup: await ann.mine(NEXT) });
    const [goneStarter] = STARTERS;
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("squadPlayers").collect()) {
        if (row.playerCode === goneStarter) await ctx.db.delete("squadPlayers", row._id);
      }
      await ctx.db.insert("squadPlayers", { leagueId, teamId: annsTeam, playerCode: FREE_AGENT });
    });
    const squadNow = [...SQUAD.filter((playerCode) => playerCode !== goneStarter), FREE_AGENT];

    const held = await ann.mine(NEXT);
    expect(shownLineup(opened, opened, squadNow)).toEqual({ starters: held.starters, bench: held.bench });
  });
});

describe("a begun gameweek keeps the squad as it stood at its deadline (#415)", () => {
  /** Past gameweek NEXT's deadline, recorded as the football sync records it. */
  const passNextDeadline = async () => {
    vi.advanceTimersByTime(KICKS_OFF_IN - FPL_DEADLINE_RULE.minutesBeforeFirstKickoff * MINUTE_MS);
    await t.run((ctx) => recordPassedDeadlines(ctx));
  };
  const commissioner = async () => {
    const person = await actingAs(t, COMMISSIONER);
    return {
      assign: (playerCode: number, teamId: Id<"teams">) => person.mutation(api.squads.squads.assign, { leagueId, playerCode, teamId }),
      move: (playerCode: number, teamId: Id<"teams">) => person.mutation(api.squads.squads.move, { leagueId, playerCode, teamId }),
      release: (playerCode: number) => person.mutation(api.squads.squads.release, { leagueId, playerCode }),
    };
  };
  /** Bob's lineup, written as it is stored: his one player on the bench. */
  const bobsLineup = () =>
    t.run((ctx) => ctx.db.insert("lineups", { leagueId, teamId: bobsTeam, fromGameweek: NEXT, starters: [], bench: [BOBS] }));
  const lineupOf = (teamId: Id<"teams">, gameweek: number) => t.run((ctx) => lineupInGameweek(ctx, leagueId, teamId, gameweek));

  test("a starter released, one moved and a newcomer assigned after it change only the next gameweek", async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    await bobsLineup();
    await passNextDeadline();
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
    await passNextDeadline();
    const [moved] = STARTERS;
    await (await commissioner()).move(moved, bobsTeam);

    // As entries: t.run returns only Convex values.
    const lineups = new Map(await t.run(async (ctx) => [...(await lineupsInGameweek(ctx, leagueId, [annsTeam, bobsTeam], NEXT))]));
    expect(lineups.get(annsTeam)).toEqual(saved(FOUR_FOUR_TWO, NEXT));
    expect(lineups.get(bobsTeam)).toEqual(saved({ starters: [], bench: [BOBS] }, NEXT));
  });

  test("a player released after it and assigned back is in it once, as he was", async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    await passNextDeadline();
    const by = await commissioner();
    await by.release(FIRST_SUB);
    await by.assign(FIRST_SUB, annsTeam);

    expect(await lineupOf(annsTeam, NEXT)).toEqual(saved(FOUR_FOUR_TWO, NEXT));
  });

  test("a player who left before it stays out of it, though he is back since", async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    const by = await commissioner();
    await by.release(FIRST_SUB);
    await passNextDeadline();
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
    await passNextDeadline();
    await by.release(FREE_AGENT);

    expect(await lineupOf(annsTeam, NEXT)).toEqual({ ...saved(FOUR_FOUR_TWO, NEXT), bench: [...FOUR_FOUR_TWO.bench, FREE_AGENT], joinedBench: [FREE_AGENT] });
  });

  test("a squad history that doesn't fit the squad throws, never a quiet guess", async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    await passNextDeadline();
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
    await passNextDeadline();
    const event = { kind: "playerReleased" as const, playerCode: FREE_AGENT, playerName: nameOf(FREE_AGENT), teamId: bobsTeam, teamName: "Bob's" };
    await t.run(async (ctx) => {
      for (let n = 0; n <= SQUAD_MOVES_READ_MOST; n += 1) await ctx.db.insert("leagueEvents", { leagueId, at: Date.now(), by: COMMISSIONER, event });
    });

    await expect(lineupOf(annsTeam, NEXT)).rejects.toThrow(`more than ${SQUAD_MOVES_READ_MOST} playerReleased moves`);
  });
});

describe("a team's first lineup, stored as its squad is made (#637)", () => {
  const commissioner = async () => {
    const person = await actingAs(t, COMMISSIONER);
    return {
      assign: (playerCode: number) => person.mutation(api.squads.squads.assign, { leagueId, playerCode, teamId: annsTeam }),
      release: (playerCode: number) => person.mutation(api.squads.squads.release, { leagueId, playerCode }),
      move: (playerCode: number, teamId: Id<"teams">) => person.mutation(api.squads.squads.move, { leagueId, playerCode, teamId }),
    };
  };
  /** Ann's squad built again by the commissioner, one player at a time, in SQUAD's order. */
  const buildAnnsSquad = async () => {
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("squadPlayers").withIndex("by_teamId", (q) => q.eq("teamId", annsTeam)).collect()) {
        await ctx.db.delete("squadPlayers", row._id);
      }
    });
    const by = await commissioner();
    for (const playerCode of SQUAD) await by.assign(playerCode);
    return by;
  };
  const lineupOf = (gameweek: number) => t.run((ctx) => lineupInGameweek(ctx, leagueId, annsTeam, gameweek));
  const annsRows = async () => (await lineupRows()).filter((row) => row.teamId === annsTeam);
  const passNextDeadline = async () => {
    vi.advanceTimersByTime(KICKS_OFF_IN - FPL_DEADLINE_RULE.minutesBeforeFirstKickoff * MINUTE_MS);
    await t.run((ctx) => recordPassedDeadlines(ctx));
  };

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
    await by.assign(SECOND_KEEPER);
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
    await by.assign(FREE_AGENT);
    expect(await (await as(ANN)).mine(NEXT)).toEqual({ ...saved(REVERSED_BENCH, NEXT), bench: [...REVERSED_BENCH.bench, FREE_AGENT], joinedBench: [FREE_AGENT] });
  });

  test("a change after the deadline picks it again only from the gameweek after: the begun one keeps what it locked", async () => {
    const by = await buildAnnsSquad();
    await passNextDeadline();
    await by.assign(FREE_AGENT);
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

  test("a begun gameweek with no row in force, from before #637, keeps its squad on the bench as it was scored, marked so", async () => {
    await passNextDeadline();
    expect(await lineupOf(NEXT)).toEqual({ ...saved({ starters: [], bench: SQUAD }, null), noLineup: true });
  });
});

describe("who may save and read", () => {
  test("a signed-out caller is refused", async () => {
    await expectRefused(t.mutation(api.lineup.lineups.save, { leagueId, lineup: sent(FOUR_FOUR_TWO) }), refusals.signedOut);
    await expectRefused(t.query(api.lineup.lineups.mine, { leagueId, gameweek: NEXT }), refusals.signedOut);
  });

  test("someone running no team in the league is refused, its commissioner included", async () => {
    for (const email of [OUTSIDER, COMMISSIONER]) {
      const person = await as(email);
      await expectRefused(person.save(FOUR_FOUR_TWO), refusals.runsNoTeam);
      await expectRefused(person.mine(NEXT), refusals.runsNoTeam);
    }
  });

  test("a gameweek outside the season is refused", async () => {
    await expectRefused((await as(ANN)).mine(GAMEWEEKS + 1), noSuchGameweek(GAMEWEEKS + 1));
  });

  test("saves only to the caller's own team", async () => {
    await (await as(ANN)).save(FOUR_FOUR_TWO);
    expect((await lineupRows()).map((row) => row.teamId)).toEqual([annsTeam]);
  });
});

describe("a lineup refused, with the reason", () => {
  test("a player not in the squad, a free agent or another team's", async () => {
    const lineup = { ...FOUR_FOUR_TWO, bench: [...FOUR_FOUR_TWO.bench, FREE_AGENT, BOBS] };
    await expectRefused((await as(ANN)).save(lineup), lineupRefusals.notInSquad([nameOf(FREE_AGENT), nameOf(BOBS)]));
  });

  test("a squad player left out of it", async () => {
    const lineup = { ...FOUR_FOUR_TWO, bench: FOUR_FOUR_TWO.bench.slice(1) };
    await expectRefused((await as(ANN)).save(lineup), lineupRefusals.leftOut([nameOf(FIRST_SUB)]));
  });

  test("two players in one cell, and a player outside his areas, every reason given", async () => {
    const [keeper, firstBack, ...rest] = FOUR_FOUR_TWO.starters;
    const lineup = { ...FOUR_FOUR_TWO, starters: [{ ...keeper, area: "attack", lane: "left" }, { ...firstBack, lane: "leftCentre" }, ...rest] };
    await expectRefused(
      (await as(ANN)).save(lineup),
      `${nameOf(keeper.playerCode)} plays GK, so he can't stand in the left cell in Attack. ` +
        `${nameOf(firstBack.playerCode)} and ${nameOf(rest[0].playerCode)} share the left-centre cell in Defence: one player a cell. ` +
        "The league starts at least 1 in Goalkeeper; this lineup starts 0 there.",
    );
    expect(await lineupRows()).toEqual([]);
  });

  test("under the area limits in force in the gameweek it is saved for", async () => {
    await t.run(async (ctx) => {
      const rules = rulesWith({});
      rules.areaLimits.attack = { minimum: 3, maximum: 5 };
      await ctx.db.insert("leagueRules", { leagueId, fromGameweek: NEXT, rules });
    });
    await expectRefused((await as(ANN)).save(FOUR_FOUR_TWO), "The league starts at least 3 in Attack; this lineup starts 2 there.");
  });

  test("a league with no rules, made before leagues held them", async () => {
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("leagueRules").collect()) await ctx.db.delete("leagueRules", row._id);
    });
    await expectRefused((await as(ANN)).save(FOUR_FOUR_TWO), lineupRefusals.noRules);
  });
});
