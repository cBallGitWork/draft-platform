import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { LeagueSettings } from "../../../convex/rules/leagueSettingsPart";
import { refusals } from "../../../convex/shared/leagueAccess";
import { changeEveryRules, HELD_FIRST_RULES, rulesInGameweek, rulesRevision } from "../../support/convex/leagueRules.harness";
import { actingAs, COMMISSIONER, eventsIn } from "../../support/convex/leagues.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { ANN, BOB, NEXT, SAKA, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";

// League settings' Waivers tab (#1200; spec/03, spec/08): the waiver order's type and the runs,
// saved as the rest of the settings are; a change of type applies at once, from today's order
// (Craig, 6 Nov 2026: "At once, from today's order"), so nobody jumps the queue by the switch. And
// the waiver order everyone sees (Craig: "Everyone sees the whole order").

let w: WaiverLeague;
beforeEach(async () => {
  w = await waiverLeague();
});

const settingsNow = async () => {
  const view = await (await actingAs(w.t, COMMISSIONER)).query(api.rules.leagueSettings.settings, { leagueId: w.leagueId, now: Date.now() });
  if (view === null) throw new Error("The test league has no rules");
  return view.part;
};
const changeWaivers = async (waivers: LeagueSettings["waivers"], email = COMMISSIONER) =>
  (await actingAs(w.t, email)).mutation(api.rules.leagueSettings.changeSettings, {
    leagueId: w.leagueId,
    settings: { ...(await settingsNow()), waivers },
    revision: await rulesRevision(w.t, w.leagueId),
  });
const latestWaivers = () => w.t.run(async (ctx) => (await rulesInGameweek(ctx, w.leagueId, 99)).waivers);
const order = async (email = BOB) =>
  (await (await actingAs(w.t, email)).query(api.waivers.waiverOrder.ofLeague, { leagueId: w.leagueId, now: Date.now() }))?.teams.map(({ teamId }) => teamId);

describe("League settings' waivers", () => {
  test("a new league runs them Wednesday and Thursday at 18:00, in reverse table order (spec/08)", async () => {
    expect((await settingsNow()).waivers).toEqual(HELD_FIRST_RULES.waivers);
  });

  test("saves the order type and the runs, with a letter", async () => {
    const waivers: LeagueSettings["waivers"] = { runs: [{ day: "tuesday", hour: 9, minute: 30 }], order: "rotating" };
    await changeWaivers(waivers);

    expect(await latestWaivers()).toEqual(waivers);
    expect((await eventsIn(w.t, w.leagueId)).at(-1)).toMatchObject({ kind: "rulesChanged", changed: ["waivers"] });
  });

  test.each([
    ["no run", [], "Waivers need a time to run, once a week or more."],
    [
      "one time twice",
      [
        { day: "friday", hour: 12, minute: 0 },
        { day: "friday", hour: 12, minute: 0 },
      ],
      "Waivers run on friday at 12:00 twice.",
    ],
  ] as const)("refuses %s with the reason, and saves nothing", async (_, runs, reason) => {
    await expectRefused(changeWaivers({ ...HELD_FIRST_RULES.waivers, runs: [...runs] }), reason);
    expect(await latestWaivers()).toEqual(HELD_FIRST_RULES.waivers);
  });

  test("are refused to a manager", async () => {
    await expectRefused(changeWaivers({ ...HELD_FIRST_RULES.waivers, order: "rotating" }, ANN), refusals.notRunner);
  });
});

describe("the waiver order", () => {
  test("everyone in the league sees it whole, with each team's table place, the next runs and the window", async () => {
    const view = await (await actingAs(w.t, ANN)).query(api.waivers.waiverOrder.ofLeague, { leagueId: w.leagueId, now: Date.now() });

    // Level on 0 points, the reverse of the draft order: Ann, Bob and Cat drafted first, so go last.
    expect(view?.teams.map(({ teamId }) => teamId)).toEqual(w.teams.toReversed());
    expect(view?.teams.map(({ tablePlace }) => tablePlace)).toEqual(w.teams.map((_, place) => w.teams.length - place));
    expect(view).toMatchObject({ type: "reverseStandings", drafted: true, locked: false, nextDeadline: { gameweek: NEXT } });
    expect(view?.teams.filter(({ yours }) => yours).map(({ teamId }) => teamId)).toEqual([w.annsTeam]);
    expect(view?.runs).toHaveLength(2);
    expect(view?.runs[0]).toBeLessThan(view!.runs[1]);
  });

  test("a change of type applies at once, from today's order, and under reverse table order the table orders it again once a gameweek begins", async () => {
    await changeEveryRules(w.t, w.leagueId, (rules) => ({ ...rules, waivers: { ...rules.waivers, order: "rotating" } }));
    await w.onWaivers([SAKA]);
    await w.claim(BOB, SAKA);
    await w.runWaivers();
    // Rotating: Bob won, so went to the bottom, and stays there as gameweeks go by.
    const bobLast = [...w.teams.toReversed().filter((team) => team !== w.bobsTeam), w.bobsTeam];
    await w.gameweekEnds(NEXT);
    expect(await order()).toEqual(bobLast);

    await changeWaivers({ ...HELD_FIRST_RULES.waivers, order: "reverseStandings" });
    // Reverse table order would put Bob back above Ann, as a gameweek has begun since he won.
    expect(await order()).toEqual(bobLast);

    await w.gameweekEnds(NEXT + 1);
    expect(await order()).toEqual(w.teams.toReversed());
  });
});
