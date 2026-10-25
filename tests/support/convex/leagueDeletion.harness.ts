// Deleting a league's tests' shared setup (#75).

import { vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { UNDO_MS } from "../../../convex/leagues/leagueDeletion";
import { ADMIN, COMMISSIONER, CO_COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "./leagues.harness";

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
  await laterBy(t, 1);
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

/** The clock moves on by `ms`, and whatever was scheduled by then runs. */
export async function laterBy(t: TestConvex, ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await t.finishInProgressScheduledFunctions();
}

/** What signIn/account:signedInAs tells the screens for `email`. */
export const accountOf = async (t: TestConvex, email: string) =>
  (await (await actingAs(t, email)).query(api.signIn.account.signedInAs, {}))!;
