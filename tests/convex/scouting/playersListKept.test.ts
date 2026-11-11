import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Position } from "../../../convex/positions/positionTables";
import { MANAGERS, actingAs, addManagers, adminCreatesLeague, teamName, type TestConvex } from "../../support/convex/leagues.harness";
import { ARSENAL, CHELSEA, GONE, SAKA, insertClubs, insertDroppedPlayer, insertPlayers } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// Scouting's players list keeps the selected player (#1551): asked with his code, it returns his
// row whatever club is chosen, so his panel follows a pickup, a claim or a drop that takes him out
// of the list. Who holds him and his position are filtered in the browser (#1552), so only the
// club leaves him out here. The list itself is tests/convex/scouting/playersList.test.ts's.

const [ANN] = MANAGERS;
const RICE = { code: 1002, name: "Rice", fullName: "Declan Rice", clubCode: ARSENAL.code, positions: ["CDM", "CM"] as Position[] };
const PALMER = { code: 1004, name: "Palmer", fullName: "Cole Palmer", clubCode: CHELSEA.code, positions: ["CAM"] as Position[] };

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
// Saka is Ann's; Rice and Palmer are free agents.
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
  teams = await addManagers(t, leagueId, [ANN]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, [SAKA, RICE, PALMER]);
    await insertDroppedPlayer(ctx, GONE, Date.now());
    await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[0], playerCode: SAKA.code });
  });
});

/** The list as Ann reads it for one club (null for every club), keeping the player with `keep` when given. */
const listAs = async (clubCode: number | null, keep?: number) =>
  (await actingAs(t, ANN)).query(api.scouting.playersList.list, { leagueId, clubCode, stat: null, keep });
const rowIn = async (code: number) => (await listAs(null)).players.find((player) => player.code === code);

test("none is asked: there is no kept row", async () => {
  expect((await listAs(null)).kept).toBeUndefined();
});

test("one at the chosen club is his row in the list", async () => {
  const { players, kept } = await listAs(ARSENAL.code, RICE.code);
  expect(kept).toEqual(players.find((player) => player.code === RICE.code));
});

test("one picked up comes back with his new owner", async () => {
  await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: teams[0], playerCode: RICE.code }));
  const { kept } = await listAs(ARSENAL.code, RICE.code);
  expect(kept?.ownerTeamName).toBe(await teamName(t, teams[0]));
});

test("one at a club the filter leaves out is read on his own, his row as the list would have it", async () => {
  const { players, kept } = await listAs(ARSENAL.code, PALMER.code);
  expect(players.map((player) => player.name).sort()).toEqual(["Rice", "Saka"]);
  expect(kept).toEqual(await rowIn(PALMER.code));
});

test("one who has left the Premier League is null", async () => {
  expect((await listAs(null, GONE.code)).kept).toBeNull();
  expect((await listAs(ARSENAL.code, GONE.code)).kept).toBeNull();
});
