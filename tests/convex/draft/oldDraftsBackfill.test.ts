import { beforeEach, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { pickRefusals } from "../../../convex/draft/draftPicks";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { ARSENAL, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { draftSteps } from "../../support/convex/draft.harness";
import { addManagers, adminCreatesLeague, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { pickGapPasses } from "../../support/convex/pickWindow.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The one-off migration for #1610: a draft started before 11 Nov 2026 gets what a draft started
// today holds, as the fallbacks it replaces read it, and running it again does nothing.

let t: TestConvex;
let leagueId: Id<"leagues">;

const player = (code: number): HeldPlayer => ({ code, name: `Player ${code}`, fullName: `Player ${code}`, clubCode: ARSENAL.code, positions: ["CM"] });
const MIDS = [101, 102, 103, 104].map(player);
const [A1, A2, A3, A4] = MIDS.map(({ code }) => code);
const [ANN, BOB, CAT] = MANAGERS;

const setSquadRules = (squad: Partial<LeagueRules["squad"]>) =>
  changeEveryRules(t, leagueId, (rules) => ({ ...rules, squad: { size: { minimum: 1, maximum: 2 }, minimumByArea: null, maxPerClub: null, ...squad } }));
const { read, start, pick: pickNow } = draftSteps(() => ({ t, leagueId }));
const pick = async (email: string, playerCode: number) => {
  await pickNow(email, playerCode);
  await pickGapPasses(t);
};
const migrate = () => t.mutation(internal.draft.oldDraftsBackfill.backfillOldDrafts, {});
const draftRow = () => t.run(async (ctx) => (await ctx.db.query("drafts").withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId)).unique())!);
const patchDraft = async (fields: Partial<Doc<"drafts">>) => {
  const { _id } = await draftRow();
  await t.run((ctx) => ctx.db.patch("drafts", _id, fields));
};
const picksHeld = () => t.run((ctx) => ctx.db.query("draftPicks").collect());

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  await addManagers(t, leagueId, [ANN, BOB, CAT]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, MIDS);
  });
  await setSquadRules({});
});

test("a draft started with no squad rules gets the league's in force when it started, and picks under them", async () => {
  await start();
  await setSquadRules({ maxPerClub: 1 });
  const { squad: _squad, ...started } = (await draftRow()).started!;
  await patchDraft({ started });

  expect(await migrate()).toMatchObject({ squads: 1 });
  for (const [email, code] of [[ANN, A1], [BOB, A2], [CAT, A3]] as const) await pick(email, code);
  await expectRefused(pick(CAT, A4), pickRefusals.breaksSquadRules("Player 104"));
});

test("a draft started with no pick time of its own gets the league's latest", async () => {
  await start();
  await patchDraft({ pickSeconds: undefined });

  expect(await migrate()).toMatchObject({ pickTimes: 1 });
  expect((await draftRow()).pickSeconds).toBe(90);
});

test("a live draft with no clock puts its pick on the clock", async () => {
  await start();
  const { clock } = await draftRow();
  await t.run(async (ctx) => {
    if (clock?.job !== undefined) await ctx.scheduler.cancel(clock.job);
  });
  await patchDraft({ clock: undefined });

  expect(await migrate()).toMatchObject({ clocks: 1 });
  expect(await read()).toMatchObject({ status: "live", picksMade: 0, clock: { startsAt: expect.any(Number) } });
});

test("a pick made on a timeout is marked auto, and a pick with no positions gets his positions now", async () => {
  await start();
  await pick(ANN, A1);
  await t.run(async (ctx) => {
    const [made] = await ctx.db.query("draftPicks").collect();
    await ctx.db.patch("draftPicks", made._id, { auto: undefined, positions: undefined, timeout: { putOnAutoPick: false } });
  });

  expect(await migrate()).toMatchObject({ autos: 1, positions: 1 });
  expect(await picksHeld()).toMatchObject([{ playerCode: A1, auto: true, positions: ["CM"] }]);
});

test("running it again does nothing", async () => {
  await start();
  await pick(ANN, A1);

  const nothing = { squads: 0, pickTimes: 0, clocks: 0, autos: 0, positions: 0 };
  expect(await migrate()).toEqual(nothing);
  expect(await migrate()).toEqual(nothing);
});
