import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { refusals } from "./leagueAccess";
import { tablesKeyedToLeague } from "./leagueDeletion";
import { ANN, BOB, accountOf, deletes, laterBy, leagueWithPeople } from "./leagueDeletion.harness";
import { ADMIN, COMMISSIONER, CO_COMMISSIONER, actingAs, eventsIn, leagueRow, teamsIn, type TestConvex } from "./leagues.harness";
import schema from "./schema";
import { fakeResend, resetSignInDeployment, signInDeployment } from "./signIn.harness";

// Deleting a league (#75, spec/13, Deleting): who may, the day it can be undone, and gone after.

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await leagueWithPeople(t);
});
afterEach(resetSignInDeployment);

/** All of a league there is: its row, its teams and its events. */
const everythingOf = async (id: Id<"leagues">) => ({ league: await leagueRow(t, id), teams: await teamsIn(t, id), events: await eventsIn(t, id) });

describe("who deletes a league", () => {
  test("the commissioner deletes it, filed for Mail with when it goes", async () => {
    const deletesAt = await deletes(t, COMMISSIONER, leagueId);

    expect((await leagueRow(t, leagueId))?.deletion).toMatchObject({ by: COMMISSIONER, deletesAt });
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({ by: COMMISSIONER, kind: "deletionStarted", name: "Tim Hortons Pro League", deletesAt });
  });

  test("the admin deletes it", async () => {
    await deletes(t, ADMIN, leagueId);
    expect((await leagueRow(t, leagueId))?.deletion?.by).toBe(ADMIN);
  });

  test("the co-commissioner and a manager can't, and it's left as it was", async () => {
    const before = await everythingOf(leagueId);
    for (const email of [CO_COMMISSIONER, ANN]) {
      const person = await actingAs(t, email);
      await expect(person.mutation(api.leagueDeletion.deleteLeague, { leagueId })).rejects.toThrow(refusals.notDeleter);
    }
    expect(await everythingOf(leagueId)).toEqual(before);
  });
});

describe("while it can be undone", () => {
  test("every change to it is refused, saying why", async () => {
    const [annsTeam] = await teamsIn(t, leagueId);
    await deletes(t, COMMISSIONER, leagueId);
    const before = await everythingOf(leagueId);
    const admin = await actingAs(t, ADMIN);
    const ann = await actingAs(t, ANN);

    const changes = [
      admin.mutation(api.leagues.setMaxTeams, { leagueId, maxTeams: 6 }),
      admin.mutation(api.leagues.nameCommissioner, { leagueId, email: ANN }),
      admin.mutation(api.leagues.nameCoCommissioner, { leagueId, email: null }),
      admin.mutation(api.teams.addManager, { leagueId, email: "new@example.com" }),
      admin.mutation(api.teams.removeManager, { leagueId, teamId: annsTeam._id }),
      ann.mutation(api.teams.rename, { teamId: annsTeam._id, name: "Saka Potatoes" }),
      ann.mutation(api.teams.leave, { leagueId }),
      admin.mutation(api.leagueDeletion.deleteLeague, { leagueId }),
    ];
    for (const change of changes) await expect(change).rejects.toThrow(refusals.beingDeleted);
    expect(await everythingOf(leagueId)).toEqual(before);
  });

  test("it's hidden from everyone with a part in it but whoever deleted it, who is in no league now", async () => {
    const deletesAt = await deletes(t, COMMISSIONER, leagueId);

    for (const email of [CO_COMMISSIONER, ANN, BOB]) expect(await accountOf(t, email)).toMatchObject({ inLeague: false, leagues: [] });
    expect(await accountOf(t, COMMISSIONER)).toMatchObject({
      inLeague: false,
      leagues: [{ leagueId, deletion: { deletesAt, unemailed: [] } }],
    });
  });

  test("the admin sees it, whoever deleted it", async () => {
    await deletes(t, COMMISSIONER, leagueId);
    expect((await accountOf(t, ADMIN)).leagues).toMatchObject([{ leagueId, deletion: {} }]);
  });

  test("whoever deleted it undoes it inside the day: the deletion is called off, and it comes back whole", async () => {
    const before = await everythingOf(leagueId);
    const deletesAt = await deletes(t, COMMISSIONER, leagueId);
    const { scheduledId } = (await leagueRow(t, leagueId))!.deletion!;
    await laterBy(t, deletesAt - 1 - Date.now());
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagueDeletion.undo, { leagueId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const deletion = await t.run((ctx) => ctx.db.system.get("_scheduled_functions", scheduledId));
    expect(deletion?.state.kind).toBe("canceled");

    const after = await everythingOf(leagueId);
    expect({ ...after, events: after.events.slice(0, -2) }).toEqual(before);
    expect(after.events.slice(-2)).toEqual([
      { by: COMMISSIONER, kind: "deletionStarted", name: "Tim Hortons Pro League", deletesAt: expect.any(Number) },
      { by: COMMISSIONER, kind: "deletionUndone", name: "Tim Hortons Pro League" },
    ]);
    expect(await accountOf(t, ANN)).toMatchObject({ inLeague: true, leagues: [{ leagueId, roles: ["manager"] }] });
  });

  test("the admin can undo the commissioner's deletion; nobody else with a part in it can", async () => {
    await deletes(t, COMMISSIONER, leagueId);
    for (const email of [CO_COMMISSIONER, ANN]) {
      const person = await actingAs(t, email);
      await expect(person.mutation(api.leagueDeletion.undo, { leagueId })).rejects.toThrow(refusals.notUndoer);
    }
    await (await actingAs(t, ADMIN)).mutation(api.leagueDeletion.undo, { leagueId });
    expect((await leagueRow(t, leagueId))?.deletion).toBeUndefined();
  });

  test("undoing a league that isn't being deleted is refused", async () => {
    await expect((await actingAs(t, ADMIN)).mutation(api.leagueDeletion.undo, { leagueId })).rejects.toThrow(refusals.notBeingDeleted);
  });

  test("once the day is up, it's too late to undo", async () => {
    vi.setSystemTime(await deletes(t, COMMISSIONER, leagueId));
    await expect((await actingAs(t, COMMISSIONER)).mutation(api.leagueDeletion.undo, { leagueId })).rejects.toThrow(refusals.tooLateToUndo);
  });
});

describe("after the day", () => {
  test("it's gone for good: the league, its teams and its events; another league is untouched", async () => {
    const other = await leagueWithPeople(t, "Another league");
    const othersBefore = await everythingOf(other);
    const deletesAt = await deletes(t, COMMISSIONER, leagueId);
    await laterBy(t, deletesAt - 1 - Date.now());
    expect(await leagueRow(t, leagueId)).not.toBeNull();

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await everythingOf(leagueId)).toEqual({ league: null, teams: [], events: [] });
    expect(await everythingOf(other)).toEqual(othersBefore);
    expect((await accountOf(t, COMMISSIONER)).leagues.map((league) => league.name)).toEqual(["Another league"]);
  });

  test("a league with more events than one run deletes is gone all the same", async () => {
    await t.run(async (ctx) => {
      for (let i = 0; i < 1200; i += 1) {
        await ctx.db.insert("leagueEvents", { leagueId, at: i, by: ADMIN, event: { kind: "maxTeamsChanged", from: 4, to: 5 } });
      }
    });
    await deletes(t, COMMISSIONER, leagueId);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await everythingOf(leagueId)).toEqual({ league: null, teams: [], events: [] });
  });

  test("every table keyed to a league is deleted with it", () => {
    const keyed = Object.entries(schema.tables).flatMap(([table, { validator }]) =>
      validator.kind === "object" && "leagueId" in validator.fields ? [table] : [],
    );
    expect([...tablesKeyedToLeague].sort()).toEqual(keyed.sort());
  });
});
