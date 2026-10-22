import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { rulesInGameweek, rulesRefusals } from "../../../convex/rules/leagueRules";
import type { LeagueSettings } from "../../../convex/rules/leagueSettings";
import { refusals } from "../../../convex/shared/leagueAccess";
import { expectRefused, holdGameweeks, rulesRevision } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, CO_COMMISSIONER, eventsIn, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// League settings (Craig, 22 Oct 2026): the odd team out and games a gameweek, read and changed as
// any part of the rules is: from the next gameweek, with a letter, and never over someone else's
// save.

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: 9 });
  leagueId = await adminCreatesLeague(t);
});

const FIRST: LeagueSettings = { oddTeamOut: "leagueAverage", gamesPerGameweek: 1 };
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
    expect(await change({ oddTeamOut: "bye", gamesPerGameweek: 2 })).toBe(9);

    expect(await inGameweek(8)).toEqual(FIRST_RULES);
    expect(await inGameweek(9)).toEqual({ ...FIRST_RULES, oddTeamOut: "bye", gamesPerGameweek: 2 });
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
    expect(await inGameweek(9)).toEqual(FIRST_RULES);
  });

  test("more games a gameweek than a round robin has rounds saves, and the table plays as many as there are", async () => {
    await addManagers(t, leagueId, MANAGERS.slice(0, 4));
    const from = await change({ ...FIRST, gamesPerGameweek: 10 });
    const table = await (await actingAs(t, COMMISSIONER)).query(api.table.leagueTable.ofLeague, { leagueId });
    const fixturesIn = (gameweek: number) => table?.gameweeks.find((each) => each.gameweek === gameweek)?.fixtures.length;

    // Four teams: three rounds of two fixtures, all three played each gameweek from the change on,
    // and one a gameweek before it (#266).
    const fixturesARound = 2;
    expect(table?.roundRobinRounds).toBe(3);
    expect(fixturesIn(from)).toBe(table!.roundRobinRounds * fixturesARound);
    expect(fixturesIn(from - 1)).toBe(fixturesARound);
  });

  test("over someone else's save is refused, naming them, and writes nothing", async () => {
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    const opened = await rulesRevision(t, leagueId);
    await change({ ...FIRST, gamesPerGameweek: 2 }, CO_COMMISSIONER, opened);
    const events = await eventsIn(t, leagueId);

    const refusal = change({ oddTeamOut: "bye", gamesPerGameweek: 3 }, COMMISSIONER, opened);
    await expect(refusal).rejects.toThrow(`${CO_COMMISSIONER} saved the league's rules on`);
    expect((await inGameweek(9)).gamesPerGameweek).toBe(2);
    expect(await eventsIn(t, leagueId)).toEqual(events);
  });

  test("is refused to a manager", async () => {
    await addManagers(t, leagueId, [MANAGERS[0]]);
    await expectRefused(change({ ...FIRST, gamesPerGameweek: 2 }, MANAGERS[0]), refusals.notRunner);
  });

  test("is refused for a league made before leagues held rules", async () => {
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("leagueRules").collect()) await ctx.db.delete("leagueRules", row._id);
    });
    await expectRefused(change(FIRST, COMMISSIONER, null), rulesRefusals.noRules);
  });
});
