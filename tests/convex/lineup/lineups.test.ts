import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Lineup } from "../../../convex/lineup/lineup";
import { lineupRefusals } from "../../../convex/lineup/lineupWords";
import { refusals } from "../../../convex/shared/leagueAccess";
import { FIRST_GAMEWEEK, GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { FPL_DEADLINE_RULE } from "../../../convex/gameweeks/deadline";
import { holdGameweeks, KICKS_OFF_IN, rulesWith } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { FIRST_SUB } from "../../support/convex/lineup.harness";
import { FOUR_FOUR_TWO, holdPlayers, holdSquad, nameOf, SQUAD, STARTERS } from "../../support/convex/lineupSquad.harness";
import { lineupInGameweek } from "../../../convex/lineup/lineups";
import { openingLineup, shownLineup } from "../../../src/myTeam/tactics/lineupDraft";

// Storing a lineup (#8, spec/05: "A lineup rolls over to the next gameweek if the manager doesn't
// touch it"): a save is from the next gameweek not begun, a read takes the newest from that
// gameweek or before, and the squad decides who is still in it: as it is now for a gameweek not
// begun, as it stood at the deadline for one begun (#415).

const [ANN, BOB, , , OUTSIDER] = MANAGERS;
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

describe("who may save and read", () => {
  test("a signed-out caller is refused", async () => {
    await expectRefused(t.mutation(api.lineup.lineups.save, { leagueId, lineup: sent(FOUR_FOUR_TWO) }), refusals.signedOut);
  });

  test("someone running no team in the league is refused, its commissioner included", async () => {
    for (const email of [OUTSIDER, COMMISSIONER]) {
      const person = await as(email);
      await expectRefused(person.save(FOUR_FOUR_TWO), refusals.runsNoTeam);
    }
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
