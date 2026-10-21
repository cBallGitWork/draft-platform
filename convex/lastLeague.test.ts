import { afterEach, beforeEach, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { refusals } from "./leagueAccess";
import { ADMIN, actingAs, CO_COMMISSIONER, COMMISSIONER, MANAGERS, addManagers, adminCreatesLeague, type TestConvex } from "./leagues.harness";
import { fakeResend, resetSignInDeployment, signInDeployment } from "./signIn.harness";

// The league switcher (#76, spec/13, Several leagues): which league account:signedInAs says the
// app is in, and switching to another.

const [ANN, BOB] = MANAGERS;

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});
afterEach(resetSignInDeployment);

const currentLeagueOf = async (email: string) => (await (await actingAs(t, email)).query(api.account.signedInAs, {}))!.currentLeagueId;
const switchTo = async (email: string, leagueId: Id<"leagues">) =>
  (await actingAs(t, email)).mutation(api.lastLeague.switchTo, { leagueId });

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
  expect((await otherDevice.query(api.account.signedInAs, {}))!.currentLeagueId).toBe(second);
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
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.nameCoCommissioner, { leagueId: second, email: CO_COMMISSIONER });
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
  await commissioner.mutation(api.teams.removeManager, { leagueId: second, teamId: annsSecondTeam });
  expect(await currentLeagueOf(ANN)).toBe(first);

  await (await actingAs(t, ANN)).mutation(api.teams.leave, { leagueId: first });
  expect(await currentLeagueOf(ANN)).toBeNull();
});

test("the admin, removed from the league he used last, isn't left in it, though he still sees it", async () => {
  const { first, second } = await annInTwoLeagues();
  const [adminsTeam] = await addManagers(t, second, [ADMIN]);
  await addManagers(t, first, [ADMIN]);
  await switchTo(ADMIN, second);
  await (await actingAs(t, COMMISSIONER)).mutation(api.teams.removeManager, { leagueId: second, teamId: adminsTeam });

  expect(await currentLeagueOf(ADMIN)).toBe(first);
});

test("the admin, with no part in any league, is in none, though he sees them all", async () => {
  await annInTwoLeagues();
  expect(await currentLeagueOf(ADMIN)).toBeNull();
});


test("a league being deleted is never the one the app is in, nor one to switch to, for whoever deleted it either", async () => {
  const { first, second } = await annInTwoLeagues();
  await switchTo(COMMISSIONER, first);
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagueDeletion.deleteLeague, { leagueId: first });

  expect(await currentLeagueOf(COMMISSIONER)).toBe(second);
  expect(await currentLeagueOf(ANN)).toBe(second);
  await expect(switchTo(COMMISSIONER, first)).rejects.toThrow(refusals.beingDeleted);
});
