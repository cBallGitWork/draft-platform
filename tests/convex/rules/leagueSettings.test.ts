import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { rulesInGameweek, rulesRefusals } from "../../../convex/rules/leagueRules";
import { settingsRefusals } from "../../../convex/rules/leagueSettings";
import type { LeagueSettings } from "../../../convex/rules/leagueSettingsPart";
import { refusals } from "../../../convex/shared/leagueAccess";
import { expectRefused, holdGameweeks, rulesRevision, HELD_FIRST_RULES, NO_AREA_MINIMUMS } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, CO_COMMISSIONER, eventsIn, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// League settings (Craig, 22 Oct 2026): the odd team out, games a gameweek and the squad's make-up
// (spec/03; #341), read and changed as any part of the rules is: from the next gameweek, with a letter, and never over someone else's
// save.

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: 9 });
  leagueId = await adminCreatesLeague(t);
});

/** The first rules' settings, the squad's maximum the site's for a test league's size. */
const FIRST: LeagueSettings = {
  oddTeamOut: "leagueAverage",
  gamesPerGameweek: 1,
  squadMaximum: HELD_FIRST_RULES.squad.size!.maximum,
  minimumByArea: null,
  maxPerClub: null,
};
/** The fixtures in one round of the four-team leagues the table tests make. */
const FIXTURES_A_ROUND = 2;
const read = async (email = COMMISSIONER) => (await actingAs(t, email)).query(api.rules.leagueSettings.settings, { leagueId, now: Date.now() });
/** A change made from the latest rules, or from the row `revision` names. */
const change = async (settings: LeagueSettings, email = COMMISSIONER, revision?: Id<"leagueRules"> | null) =>
  (await actingAs(t, email)).mutation(api.rules.leagueSettings.changeSettings, {
    leagueId,
    settings,
    revision: revision === undefined ? await rulesRevision(t, leagueId) : revision,
  });
/** The league's rules as saved before #33 and #130 made these rules: without them. */
const savedBeforeTheyWereRules = () =>
  t.run(async (ctx) => {
    const [row] = await ctx.db.query("leagueRules").collect();
    const { oddTeamOut: _odd, gamesPerGameweek: _games, ...older } = row.rules;
    await ctx.db.patch("leagueRules", row._id, { rules: older });
  });
const inGameweek = (gameweek: number) => t.run((ctx) => rulesInGameweek(ctx, leagueId, gameweek));

describe("reading them", () => {
  test("gives the settings the draw plays by, the row they're from and the next gameweek a change would take effect from", async () => {
    expect(await read()).toEqual({ part: FIRST, revision: await rulesRevision(t, leagueId), changesFrom: 9 });
  });

  test("gives rules saved before they were rules the first rules' values", async () => {
    await savedBeforeTheyWereRules();

    expect((await read())?.part).toEqual(FIRST);
  });

  test("is refused to a manager", async () => {
    await addManagers(t, leagueId, [MANAGERS[0]]);
    await expectRefused(read(MANAGERS[0]), refusals.notRunner);
  });
});

describe("changing them", () => {
  test("applies from the next gameweek only, keeps the rest of the rules, and files one letter", async () => {
    expect(await change({ ...FIRST, oddTeamOut: "bye", gamesPerGameweek: 2 })).toBe(9);

    expect(await inGameweek(8)).toEqual(HELD_FIRST_RULES);
    expect(await inGameweek(9)).toEqual({ ...HELD_FIRST_RULES, oddTeamOut: "bye", gamesPerGameweek: 2 });
    expect((await eventsIn(t, leagueId)).filter((event) => event.kind === "rulesChanged")).toEqual([
      { by: COMMISSIONER, kind: "rulesChanged", fromGameweek: 9, changed: ["oddTeamOut", "gamesPerGameweek"] },
    ]);
  });

  test("on rules saved before they were rules, writes only the setting changed", async () => {
    await savedBeforeTheyWereRules();
    await change({ ...FIRST, gamesPerGameweek: 2 });

    expect((await inGameweek(9)).oddTeamOut).toBeUndefined();
    expect((await eventsIn(t, leagueId)).at(-1)).toMatchObject({ kind: "rulesChanged", changed: ["gamesPerGameweek"] });
  });

  test.each([0, 1.5])("refuses %s games a gameweek with the reason, and saves nothing", async (games) => {
    await expectRefused(
      change({ ...FIRST, gamesPerGameweek: games }),
      `The head-to-head games each team plays a gameweek must be a whole number, 1 or more, not ${games}.`,
    );
    expect(await inGameweek(9)).toEqual(HELD_FIRST_RULES);
  });

  test("more games a gameweek than the league's teams have opponents for is refused, and saves nothing", async () => {
    await expectRefused(
      change({ ...FIRST, gamesPerGameweek: 10 }),
      "With 4 teams, a team can play at most 3 games a gameweek, not 10: one against each of the other 3.",
    );
    expect(await inGameweek(9)).toEqual(HELD_FIRST_RULES);
  });

  test("rules saved before that refusal, with more games than rounds, play as many as the round robin has", async () => {
    await addManagers(t, leagueId, MANAGERS.slice(0, 4));
    await t.run(async (ctx) => {
      const [row] = await ctx.db.query("leagueRules").collect();
      await ctx.db.patch("leagueRules", row._id, { rules: { ...row.rules, gamesPerGameweek: 10 } });
    });
    const table = await (await actingAs(t, COMMISSIONER)).query(api.table.leagueTable.ofLeague, { leagueId });

    // Four teams: three rounds of two fixtures, all three played each gameweek.
    expect(table?.roundRobinRounds).toBe(3);
    expect(table?.gameweeks[0].fixtures.length).toBe(table!.roundRobinRounds * FIXTURES_A_ROUND);
  });

  test("more games a gameweek reach the table from the gameweek the change applies from, never the one before it (#266)", async () => {
    await addManagers(t, leagueId, MANAGERS.slice(0, 4));
    const games = 3;
    const from = await change({ ...FIRST, gamesPerGameweek: games });
    const table = await (await actingAs(t, COMMISSIONER)).query(api.table.leagueTable.ofLeague, { leagueId });
    const fixturesIn = (gameweek: number) => table?.gameweeks.find((each) => each.gameweek === gameweek)?.fixtures.length;

    expect(fixturesIn(from)).toBe(games * FIXTURES_A_ROUND);
    expect(fixturesIn(from - 1)).toBe(FIRST.gamesPerGameweek * FIXTURES_A_ROUND);
  });

  test("over someone else's save is refused, naming them, and writes nothing", async () => {
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    const opened = await rulesRevision(t, leagueId);
    await change({ ...FIRST, gamesPerGameweek: 2 }, CO_COMMISSIONER, opened);
    const events = await eventsIn(t, leagueId);

    const refusal = change({ ...FIRST, oddTeamOut: "bye", gamesPerGameweek: 3 }, COMMISSIONER, opened);
    await expect(refusal).rejects.toThrow(`${CO_COMMISSIONER} saved the league's rules on`);
    expect((await inGameweek(9)).gamesPerGameweek).toBe(2);
    expect(await eventsIn(t, leagueId)).toEqual(events);
  });

  test("is refused to a manager", async () => {
    await addManagers(t, leagueId, [MANAGERS[0]]);
    await expectRefused(change({ ...FIRST, gamesPerGameweek: 2 }, MANAGERS[0]), refusals.notRunner);
  });
});

describe("the squad's make-up (#341)", () => {
  const SIZE = HELD_FIRST_RULES.squad.size!;
  const MINIMUMS = { ...NO_AREA_MINIMUMS, goalkeeper: 2, defence: 4 };

  test("saves the maximum, the minimums by area and the club maximum from the next gameweek, keeping the least squad size, with a letter", async () => {
    await change({ ...FIRST, squadMaximum: 25, minimumByArea: MINIMUMS, maxPerClub: 3 });

    expect((await inGameweek(9)).squad).toEqual({ size: { minimum: SIZE.minimum, maximum: 25 }, minimumByArea: MINIMUMS, maxPerClub: 3 });
    expect((await inGameweek(8)).squad).toEqual(HELD_FIRST_RULES.squad);
    expect((await eventsIn(t, leagueId)).at(-1)).toMatchObject({ kind: "rulesChanged", changed: ["squad"] });
    expect((await read())?.part).toEqual({ ...FIRST, squadMaximum: 25, minimumByArea: MINIMUMS, maxPerClub: 3 });
  });

  test("turns the minimums and the club maximum off again", async () => {
    await change({ ...FIRST, minimumByArea: MINIMUMS, maxPerClub: 3 });
    await change(FIRST);

    expect((await inGameweek(9)).squad).toEqual(HELD_FIRST_RULES.squad);
  });

  test.each([
    ["a maximum above a Premier League squad", { squadMaximum: 26 }, "The squad's maximum, 26, is above 25, a Premier League squad."],
    ["a maximum below the least squad size", { squadMaximum: 10 }, `The squad size's minimum, ${SIZE.minimum}, is above its maximum, 10.`],
    [
      "minimums adding up to more than the maximum",
      { squadMaximum: 12, minimumByArea: { ...NO_AREA_MINIMUMS, defence: 13 } },
      "The squad's minimums by area add up to 13, more than its maximum size, 12.",
    ],
    ["a fractional minimum", { minimumByArea: { ...NO_AREA_MINIMUMS, attack: 1.5 } }, "The squad's minimum in attack must be a whole number, 0 or more, not 1.5."],
    ["a club maximum of 0", { maxPerClub: 0 }, "The most players from one club must be a whole number, 1 or more, not 0."],
  ])("refuses %s with the reason, and saves nothing", async (_, settings, reason) => {
    await expectRefused(change({ ...FIRST, ...settings }), reason);
    expect(await inGameweek(9)).toEqual(HELD_FIRST_RULES);
  });

  describe("for rules with no squad size limit", () => {
    beforeEach(() =>
      t.run(async (ctx) => {
        const [row] = await ctx.db.query("leagueRules").collect();
        await ctx.db.patch("leagueRules", row._id, { rules: { ...row.rules, squad: { ...row.rules.squad, size: null } } });
      }),
    );

    test("reads no maximum, and saves the rest keeping none", async () => {
      expect((await read())?.part.squadMaximum).toBeNull();
      await change({ ...FIRST, squadMaximum: null, maxPerClub: 2 });

      expect((await inGameweek(9)).squad).toEqual({ size: null, minimumByArea: null, maxPerClub: 2 });
    });

    test("refuses a maximum, as the screen can't add a limit", async () => {
      await expectRefused(change({ ...FIRST, squadMaximum: 20 }), settingsRefusals.squadSizeFixed);
    });
  });

  test("refuses no maximum for rules with a squad size limit, as the screen can't take one away", async () => {
    await expectRefused(change({ ...FIRST, squadMaximum: null }), settingsRefusals.squadSizeFixed);
    expect(await inGameweek(9)).toEqual(HELD_FIRST_RULES);
  });

  test("is refused for a league made before leagues held rules", async () => {
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("leagueRules").collect()) await ctx.db.delete("leagueRules", row._id);
    });
    await expectRefused(change(FIRST, COMMISSIONER, null), rulesRefusals.noRules);
  });
});
