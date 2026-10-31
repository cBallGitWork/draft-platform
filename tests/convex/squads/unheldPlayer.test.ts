import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { squadRefusals } from "../../../convex/squads/squads";
import { HELD_FIRST_RULES } from "../../support/convex/leagueRules.harness";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { ARSENAL, UNHELD, insertClubs } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { squadMoves } from "../../support/convex/lineupSquad.harness";
import { expectRefused } from "../../support/convex/test.harness";

// A squad row whose player the football sync doesn't hold (#323). Players are never deleted, only
// marked dropped, so it is data gone wrong. The squads page still shows every squad, with his row
// kept, saying his code, so the fault is easy to spot (Craig, 31 Oct 2026: "b but dont hide the
// row, mabe an error message. easier to spot/debug"). Moving or releasing him is refused.

const [ANN, BOB] = MANAGERS;
const SAKA = 1001;
const PALMER = 1002;

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 2);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    for (const [code, name] of [[SAKA, "Saka"], [PALMER, "Palmer"]] as const) {
      await ctx.db.insert("players", { code, name, fullName: name, clubCode: ARSENAL.code });
    }
    await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[0], playerCode: UNHELD });
  });
  const commissioner = await squadMoves(t, leagueId, COMMISSIONER);
  await commissioner.assign(SAKA, teams[0]);
  await commissioner.assign(PALMER, teams[1]);
});

const squads = async () => (await actingAs(t, COMMISSIONER)).query(api.squads.squads.squads, { leagueId });
const squadRows = () => t.run((ctx) => ctx.db.query("squadPlayers").collect());

test("the squads page shows every squad, his team's with his code beside its players", async () => {
  expect((await squads()).map(({ players, unheld }) => [players.map(({ code }) => code), unheld])).toEqual([
    [[SAKA], [UNHELD]],
    [[PALMER], []],
  ]);
});

test("he counts towards his team's squad size", async () => {
  const { minimum } = HELD_FIRST_RULES.squad.size!;
  expect((await squads())[0].warnings).toContainEqual({ kind: "underMinimum", players: 2, minimum });
});

describe("refused, and his row stays", () => {
  test.each([
    ["moving him", (moves: Awaited<ReturnType<typeof squadMoves>>) => moves.move(UNHELD, teams[1])],
    ["releasing him", (moves: Awaited<ReturnType<typeof squadMoves>>) => moves.release(UNHELD)],
  ])("%s", async (_what, change) => {
    const before = await squadRows();
    await expectRefused(change(await squadMoves(t, leagueId, COMMISSIONER)), squadRefusals.noPlayer);
    expect(await squadRows()).toEqual(before);
  });
});
