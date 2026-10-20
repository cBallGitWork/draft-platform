// Deleting a league's tests' shared setup (#75). For the tests only: the second dot keeps it out
// of Convex's deploy.

import { vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { UNDO_MS } from "./leagueDeletion";
import { COMMISSIONER, CO_COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "./leagues.harness";

export const [ANN, BOB] = MANAGERS;

/** A league with a commissioner who runs no team, a co-commissioner, and ANN and BOB managing. */
export async function leagueWithPeople(t: TestConvex, name?: string): Promise<Id<"leagues">> {
  const leagueId = await adminCreatesLeague(t, 4, name);
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
  await addManagers(t, leagueId, [ANN, BOB]);
  return leagueId;
}

/** `email` deletes the league, and the emails saying so are sent; the deletion itself waits.
 *  When it will be gone. */
export async function deletes(t: TestConvex, email: string, leagueId: Id<"leagues">): Promise<number> {
  const deletesAt = Date.now() + UNDO_MS;
  await (await actingAs(t, email)).mutation(api.leagueDeletion.deleteLeague, { leagueId });
  await laterBy(t, 1);
  return deletesAt;
}

/** The clock moves on by `ms`, and whatever was scheduled by then runs. */
export async function laterBy(t: TestConvex, ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await t.finishInProgressScheduledFunctions();
}

/** What account:signedInAs tells the screens for `email`. */
export const accountOf = async (t: TestConvex, email: string) =>
  (await (await actingAs(t, email)).query(api.account.signedInAs, {}))!;
