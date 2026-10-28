import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { switchableLeagues } from "../../../convex/leagues/lastLeague";
import { LEAGUES_SHOWN } from "../../../convex/leagues/leagueLimits";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ADMIN, actingAs, CO_COMMISSIONER, COMMISSIONER, MANAGERS, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The league switcher (#76, spec/13, Several leagues): which league signIn/account:signedInAs says the
// app is in, and switching to another.

const [ANN, BOB] = MANAGERS;

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});

const accountOf = async (email: string) => (await (await actingAs(t, email)).query(api.signIn.account.signedInAs, {}))!;
const currentLeagueOf = async (email: string) => (await accountOf(email)).currentLeagueId;
const switchTo = async (email: string, leagueId: Id<"leagues">) =>
  (await actingAs(t, email)).mutation(api.leagues.lastLeague.switchTo, { leagueId });

/** Two leagues, "First" and "Second", both run by COMMISSIONER, with Ann managing a team in each. */
async function annInTwoLeagues() {
  const second = await adminCreatesLeague(t, 4, "Second");
  const first = await adminCreatesLeague(t, 4, "First");
  await addManagers(t, first, [ANN]);
  const [annsSecondTeam] = await addManagers(t, second, [ANN]);
  return { first, second, annsSecondTeam };
}

test("a manager in two leagues is in the first by name until they switch", async () => {
  const { first } = await annInTwoLeagues();
  expect(await currentLeagueOf(ANN)).toBe(first);
});

test("#76 Done: a manager who switches leagues opens the one they switched to on their next sign-in, on another device", async () => {
  const { second } = await annInTwoLeagues();
  await switchTo(ANN, second);

  const user = await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ANN))
      .unique(),
  );
  const otherDevice = t.withIdentity({ subject: `${user!._id}|other-device-session` });
  expect((await otherDevice.query(api.signIn.account.signedInAs, {}))!.currentLeagueId).toBe(second);
});

test("switching back and forth keeps the last one, and each person keeps their own", async () => {
  const { first, second } = await annInTwoLeagues();
  await addManagers(t, second, [BOB]);
  await addManagers(t, first, [BOB]);
  await switchTo(ANN, second);
  await switchTo(ANN, first);
  await switchTo(BOB, second);

  expect(await currentLeagueOf(ANN)).toBe(first);
  expect(await currentLeagueOf(BOB)).toBe(second);
});

test("a commissioner with no team switches between the leagues they run", async () => {
  const { first, second } = await annInTwoLeagues();
  expect(await currentLeagueOf(COMMISSIONER)).toBe(first);

  await switchTo(COMMISSIONER, second);
  expect(await currentLeagueOf(COMMISSIONER)).toBe(second);
});

test("a co-commissioner with no team in a league they help run switches into it", async () => {
  const { first, second } = await annInTwoLeagues();
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId: second, email: CO_COMMISSIONER });
  await addManagers(t, first, [CO_COMMISSIONER]);
  expect(await currentLeagueOf(CO_COMMISSIONER)).toBe(first);

  await switchTo(CO_COMMISSIONER, second);
  expect(await currentLeagueOf(CO_COMMISSIONER)).toBe(second);
});

test("switching to a league they have no part in is refused, and they stay where they were", async () => {
  const { first, second } = await annInTwoLeagues();
  const strangers = await adminCreatesLeague(t, 4, "Strangers");
  await switchTo(ANN, second);

  await expect(switchTo(ANN, strangers)).rejects.toThrow(refusals.notInLeague);
  await expect(switchTo(ADMIN, first)).rejects.toThrow(refusals.notInLeague);
  expect(await currentLeagueOf(ANN)).toBe(second);
});

test("a manager removed from the league they used last is in another of theirs, then in none", async () => {
  const { first, second, annsSecondTeam } = await annInTwoLeagues();
  await switchTo(ANN, second);
  const commissioner = await actingAs(t, COMMISSIONER);
  await commissioner.mutation(api.leagues.teams.removeManager, { leagueId: second, teamId: annsSecondTeam });
  expect(await currentLeagueOf(ANN)).toBe(first);

  await (await actingAs(t, ANN)).mutation(api.leagues.teams.leave, { leagueId: first });
  expect(await currentLeagueOf(ANN)).toBeNull();
});

test("the admin, removed from the league he used last, isn't left in it, though he still sees it", async () => {
  const { first, second } = await annInTwoLeagues();
  const [adminsTeam] = await addManagers(t, second, [ADMIN]);
  await addManagers(t, first, [ADMIN]);
  await switchTo(ADMIN, second);
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.teams.removeManager, { leagueId: second, teamId: adminsTeam });

  expect(await currentLeagueOf(ADMIN)).toBe(first);
});

test("the admin, with no part in any league, is in none, though he sees them all", async () => {
  await annInTwoLeagues();
  expect(await currentLeagueOf(ADMIN)).toBeNull();
});

test("a league being deleted is never the one the app is in, nor one to switch to, for whoever deleted it either", async () => {
  const { first, second } = await annInTwoLeagues();
  await switchTo(COMMISSIONER, first);
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId: first });

  expect(await currentLeagueOf(COMMISSIONER)).toBe(second);
  expect(await currentLeagueOf(ANN)).toBe(second);
  await expect(switchTo(COMMISSIONER, first)).rejects.toThrow(refusals.beingDeleted);
});

test("a manager can't switch into a league someone else is deleting, and isn't told it is going", async () => {
  const { first, second } = await annInTwoLeagues();
  await switchTo(ANN, second);
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId: first });

  await expect(switchTo(ANN, first)).rejects.toThrow(refusals.notInLeague);
  expect(await currentLeagueOf(ANN)).toBe(second);
});

test("the admin with a team in a league someone else is deleting is told it is being deleted", async () => {
  const { first } = await annInTwoLeagues();
  await addManagers(t, first, [ADMIN]);
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId: first });

  await expect(switchTo(ADMIN, first)).rejects.toThrow(refusals.beingDeleted);
});

test("the admin with no part in a league being deleted, which he sees, is told he isn't in it", async () => {
  const { first } = await annInTwoLeagues();
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId: first });

  expect((await accountOf(ADMIN)).leagues.map((league) => league.leagueId)).toContain(first);
  await expect(switchTo(ADMIN, first)).rejects.toThrow(refusals.notInLeague);
});

test("switching to a league that doesn't exist is refused as one they have no part in", async () => {
  const { second } = await annInTwoLeagues();
  const gone = await adminCreatesLeague(t, 4, "Gone");
  await t.run((ctx) => ctx.db.delete("leagues", gone));
  await switchTo(ANN, second);

  await expect(switchTo(ANN, gone)).rejects.toThrow(refusals.notInLeague);
  await expect(switchTo(ADMIN, gone)).rejects.toThrow(refusals.notInLeague);
  expect(await currentLeagueOf(ANN)).toBe(second);
});

test("#207: the switcher's list is the server's, by the one rule that picks the league the app is in", async () => {
  const { first, second } = await annInTwoLeagues();
  const third = await adminCreatesLeague(t, 4, "Third");
  await addManagers(t, second, [ADMIN]);
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId: first });

  // Who, the leagues they see, and those they can switch between: never one being deleted, nor
  // one the admin only oversees.
  const cases: [email: string, sees: Id<"leagues">[], switchable: Id<"leagues">[]][] = [
    [ANN, [second], [second]],
    [COMMISSIONER, [first, second, third], [second, third]],
    [ADMIN, [first, second, third], [second]],
  ];
  for (const [email, sees, switchable] of cases) {
    const account = await accountOf(email);
    expect(account.leagues.map((league) => league.leagueId)).toEqual(sees);
    expect(account.switchableLeagueIds).toEqual(switchable);
    expect(account.switchableLeagueIds).toEqual(switchableLeagues(account.leagues).map((league) => league.leagueId));
    expect(account.currentLeagueId).toBe(switchable[0]);
  }
});

test("#488: only a league the switcher lists is one to switch to, so one past the end of its list is refused", async () => {
  // LEAGUES_SHOWN + 1 leagues the commissioner runs: the list keeps the first LEAGUES_SHOWN made.
  const made = await adminCreatesLeague(t, 4, "League 0");
  const pastTheEnd = await t.run(async (ctx) => {
    const { _id, _creationTime, ...row } = (await ctx.db.get("leagues", made))!;
    let last = made;
    for (let copy = 1; copy <= LEAGUES_SHOWN; copy++) last = await ctx.db.insert("leagues", { ...row, name: `League ${copy}` });
    return last;
  });
  const { leaguesCut, switchableLeagueIds, currentLeagueId } = await accountOf(COMMISSIONER);
  expect(leaguesCut).toBe(true);
  expect(switchableLeagueIds).toHaveLength(LEAGUES_SHOWN);
  expect(switchableLeagueIds).not.toContain(pastTheEnd);

  await expect(switchTo(COMMISSIONER, pastTheEnd)).rejects.toThrow(refusals.notInLeague);
  expect(await currentLeagueOf(COMMISSIONER)).toBe(currentLeagueId);
  const lastListed = switchableLeagueIds.at(-1)!;
  await switchTo(COMMISSIONER, lastListed);
  expect(await currentLeagueOf(COMMISSIONER)).toBe(lastListed);
});
