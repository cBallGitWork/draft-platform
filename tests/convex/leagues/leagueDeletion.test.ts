import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { askToJoin, invite, makeLink, openLastLinkTo } from "../../support/convex/joining.harness";
import { refusals } from "../../../convex/shared/leagueAccess";
import { tablesKeyedToLeague } from "../../../convex/leagues/leagueDeletion";
import { ANN, BOB, CAT, DAN, aRowInEveryTable, accountOf, deletes, laterBy, leagueWithPeople, moreEventsThanOneRun, rowsKeyedTo } from "../../support/convex/leagueDeletion.harness";
import { changesTo, mutationsGivenALeague, rowsToChange } from "../../support/convex/leagueMutations.harness";
import { ADMIN, COMMISSIONER, CO_COMMISSIONER, LEAGUE_NAME, actingAs, eventsIn, leagueRow, teamsIn, type TestConvex } from "../../support/convex/leagues.harness";
import schema from "../../../convex/schema";
import { fakeResend, signInDeployment, type SentEmail } from "../../support/convex/signIn.harness";

// Deleting a league (#75, spec/13, Deleting): who may, the day it can be undone, and gone after.

let t: TestConvex;
let leagueId: Id<"leagues">;
let sent: SentEmail[];
beforeEach(async () => {
  t = await signInDeployment();
  sent = fakeResend();
  leagueId = await leagueWithPeople(t);
});

/** All of a league there is: its row, its teams, its events, and its invites, invite link and join requests. */
const everythingOf = async (id: Id<"leagues">) => ({
  league: await leagueRow(t, id),
  teams: await teamsIn(t, id),
  events: await eventsIn(t, id),
  joining: await t.run(async (ctx) => ({
    invites: await ctx.db.query("invites").withIndex("by_leagueId", (q) => q.eq("leagueId", id)).collect(),
    inviteLinks: await ctx.db.query("inviteLinks").withIndex("by_leagueId", (q) => q.eq("leagueId", id)).collect(),
    joinRequests: await ctx.db.query("joinRequests").withIndex("by_leagueId_and_decision", (q) => q.eq("leagueId", id)).collect(),
  })),
});

describe("who deletes a league", () => {
  test("the commissioner deletes it, filed for Mail with when it goes", async () => {
    const deletesAt = await deletes(t, COMMISSIONER, leagueId);

    expect((await leagueRow(t, leagueId))?.deletion).toMatchObject({ by: COMMISSIONER, deletesAt });
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({ by: COMMISSIONER, kind: "deletionStarted", name: LEAGUE_NAME, deletesAt });
  });

  test("the admin deletes it", async () => {
    await deletes(t, ADMIN, leagueId);
    expect((await leagueRow(t, leagueId))?.deletion?.by).toBe(ADMIN);
  });

  test("the co-commissioner and a manager can't, and it's left as it was", async () => {
    const before = await everythingOf(leagueId);
    for (const email of [CO_COMMISSIONER, ANN]) {
      const person = await actingAs(t, email);
      await expect(person.mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId })).rejects.toThrow(refusals.notDeleter);
    }
    expect(await everythingOf(leagueId)).toEqual(before);
  });
});

describe("while it can be undone", () => {
  test("every change to it is refused, saying why, and every mutation given a league is tried", async () => {
    const rows = await rowsToChange(t, leagueId);
    await deletes(t, COMMISSIONER, leagueId);
    const before = await everythingOf(leagueId);
    const changes = changesTo({ admin: await actingAs(t, ADMIN), ann: await actingAs(t, ANN), commissioner: await actingAs(t, COMMISSIONER) }, rows);
    for (const change of Object.values(changes)) await expect(change()).rejects.toThrow(refusals.beingDeleted);
    expect(await everythingOf(leagueId)).toEqual(before);

    // A mutation added later that is given a league, or a row in one, fails here until changesTo
    // tries it (leagueMutations.harness.ts): the freeze holds only where a change starts at
    // getLeague (leagueAccess.ts).
    // Opening one's own letter marks it read, which changes nothing in the league.
    const allowedWhileFrozen = ["leagues/leagueDeletion:undo", "mail/mail:open"];
    expect(Object.keys(changes).sort()).toEqual((await mutationsGivenALeague()).filter((name) => !allowedWhileFrozen.includes(name)));
  });

  test("nobody joins it: not by asking from its invite link, nor by opening an invite sent before", async () => {
    const token = await makeLink(t, leagueId);
    await invite(t, leagueId, CAT);
    await deletes(t, COMMISSIONER, leagueId);
    const { teams, joining } = await everythingOf(leagueId);

    await expect((await actingAs(t, DAN)).mutation(api.joining.joinRequests.ask, { token })).rejects.toThrow(refusals.beingDeleted);
    expect(await openLastLinkTo(t, sent, CAT)).not.toBeNull();
    expect(await teamsIn(t, leagueId)).toEqual(teams);
    expect((await everythingOf(leagueId)).joining).toEqual(joining);
  });

  test("it's hidden from everyone with a part in it but whoever deleted it, who is in no league now", async () => {
    const deletesAt = await deletes(t, COMMISSIONER, leagueId);

    for (const email of [CO_COMMISSIONER, ANN, BOB]) expect(await accountOf(t, email)).toMatchObject({ inLeague: false, leagues: [] });
    expect(await accountOf(t, COMMISSIONER)).toMatchObject({
      inLeague: false,
      leagues: [{ leagueId, deletion: { deletesAt } }],
    });
  });

  test("the admin sees it, whoever deleted it", async () => {
    await deletes(t, COMMISSIONER, leagueId);
    expect((await accountOf(t, ADMIN)).leagues).toMatchObject([{ leagueId, deletion: {} }]);
  });

  // "Its own commissioner can always see it during the 24 hours and undo it" (Craig, 22 Oct 2026).
  test("when the admin deletes it, its commissioner still sees it; the co-commissioner and managers don't", async () => {
    const deletesAt = await deletes(t, ADMIN, leagueId);

    expect(await accountOf(t, COMMISSIONER)).toMatchObject({ inLeague: false, leagues: [{ leagueId, deletion: { deletesAt } }] });
    expect((await accountOf(t, ADMIN)).leagues).toMatchObject([{ leagueId, deletion: { deletesAt } }]);
    for (const email of [CO_COMMISSIONER, ANN, BOB]) expect(await accountOf(t, email)).toMatchObject({ inLeague: false, leagues: [] });
  });

  test("when the admin deletes it, its commissioner can undo it; the co-commissioner and managers can't", async () => {
    await deletes(t, ADMIN, leagueId);
    for (const email of [CO_COMMISSIONER, ANN]) {
      await expect((await actingAs(t, email)).mutation(api.leagues.leagueDeletion.undo, { leagueId })).rejects.toThrow(refusals.notUndoer);
    }
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagueDeletion.undo, { leagueId });

    expect((await leagueRow(t, leagueId))?.deletion).toBeUndefined();
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({ by: COMMISSIONER, kind: "deletionUndone", name: LEAGUE_NAME });
  });

  test("whoever deleted it undoes it inside the day: the deletion is called off, and it comes back whole", async () => {
    const before = await everythingOf(leagueId);
    const deletesAt = await deletes(t, COMMISSIONER, leagueId);
    const { scheduledId } = (await leagueRow(t, leagueId))!.deletion!;
    await laterBy(t, deletesAt - 1 - Date.now());
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagueDeletion.undo, { leagueId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const deletion = await t.run((ctx) => ctx.db.system.get("_scheduled_functions", scheduledId));
    expect(deletion?.state.kind).toBe("canceled");

    const after = await everythingOf(leagueId);
    expect({ ...after, events: after.events.slice(0, -2) }).toEqual(before);
    expect(after.events.slice(-2)).toEqual([
      { by: COMMISSIONER, kind: "deletionStarted", name: LEAGUE_NAME, deletesAt: expect.any(Number) },
      { by: COMMISSIONER, kind: "deletionUndone", name: LEAGUE_NAME },
    ]);
    expect(await accountOf(t, ANN)).toMatchObject({ inLeague: true, leagues: [{ leagueId, roles: ["manager"] }] });
  });

  test("the admin can undo the commissioner's deletion; nobody else with a part in it can", async () => {
    await deletes(t, COMMISSIONER, leagueId);
    for (const email of [CO_COMMISSIONER, ANN]) {
      const person = await actingAs(t, email);
      await expect(person.mutation(api.leagues.leagueDeletion.undo, { leagueId })).rejects.toThrow(refusals.notUndoer);
    }
    await (await actingAs(t, ADMIN)).mutation(api.leagues.leagueDeletion.undo, { leagueId });
    expect((await leagueRow(t, leagueId))?.deletion).toBeUndefined();
  });

  test("undoing a league that isn't being deleted is refused", async () => {
    await expect((await actingAs(t, ADMIN)).mutation(api.leagues.leagueDeletion.undo, { leagueId })).rejects.toThrow(refusals.notBeingDeleted);
  });

  test("once the day is up, it's too late to undo", async () => {
    vi.setSystemTime(await deletes(t, COMMISSIONER, leagueId));
    await expect((await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagueDeletion.undo, { leagueId })).rejects.toThrow(refusals.tooLateToUndo);
  });
});

describe("after the day", () => {
  /** A league with nothing of it left. */
  const GONE = { league: null, teams: [], events: [], joining: { invites: [], inviteLinks: [], joinRequests: [] } };

  test("it's gone for good: the league, its teams, events, invites, invite link and join requests; another league is untouched", async () => {
    await askToJoin(t, leagueId, await makeLink(t, leagueId), DAN);
    await invite(t, leagueId, CAT);
    const other = await leagueWithPeople(t, "Another league");
    const othersBefore = await everythingOf(other);
    const deletesAt = await deletes(t, COMMISSIONER, leagueId);
    await laterBy(t, deletesAt - 1 - Date.now());
    expect(await leagueRow(t, leagueId)).not.toBeNull();

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await everythingOf(leagueId)).toEqual(GONE);
    expect(await everythingOf(other)).toEqual(othersBefore);
    expect((await accountOf(t, COMMISSIONER)).leagues.map((league) => league.name)).toEqual(["Another league"]);
  });

  test("a league with more events than one run deletes is gone all the same", async () => {
    await moreEventsThanOneRun(t, leagueId);
    await deletes(t, COMMISSIONER, leagueId);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await everythingOf(leagueId)).toEqual(GONE);
  });

  test("its rows in every table keyed to a league are deleted; another league's are untouched", async () => {
    const other = await leagueWithPeople(t, "Another league");
    for (const league of [leagueId, other]) await aRowInEveryTable(t, league);
    const before = await rowsKeyedTo(t, leagueId);
    const othersBefore = await rowsKeyedTo(t, other);
    for (const table of tablesKeyedToLeague) expect(before[table], `${table} has a row of the league`).toBeGreaterThan(0);

    await deletes(t, COMMISSIONER, leagueId);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await rowsKeyedTo(t, leagueId)).toEqual(Object.fromEntries(tablesKeyedToLeague.map((table) => [table, 0])));
    expect(await rowsKeyedTo(t, other)).toEqual(othersBefore);
  });

  test("every table keyed to a league is deleted with it", () => {
    const keyed = Object.entries(schema.tables).flatMap(([table, { validator }]) =>
      validator.kind === "object" && "leagueId" in validator.fields ? [table] : [],
    );
    expect([...tablesKeyedToLeague].sort()).toEqual(keyed.sort());
  });
});
