import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { draftOrderRefusals } from "../../../convex/draft/draftOrder";
import { refusals } from "../../../convex/shared/leagueAccess";
import { expectRefused } from "../../support/convex/test.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

// The commissioner's draft order (spec/04, Starting it; #1087): it starts as the order the teams
// joined in, he reorders it, and a team that joins later goes to the bottom (Craig, 4 Nov 2026).

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  teams = await addManagers(t, leagueId, MANAGERS.slice(0, 3));
});

const readWhole = async (email = COMMISSIONER) => (await actingAs(t, email)).query(api.draft.draftOrder.teamOrder, { leagueId });
const read = async (email = COMMISSIONER) => (await readWhole(email)).teams;
const order = async () => (await read()).map(({ teamId }) => teamId);
const set = async (teamIds: Id<"teams">[], email = COMMISSIONER) =>
  (await actingAs(t, email)).mutation(api.draft.draftOrder.setTeamOrder, { leagueId, teamIds });

describe("the commissioner's draft order", () => {
  test("starts as the order the teams joined in, with their names", async () => {
    expect(await read()).toEqual([
      { teamId: teams[0], name: teamNumbered(1) },
      { teamId: teams[1], name: teamNumbered(2) },
      { teamId: teams[2], name: teamNumbered(3) },
    ]);
  });

  test("is saved as he orders it", async () => {
    const reordered = [teams[2], teams[0], teams[1]];
    await set(reordered);

    expect(await order()).toEqual(reordered);
  });

  test("puts a team that joins after he ordered it at the bottom", async () => {
    await set([teams[2], teams[0], teams[1]]);
    const [joined] = await addManagers(t, leagueId, [MANAGERS[3]]);

    expect(await order()).toEqual([teams[2], teams[0], teams[1], joined]);
  });

  test("refuses an order missing a team, as one that joined since, and keeps the one saved", async () => {
    await set([teams[1], teams[0], teams[2]]);
    const [joined] = await addManagers(t, leagueId, [MANAGERS[3]]);

    await expectRefused(set([teams[0], teams[1], teams[2]]), draftOrderRefusals.teamsChanged);
    expect(await order()).toEqual([teams[1], teams[0], teams[2], joined]);
  });

  test("refuses an order naming a team twice", async () => {
    await expectRefused(set([teams[0], teams[0], teams[1]]), draftOrderRefusals.teamsChanged);
  });

  test("says whether the draft has started, which fixes it", async () => {
    expect((await readWhole()).started).toBe(false);
    await (await actingAs(t, COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
    expect((await readWhole()).started).toBe(true);
  });

  test("is read and set only by whoever runs the league", async () => {
    await expectRefused(read(MANAGERS[0]), refusals.notRunner);
    await expectRefused(set([teams[2], teams[1], teams[0]], MANAGERS[0]), refusals.notRunner);
    expect(await order()).toEqual(teams);
  });
});

describe("the order drawn at random", () => {
  const draw = async () => (await actingAs(t, COMMISSIONER)).mutation(api.draft.draftOrder.drawTeamOrder, { leagueId });
  /** The order the draft shows, waiting or started (draftStart.ts). */
  const orderOf = async () => (await (await actingAs(t, COMMISSIONER)).query(api.draft.draftStart.ofLeague, { leagueId })).order.map(({ teamId }) => teamId);

  test("holds every team once, stays as drawn, and is the order the draft starts in", async () => {
    await draw();
    const drawn = await orderOf();

    expect([...drawn].sort()).toEqual([...teams].sort());
    expect(await orderOf()).toEqual(drawn);
    await (await actingAs(t, COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
    expect(await orderOf()).toEqual(drawn);
  });

  test("puts a team that joins after the draw at the bottom, and isn't drawn again on its own", async () => {
    await draw();
    const drawn = await orderOf();
    const [joined] = await addManagers(t, leagueId, [MANAGERS[3]]);

    expect(await orderOf()).toEqual([...drawn, joined]);
  });

  test("can be drawn again, or moved by hand, as often as the commissioner likes before the start", async () => {
    await draw();
    await draw();
    await set([teams[1], teams[2], teams[0]]);
    expect(await orderOf()).toEqual([teams[1], teams[2], teams[0]]);
    await draw();
    expect([...(await orderOf())].sort()).toEqual([...teams].sort());
  });
});
