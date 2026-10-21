import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { askToJoin, invite, makeLink, openLastLinkTo } from "./joining.harness";
import { FIRST_RULES } from "./firstRules";
import { refusals } from "./leagueAccess";
import { tablesKeyedToLeague } from "./leagueDeletion";
import { ANN, BOB, CAT, DAN, accountOf, deletes, laterBy, leagueWithPeople, mutationsGivenALeague } from "./leagueDeletion.harness";
import { ADMIN, COMMISSIONER, CO_COMMISSIONER, actingAs, eventsIn, leagueRow, teamsIn, type TestConvex } from "./leagues.harness";
import schema from "./schema";
import { fakeResend, resetSignInDeployment, signInDeployment, type SentEmail } from "./signIn.harness";

// Deleting a league (#75, spec/13, Deleting): who may, the day it can be undone, and gone after.

let t: TestConvex;
let leagueId: Id<"leagues">;
let sent: SentEmail[];
beforeEach(async () => {
  t = await signInDeployment();
  sent = fakeResend();
  leagueId = await leagueWithPeople(t);
});
afterEach(resetSignInDeployment);

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
  test("every change to it is refused, saying why, and every mutation given a league is tried", async () => {
    const [annsTeam] = await teamsIn(t, leagueId);
    const inviteId = await invite(t, leagueId, CAT);
    const requestId = await askToJoin(t, leagueId, await makeLink(t, leagueId), DAN);
    await deletes(t, COMMISSIONER, leagueId);
    const before = await everythingOf(leagueId);
    const admin = await actingAs(t, ADMIN);
    const ann = await actingAs(t, ANN);
    const commissioner = await actingAs(t, COMMISSIONER);

    const changes: Record<string, () => Promise<unknown>> = {
      "leagues:setMaxTeams": () => admin.mutation(api.leagues.setMaxTeams, { leagueId, maxTeams: 6 }),
      "leagues:nameCommissioner": () => admin.mutation(api.leagues.nameCommissioner, { leagueId, email: ANN }),
      "leagues:nameCoCommissioner": () => admin.mutation(api.leagues.nameCoCommissioner, { leagueId, email: null }),
      "teams:addManager": () => admin.mutation(api.teams.addManager, { leagueId, email: "new@example.com" }),
      "teams:removeManager": () => admin.mutation(api.teams.removeManager, { leagueId, teamId: annsTeam._id }),
      "teams:rename": () => ann.mutation(api.teams.rename, { teamId: annsTeam._id, name: "Saka Potatoes" }),
      "teams:leave": () => ann.mutation(api.teams.leave, { leagueId }),
      "leagueDeletion:deleteLeague": () => admin.mutation(api.leagueDeletion.deleteLeague, { leagueId }),
      "invites:send": () => admin.mutation(api.invites.send, { leagueId, email: "new@example.com" }),
      "invites:resend": () => admin.mutation(api.invites.resend, { inviteId }),
      "invites:cancel": () => admin.mutation(api.invites.cancel, { inviteId }),
      "inviteLink:make": () => admin.mutation(api.inviteLink.make, { leagueId }),
      "inviteLink:switchOff": () => admin.mutation(api.inviteLink.switchOff, { leagueId }),
      "joinRequests:approve": () => admin.mutation(api.joinRequests.approve, { requestId }),
      "joinRequests:refuseRequest": () => admin.mutation(api.joinRequests.refuseRequest, { requestId }),
      "leagueGameweeks:setUsed": () => admin.mutation(api.leagueGameweeks.setUsed, { leagueId, gameweek: 38, used: false }),
      "leagueRules:change": () => admin.mutation(api.leagueRules.change, { leagueId, rules: structuredClone(FIRST_RULES) }),
      "lastLeague:switchTo": () => commissioner.mutation(api.lastLeague.switchTo, { leagueId }),
      "mail:writeToLeague": () => admin.mutation(api.mail.writeToLeague, { leagueId, subject: "Still here?", body: "It's being deleted." }),
    };
    for (const change of Object.values(changes)) await expect(change()).rejects.toThrow(refusals.beingDeleted);
    expect(await everythingOf(leagueId)).toEqual(before);

    // A mutation added later that is given a league, or a row in one, fails here until it is tried
    // above: the freeze holds only where a change starts at getLeague (leagueAccess.ts).
    // Opening one's own letter marks it read, which changes nothing in the league.
    const allowedWhileFrozen = ["leagueDeletion:undo", "mail:open"];
    expect(Object.keys(changes).sort()).toEqual((await mutationsGivenALeague()).filter((name) => !allowedWhileFrozen.includes(name)));
  });

  test("nobody joins it: not by asking from its invite link, nor by opening an invite sent before", async () => {
    const token = await makeLink(t, leagueId);
    await invite(t, leagueId, CAT);
    await deletes(t, COMMISSIONER, leagueId);
    const { teams, joining } = await everythingOf(leagueId);

    await expect((await actingAs(t, DAN)).mutation(api.joinRequests.ask, { token })).rejects.toThrow(refusals.beingDeleted);
    expect(await openLastLinkTo(t, sent, CAT)).not.toBeNull();
    expect(await teamsIn(t, leagueId)).toEqual(teams);
    expect((await everythingOf(leagueId)).joining).toEqual(joining);
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
    await t.run(async (ctx) => {
      for (let i = 0; i < 1200; i += 1) {
        await ctx.db.insert("leagueEvents", { leagueId, at: i, by: ADMIN, event: { kind: "maxTeamsChanged", from: 4, to: 5 } });
      }
    });
    await deletes(t, COMMISSIONER, leagueId);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await everythingOf(leagueId)).toEqual(GONE);
  });

  test("every table keyed to a league is deleted with it", () => {
    const keyed = Object.entries(schema.tables).flatMap(([table, { validator }]) =>
      validator.kind === "object" && "leagueId" in validator.fields ? [table] : [],
    );
    expect([...tablesKeyedToLeague].sort()).toEqual(keyed.sort());
  });
});
