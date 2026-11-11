import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { LeagueSettings } from "../../../convex/rules/leagueSettingsPart";
import { refusals } from "../../../convex/shared/leagueAccess";
import { HOUR_MS } from "../../../convex/shared/time";
import { changeEveryRules, HELD_FIRST_RULES, rulesInGameweek, rulesRevision } from "../../support/convex/leagueRules.harness";
import { actingAs, COMMISSIONER, eventsIn } from "../../support/convex/leagues.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { passNextDeadline } from "../../support/convex/lineupSquad.harness";
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
    expect(view).toMatchObject({ type: "reverseStandings", drafted: true, locked: false, windowShuts: { gameweek: NEXT } });
    expect(view?.teams.filter(({ yours }) => yours).map(({ teamId }) => teamId)).toEqual([w.annsTeam]);
    expect(view?.runs).toHaveLength(2);
    expect(view?.runs[0].at).toBeLessThan(view!.runs[1].at);
    // Wednesday's and Thursday's, both before NEXT's deadline on Monday, while the gameweek before is over.
    expect(view?.runs.map(({ skippedIf }) => skippedIf)).toEqual([null, null]);
  });

  test("with the next deadline before both runs, each may be skipped, and the window lasts to the deadline after (#1488)", async () => {
    const ofLeague = async (now: number) => (await actingAs(w.t, ANN)).query(api.waivers.waiverOrder.ofLeague, { leagueId: w.leagueId, now });
    const nextDeadline = (await ofLeague(Date.now())).windowShuts!.at;

    // An hour before NEXT's deadline: the coming Wednesday's and Thursday's runs fall after it.
    const before = await ofLeague(nextDeadline - HOUR_MS);
    expect(before.runs.map(({ skippedIf }) => skippedIf)).toEqual([NEXT, NEXT]);
    expect(before.runs[0].at).toBeGreaterThan(nextDeadline);
    expect(before).toMatchObject({ locked: false, windowOpen: false, windowShuts: { gameweek: NEXT + 1 } });

    // In its lock they still may be; once its last match is over, they are made.
    const inLock = await ofLeague(nextDeadline + HOUR_MS);
    expect(inLock).toMatchObject({ locked: true, windowShuts: { gameweek: NEXT + 1 } });
    expect(inLock.runs.map(({ skippedIf }) => skippedIf)).toEqual([NEXT, NEXT]);
    await w.matchIs(NEXT, "fullTime");
    expect((await ofLeague(nextDeadline + HOUR_MS)).runs.map(({ skippedIf }) => skippedIf)).toEqual([null, null]);
  });

  test("from the deadline until the gameweek's last match is over, a winner stays at the bottom and the table is the one the last gameweek ended on (#1480)", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(BOB, SAKA);
    await w.runWaivers();
    const bobLast = [...w.teams.toReversed().filter((team) => team !== w.bobsTeam), w.bobsTeam];
    expect(await order()).toEqual(bobLast);

    // Gameweek NEXT begins with Cat bottom of it so far: neither the scores nor the deadline move
    // the order while it is under way.
    await passNextDeadline(w.t);
    await w.t.run(async (ctx) => {
      for (const teamId of w.teams) {
        const points = teamId === w.catsTeam ? 10 : 50;
        await ctx.db.insert("finalScores", { leagueId: w.leagueId, gameweek: NEXT, teamId, points, fixtureCodes: [NEXT], storedAt: Date.now() });
      }
    });
    const view = await (await actingAs(w.t, BOB)).query(api.waivers.waiverOrder.ofLeague, { leagueId: w.leagueId, now: Date.now() });
    expect(view?.locked).toBe(true);
    expect(view?.resetsAfter).toBe(NEXT);
    expect(view?.teams.map(({ teamId }) => teamId)).toEqual(bobLast);
    expect(view?.teams.every(({ points }) => points === 0)).toBe(true);

    // Its last match over, the order is worked out again from the table it ended on: Cat first.
    await w.matchIs(NEXT, "fullTime");
    expect(await order()).toEqual([w.catsTeam, ...w.teams.toReversed().filter((team) => team !== w.catsTeam)]);
  });

  test("a change of type applies at once, from today's order, and under reverse table order the table orders it again once a gameweek ends", async () => {
    await changeEveryRules(w.t, w.leagueId, (rules) => ({ ...rules, waivers: { ...rules.waivers, order: "rotating" } }));
    await w.onWaivers([SAKA]);
    await w.claim(BOB, SAKA);
    await w.runWaivers();
    // Rotating: Bob won, so went to the bottom, and stays there as gameweeks go by.
    const bobLast = [...w.teams.toReversed().filter((team) => team !== w.bobsTeam), w.bobsTeam];
    await w.gameweekEnds(NEXT);
    expect(await order()).toEqual(bobLast);

    await changeWaivers({ ...HELD_FIRST_RULES.waivers, order: "reverseStandings" });
    // Reverse table order would put Bob back above Ann, as a gameweek has ended since he won.
    expect(await order()).toEqual(bobLast);

    await w.gameweekEnds(NEXT + 1);
    expect(await order()).toEqual(w.teams.toReversed());
  });
});
