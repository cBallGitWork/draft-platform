import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { TradeRules } from "../../../convex/rules/leagueRulesShape";
import { HELD_FIRST_RULES, holdGameweeks, rulesInGameweek, rulesRevision } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { actingAs, adminCreatesLeague, COMMISSIONER, eventsIn, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The trades' League settings (spec/03, spec/08; #383): who reviews an accepted trade, a
// commissioner veto by default, and a trade deadline, off by default (Craig, 6 Nov 2026).

const NEXT = 9;

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
});

const read = async () => (await actingAs(t, COMMISSIONER)).query(api.rules.leagueSettings.settings, { leagueId, now: Date.now() });
const change = async (trades: TradeRules) => {
  const settings = (await read())!.part;
  return (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueSettings.changeSettings, {
    leagueId,
    settings: { ...settings, trades },
    revision: await rulesRevision(t, leagueId),
  });
};
const inGameweek = (gameweek: number) => t.run((ctx) => rulesInGameweek(ctx, leagueId, gameweek));

describe("the trades' settings", () => {
  test("a new league reviews trades by a commissioner veto and has no trade deadline (Craig, 6 Nov 2026)", async () => {
    expect((await read())?.part.trades).toEqual({ review: "veto", deadline: null });
  });

  test("saves a league vote and a trade deadline from the next gameweek, with a letter", async () => {
    await change({ review: "vote", deadline: 30 });

    expect((await inGameweek(NEXT)).trades).toEqual({ review: "vote", deadline: 30 });
    expect((await inGameweek(NEXT - 1)).trades).toEqual({ review: "veto", deadline: null });
    expect((await eventsIn(t, leagueId)).at(-1)).toMatchObject({ kind: "rulesChanged", changed: ["trades"] });
  });

  test.each([0, 39, 30.5])("refuses a trade deadline of gameweek %s, and saves nothing", async (deadline) => {
    await expectRefused(change({ review: "veto", deadline }), `The trade deadline's gameweek must be a whole number from 1 to 38, not ${deadline}.`);
    expect(await inGameweek(NEXT)).toEqual(HELD_FIRST_RULES);
  });

  test("rules saved before trades were a rule read the first rules', and a change to another setting writes none", async () => {
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("leagueRules").collect()) {
        const { trades: _trades, ...older } = row.rules;
        await ctx.db.patch("leagueRules", row._id, { rules: older });
      }
    });
    expect((await read())?.part.trades).toEqual({ review: "veto", deadline: null });

    const settings = (await read())!.part;
    await (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueSettings.changeSettings, {
      leagueId,
      settings: { ...settings, gamesPerGameweek: 2 },
      revision: await rulesRevision(t, leagueId),
    });
    expect((await inGameweek(NEXT)).trades).toBeUndefined();
  });
});
