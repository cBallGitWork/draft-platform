import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import type { TableNames } from "../../../convex/_generated/dataModel";
import { mailRefusals } from "../../../convex/mail/mail";
import schema from "../../../convex/schema";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ANN, deletes, leagueWithPeople } from "../../support/convex/leagueDeletion.harness";
import { changesTo, mutationsGivenALeague, rowsToChange, type Caller } from "../../support/convex/leagueMutations.harness";
import { COMMISSIONER, actingAs, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// Every public mutation given a league refuses a signed-out caller and a signed-in outsider, and
// changes nothing (#141; spec/13, Who runs it). Queries are left out: what an outsider may read
// is Craig's call.

/** Someone signed in with no part in either league. */
const OUTSIDER = "outsider@example.com";

/** The public mutations given a league that the sweeps leave out, each with why it may be. None
 *  yet: one goes here only with the reason an outsider may call it. */
const notSwept: Record<string, string> = {};

/** What an outsider is told: that the change is someone else's to make. */
const KEEPS_OUT: string[] = [
  refusals.notAdmin,
  refusals.notRunner,
  refusals.notNamer,
  refusals.notDeleter,
  refusals.notUndoer,
  refusals.notManager,
  refusals.runsNoTeam,
  refusals.notInLeague,
  mailRefusals.noLetter,
];

let t: TestConvex;
let calls: (caller: Caller) => Record<string, () => Promise<unknown>>;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  const leagueId = await leagueWithPeople(t);
  const rows = await rowsToChange(t, leagueId);

  // Opening a letter needs one to ANN, and undoing a deletion a league being deleted: deleted
  // last, as running every timer would delete it for good.
  await (await actingAs(t, COMMISSIONER)).mutation(api.mail.mail.writeToLeague, { leagueId, subject: "Welcome", body: "Season starts soon." });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const annsLetter = await t.run((ctx) => ctx.db.query("letters").withIndex("by_to_and_at", (q) => q.eq("to", ANN)).first());
  if (!annsLetter) throw new Error(`writing to the league filed no letter to ${ANN}`);
  const beingDeleted = await leagueWithPeople(t, "A league being deleted");
  await deletes(t, COMMISSIONER, beingDeleted);

  calls = (caller) => ({
    ...changesTo({ admin: caller, ann: caller, commissioner: caller }, rows),
    "leagues/leagueDeletion:undo": () => caller.mutation(api.leagues.leagueDeletion.undo, { leagueId: beingDeleted }),
    "mail/mail:open": () => caller.mutation(api.mail.mail.open, { letterId: annsLetter._id }),
  });
});

const everyRow = () =>
  t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as TableNames[]) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });

/** What each call is refused with, by its mutation's name; null where it was let in. */
async function refusalsOf(caller: Caller): Promise<Record<string, string | null>> {
  const told: Record<string, string | null> = {};
  for (const [name, call] of Object.entries(calls(caller))) {
    try {
      await call();
      told[name] = null;
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      told[name] = error.data as string;
    }
  }
  return told;
}

describe("a mutation given a league", () => {
  test("refuses anyone signed out, saying sign in, and nothing changes", async () => {
    const before = await everyRow();
    const told = await refusalsOf(t);

    expect(Object.entries(told).filter(([, refusal]) => refusal !== refusals.signedOut)).toEqual([]);
    expect(await everyRow()).toEqual(before);
  });

  test("refuses someone signed in with no part in the league, saying it isn't theirs, and nothing changes", async () => {
    const outsider = await actingAs(t, OUTSIDER);
    const before = await everyRow();
    const told = await refusalsOf(outsider);

    expect(Object.entries(told).filter(([, refusal]) => refusal === null || !KEEPS_OUT.includes(refusal))).toEqual([]);
    expect(await everyRow()).toEqual(before);
  });

  test("every one is swept: a mutation added later fails here until it is tried or named in notSwept", async () => {
    const swept = Object.keys(calls(t)).sort();
    expect(swept).toEqual((await mutationsGivenALeague()).filter((name) => !(name in notSwept)));
  });
});
