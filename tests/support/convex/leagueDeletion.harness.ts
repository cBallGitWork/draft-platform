// Deleting a league's tests' shared setup (#75).

import { vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { UNDO_MS, tablesKeyedToLeague } from "../../../convex/leagues/leagueDeletion";
import { COMMISSIONER, CO_COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "./leagues.harness";
import { modules } from "./test.harness";

export const [ANN, BOB, CAT, DAN] = MANAGERS;

/** A league with a commissioner who runs no team, a co-commissioner, and ANN and BOB managing. */
export async function leagueWithPeople(t: TestConvex, name?: string): Promise<Id<"leagues">> {
  const leagueId = await adminCreatesLeague(t, 4, name);
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
  await addManagers(t, leagueId, [ANN, BOB]);
  return leagueId;
}

/** `email` deletes the league, and the emails saying so are sent; the deletion itself waits.
 *  When it will be gone. */
export async function deletes(t: TestConvex, email: string, leagueId: Id<"leagues">): Promise<number> {
  const deletesAt = Date.now() + UNDO_MS;
  await (await actingAs(t, email)).mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId });
  await laterBy(t, 1);
  return deletesAt;
}

/** The clock moves on by `ms`, and whatever was scheduled by then runs. */
export async function laterBy(t: TestConvex, ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await t.finishInProgressScheduledFunctions();
}

/** What signIn/account:signedInAs tells the screens for `email`. */
export const accountOf = async (t: TestConvex, email: string) =>
  (await (await actingAs(t, email)).query(api.signIn.account.signedInAs, {}))!;

/** Every public mutation given the id of a league, or of a row keyed to one, as "folder/module:name":
 *  each must be refused while its league is being deleted. Read from the deployed modules, so a
 *  mutation added later is found without anyone listing it. */
export async function mutationsGivenALeague(): Promise<string[]> {
  const keyedTables = new Set(["leagues", ...tablesKeyedToLeague]);
  const names: string[] = [];
  for (const [path, load] of Object.entries(modules)) {
    // Convex deploys only files with one dot in their name, and none of _generated.
    const module = path.match(/^(?:\.\.\/)+convex\/((?!_generated\/)[^.]+)\.ts$/)?.[1];
    if (!module) continue;
    for (const [name, exported] of Object.entries((await load()) as Record<string, unknown>)) {
      const fn = exported as { isMutation?: boolean; isPublic?: boolean; exportArgs?: () => string };
      if (fn?.isMutation && fn.isPublic && givesIdOf(JSON.parse(fn.exportArgs!()), keyedTables)) names.push(`${module}:${name}`);
    }
  }
  return names.sort();
}

/** Whether an argument validator, as Convex exports it, takes an id of one of `tables` anywhere. */
function givesIdOf(validator: unknown, tables: Set<string>): boolean {
  if (typeof validator !== "object" || validator === null) return false;
  const { type, tableName } = validator as { type?: unknown; tableName?: unknown };
  if (type === "id" && typeof tableName === "string" && tables.has(tableName)) return true;
  return Object.values(validator).some((inner) => givesIdOf(inner, tables));
}
