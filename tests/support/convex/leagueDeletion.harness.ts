// Deleting a league's tests' shared setup (#75).

import { api } from "../../../convex/_generated/api";
import type { Id, TableNames } from "../../../convex/_generated/dataModel";
import { UNDO_MS, tablesKeyedToLeague } from "../../../convex/leagues/leagueDeletion";
import { askToJoin, invite, makeLink } from "./joining.harness";
import { elapse } from "./test.harness";
import { ADMIN, COMMISSIONER, CO_COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, teamsIn, type TestConvex } from "./leagues.harness";

export const [ANN, BOB, CAT, DAN] = MANAGERS;

/** A league with a commissioner who runs no team, a co-commissioner, and ANN and BOB managing. */
export async function leagueWithPeople(t: TestConvex, name?: string): Promise<Id<"leagues">> {
  const leagueId = await adminCreatesLeague(t, 4, name);
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
  await addManagers(t, leagueId, [ANN, BOB]);
  return leagueId;
}

/** `email` deletes the league, and whatever that schedules at once runs; the deletion itself
 *  waits. When it will be gone. */
export async function deletes(t: TestConvex, email: string, leagueId: Id<"leagues">): Promise<number> {
  const deletesAt = Date.now() + UNDO_MS;
  await (await actingAs(t, email)).mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId });
  await elapse(t, 1);
  return deletesAt;
}

/** How many events `moreEventsThanOneRun` gives a league: more than two of deleteForGood's runs
 *  take, so it hands on at least twice. */
const MANY_EVENTS = 1200;

/** Gives the league more events than one run of deleteForGood deletes. */
export const moreEventsThanOneRun = (t: TestConvex, leagueId: Id<"leagues">) =>
  t.run(async (ctx) => {
    for (let at = 0; at < MANY_EVENTS; at += 1) {
      await ctx.db.insert("leagueEvents", { leagueId, at, by: ADMIN, event: { kind: "maxTeamsChanged", from: 4, to: 5 } });
    }
  });

/** What signIn/account:signedInAs tells the screens for `email`. */
export const accountOf = async (t: TestConvex, email: string) =>
  (await (await actingAs(t, email)).query(api.signIn.account.signedInAs, {}))!;

/** The player, match and gameweek `aRowInEveryTable`'s rows name. */
const A_PLAYER = 1;
const A_FIXTURE = 1;
const A_GAMEWEEK = 1;
/** What `aRowInEveryTable`'s rows say where they need words. */
const WORDS = "Written for a test";

/** Gives a league from `leagueWithPeople`, which already has its teams, events and rules, a row
 *  in each other table keyed to a league: an invite, an invite link and a request to join, and
 *  the rest written straight in. */
export async function aRowInEveryTable(t: TestConvex, leagueId: Id<"leagues">): Promise<void> {
  await invite(t, leagueId, CAT);
  await askToJoin(t, leagueId, await makeLink(t, leagueId), DAN);
  const [{ _id: teamId }] = await teamsIn(t, leagueId);
  await t.run(async (ctx) => {
    const gameweek = A_GAMEWEEK;
    const playerCode = A_PLAYER;
    await ctx.db.insert("passedDeadlines", { leagueId, gameweek, deadline: 0, recordedAt: 0 });
    await ctx.db.insert("keptDeadlines", { leagueId, gameweek, deadline: 0, keptAt: 0 });
    await ctx.db.insert("playedFixtures", { leagueId, gameweek, fixtures: [], byes: [teamId], storedAt: 0 });
    await ctx.db.insert("finalScores", { leagueId, gameweek, teamId, points: 0, noLineup: true, fixtureCodes: [], storedAt: 0 });
    await ctx.db.insert("pointsOverrides", { leagueId, gameweek, fixtureCode: A_FIXTURE, playerCode, points: 0, reason: WORDS, by: ADMIN, at: 0 });
    await ctx.db.insert("lastLeagues", { email: ANN, leagueId });
    await ctx.db.insert("squadPlayers", { leagueId, teamId, playerCode });
    await ctx.db.insert("shortlistPlayers", { leagueId, teamId, playerCode });
    await ctx.db.insert("lineups", { leagueId, teamId, fromGameweek: gameweek, starters: [], bench: [] });
    await ctx.db.insert("teamGameweekStats", { leagueId, gameweek, teamId, fixtureCodes: [A_FIXTURE], stats: { goals_scored: 1 } });
    await ctx.db.insert("teamSeasonStats", { leagueId, teamId, stats: { goals_scored: 1 } });
    await ctx.db.insert("letters", { to: ANN, leagueId, at: 0, subject: WORDS, body: WORDS });
  });
}

/** How many rows the league has in each table keyed to a league. */
export const rowsKeyedTo = (t: TestConvex, leagueId: Id<"leagues">) =>
  t.run(async (ctx) => {
    const counts: Record<string, number> = {};
    for (const table of tablesKeyedToLeague) {
      const rows = await ctx.db.query(table as TableNames).collect();
      counts[table] = rows.filter((row) => (row as { leagueId?: Id<"leagues"> }).leagueId === leagueId).length;
    }
    return counts;
  });
