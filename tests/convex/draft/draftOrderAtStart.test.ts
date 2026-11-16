import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DAY_MS } from "../../../convex/shared/time";
import { draftSteps } from "../../support/convex/draft.harness";
import { elapse } from "../../support/convex/test.harness";
import { COMMISSIONER, draftOrderUnset, freshLeague, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";

// An order nobody set (S04.32; Craig, 16 Nov 2026, on #2073; #2439): if the commissioner neither
// puts the teams in order nor presses "Draw at random", the order is drawn at random when the draft
// starts, in place of the order the teams joined. Math.random always 0 moves each team to the front
// in turn, so three teams that joined 1, 2, 3 are drawn 2, 3, 1.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
beforeEach(async () => {
  ({ t, leagueId, teams } = await freshLeague({ managers: MANAGERS.slice(0, 3) }));
  await draftOrderUnset(t, leagueId);
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.mocked(Math.random).mockRestore();
});

const steps = draftSteps(() => ({ t, leagueId }));
const orderOf = async () => (await steps.read()).order.map(({ teamId }) => teamId);
const savedOrder = async () => (await t.run((ctx) => ctx.db.get("leagues", leagueId)))!.draftOrder;

test("S04.32: with no order set or drawn, pressing start draws one at random and saves it as the league's draft order", async () => {
  expect(await orderOf()).toEqual(teams);
  await steps.start();

  const drawn = [teams[1], teams[2], teams[0]];
  expect(await orderOf()).toEqual(drawn);
  expect(await savedOrder()).toEqual(drawn);
});

test("S04.32: with no order set or drawn, a start on the commissioner's date draws one at random too", async () => {
  await (await steps.as(COMMISSIONER)).mutation(api.draft.draftStart.setStart, { leagueId, startsAt: Date.now() + DAY_MS });
  await elapse(t, DAY_MS);

  expect(await orderOf()).toEqual([teams[1], teams[2], teams[0]]);
});

test("S04.32: an order the commissioner set, even the order the teams joined, is kept and not drawn", async () => {
  await (await steps.as(COMMISSIONER)).mutation(api.draft.draftOrder.setTeamOrder, { leagueId, teamIds: teams });
  await steps.start();

  expect(await orderOf()).toEqual(teams);
});
