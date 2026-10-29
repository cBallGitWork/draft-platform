import { beforeEach, describe, expect, test } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { managerOf, refusals } from "../../../convex/shared/leagueAccess";
import { ADMIN, COMMISSIONER, MANAGERS, actingAs, addManager, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// managerOf: the caller's own team in a league, which My team's pages, the lineup and leaving
// read, and the refusals in the order they come.

const [ANN] = MANAGERS;

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
});

/** A league id that names no league: one made and then removed. */
const goneLeague = () =>
  t.run(async (ctx) => {
    const { _id, _creationTime, ...fields } = (await ctx.db.get("leagues", leagueId))!;
    const id = await ctx.db.insert("leagues", fields);
    await ctx.db.delete("leagues", id);
    return id;
  });

/** What managerOf answers `email` (or someone signed out, for null) in `league`, or its refusal. */
async function managerOfAs(email: string | null, league: Id<"leagues">) {
  const caller = email === null ? t : await actingAs(t, email);
  return caller.run((ctx) => managerOf(ctx, league));
}

describe("managerOf", () => {
  test("someone signed out is told to sign in, before whether the league exists", async () => {
    await expectRefused(managerOfAs(null, await goneLeague()), refusals.signedOut);
  });

  test("a league that doesn't exist is refused, before whether the caller runs a team", async () => {
    await expectRefused(managerOfAs(ANN, await goneLeague()), refusals.noLeague);
  });

  test.each([
    ["someone with no part in the league", "outsider@example.com"],
    ["its commissioner, running no team", COMMISSIONER],
    ["the admin", ADMIN],
  ])("%s is told they run no team there", async (_who, email) => {
    await expectRefused(managerOfAs(email, leagueId), refusals.runsNoTeam);
  });

  test("a manager gets their email, the league and their own team", async () => {
    const teamId = await addManager(t, leagueId, ANN);
    const { email, league, team } = await managerOfAs(ANN, leagueId);
    expect({ email, leagueId: league._id, teamId: team._id }).toEqual({ email: ANN, leagueId, teamId });
  });
});
