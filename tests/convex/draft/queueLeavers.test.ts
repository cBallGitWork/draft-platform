import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { draftSteps, FIRST_PICK_MS, midfielder } from "../../support/convex/draft.harness";
import { playerLeaves } from "../../support/convex/draftLists.harness";
import { ARSENAL, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { changeEveryRules } from "../../support/convex/leagueRules.harness";
import { addManagers, adminCreatesLeague, ANN, BOB } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// A queued player who leaves the Premier League, sold abroad say (spec/04, The queue and the
// ranking; #2200, S04.21): he stays listed, marked gone so the queue greys him out, and auto-pick
// skips him for the next in the queue.

const SOLD = 101;
const NEXT = 102;

test("a queued player who leaves stays listed, gone, and auto-pick takes the next in the queue (S04.21)", async () => {
  const t = await signInDeployment();
  fakeResend();
  const leagueId = await adminCreatesLeague(t, 5);
  const [annsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, [midfielder(SOLD), midfielder(NEXT), midfielder(103)]);
    await ctx.db.insert("draftLists", { leagueId, teamId: annsTeam, queue: [SOLD, NEXT], doNotDraft: [] });
  });
  await changeEveryRules(t, leagueId, (rules) => ({ ...rules, squad: { size: { minimum: 1, maximum: 1 }, minimumByArea: null, maxPerClub: null } }));
  const { as, start, pass } = draftSteps(() => ({ t, leagueId }));

  await playerLeaves(t, SOLD);
  await start();
  await pass(FIRST_PICK_MS);

  const picked = await t.run(async (ctx) => (await ctx.db.query("draftPicks").collect()).map(({ playerCode }) => playerCode));
  expect(picked).toEqual([NEXT]);
  const queue = (await (await as(ANN)).query(api.draft.draftLists.mine, { leagueId }))?.queue;
  expect(queue?.map(({ code, gone }) => ({ code, gone }))).toEqual([
    { code: SOLD, gone: true },
    { code: NEXT, gone: false },
  ]);
});
