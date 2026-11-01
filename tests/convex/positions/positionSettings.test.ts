// When positions change (spec/06; #87 story 4): the admin's thresholds, the queue's flagged and
// removed positions, and the gameweek boundary they are judged at.

import { describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { EVERY_LEAGUE, SYNCS_SEARCHED_MOST, thresholdRefusals, type PositionsFor } from "../../../convex/positions/positionSettings";
import { positionsNow } from "../../../convex/positions/playerPositions";
import type { Start } from "../../../convex/positions/positions";
import { DAY_MS } from "../../../convex/shared/time";
import type { Position } from "../../../convex/positions/positionTables";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ADMIN, actingAs } from "../../support/convex/leagues.harness";
import { asAdmin } from "../../support/convex/positionsSync.harness";
import { CENTRE_BACK, movedToFullBack, played, RIGHT_BACK, startsFrom, times } from "../../support/convex/positionStarts.harness";
import { expectRefused, freshConvex, type TestConvex } from "../../support/convex/test.harness";

const BARNES = { code: 1, name: "Barnes", fullName: "Harvey Barnes", clubCode: 4 };
const ALLEN = { code: 2, name: "Allen", fullName: "Rob Allen", clubCode: 4 };
const AARONS = { code: 3, name: "Aarons", fullName: "Max Aarons", clubCode: 4 };
const BURN = { code: 4, name: "Burn", fullName: "Dan Burn", clubCode: 4 };

/** A Premier League player whose starts are `starts`, CB and FB approved unless `set` says more. */
async function holdPlayer(t: TestConvex, player: typeof BARNES, starts: Start[], set: Position[] = []) {
  await t.run(async (ctx) => {
    const clubHeld = await ctx.db.query("clubs").withIndex("by_code", (q) => q.eq("code", player.clubCode)).unique();
    if (clubHeld === null) await ctx.db.insert("clubs", { code: player.clubCode, name: "Newcastle", shortName: "NEW" });
    await ctx.db.insert("players", player);
    await ctx.db.insert("playerPositions", { code: player.code, starts, approved: ["CB", "FB"], set, removed: [] });
  });
}

const queueOf = async (t: TestConvex) => (await asAdmin(t)).query(api.positions.playerPositions.queue, {});
const setThresholds = async (t: TestConvex, flagAfter: number, removeAfter: number) =>
  (await asAdmin(t)).mutation(api.positions.positionSettings.setChangeThresholds, { flagAfter, removeAfter });

describe("the thresholds", () => {
  test("start at spec/06's 3 and 6, and the admin tunes them", async () => {
    const t = freshConvex();
    await holdPlayer(t, BARNES, movedToFullBack(2));
    expect(await queueOf(t)).toMatchObject({ thresholds: { flagAfter: 3, removeAfter: 6 }, flagged: [] });

    await setThresholds(t, 2, 4);

    expect(await queueOf(t)).toMatchObject({ thresholds: { flagAfter: 2, removeAfter: 4 }, flagged: [{ code: BARNES.code, position: "CB", startsElsewhere: 2 }] });
  });

  test("are refused, with why, unless whole, flagging after 1 or more and removing after more than that, up to the 38 starts held", async () => {
    const t = freshConvex();
    for (const [flagAfter, removeAfter, why] of [
      [0, 6, thresholdRefusals.flagAfter],
      [2.5, 6, thresholdRefusals.flagAfter],
      [3, 3, thresholdRefusals.removeAfter],
      [3, 2, thresholdRefusals.removeAfter],
      [3, 6.5, thresholdRefusals.removeAfter],
      [3, 39, thresholdRefusals.pastWindow],
    ] as const) {
      await expectRefused(setThresholds(t, flagAfter, removeAfter), why, `${flagAfter}, ${removeAfter}`);
    }
    await setThresholds(t, 1, 38);
    expect((await queueOf(t)).thresholds).toEqual({ flagAfter: 1, removeAfter: 38 });
  });

  test("setting them leaves how starts count as it was, and the other way round", async () => {
    const t = freshConvex();
    await setThresholds(t, 2, 4);
    expect((await queueOf(t)).approveMode).toBe("proposals");

    await (await asAdmin(t)).mutation(api.positions.positionSettings.setApproveMode, { approveMode: "countAtOnce" });

    expect(await queueOf(t)).toMatchObject({ approveMode: "countAtOnce", thresholds: { flagAfter: 2, removeAfter: 4 } });
  });

  test("are the admin's alone to set", async () => {
    const t = freshConvex();
    vi.stubEnv("ADMIN_EMAIL", ADMIN);
    const someone = await actingAs(t, "someone@example.com");
    const asked = { flagAfter: 2, removeAfter: 4 };
    await expectRefused(someone.mutation(api.positions.positionSettings.setChangeThresholds, asked), refusals.notAdmin);
    await expectRefused(t.mutation(api.positions.positionSettings.setChangeThresholds, asked), refusals.signedOut);
    expect((await queueOf(t)).thresholds).toEqual({ flagAfter: 3, removeAfter: 6 });
  });
});

describe("the queue's position changes", () => {
  test("lists each position flagged, with its starts in a row elsewhere, and each removed, by name", async () => {
    const t = freshConvex();
    await holdPlayer(t, BURN, movedToFullBack(7));
    await holdPlayer(t, BARNES, movedToFullBack(4));
    await holdPlayer(t, ALLEN, movedToFullBack(6));
    await holdPlayer(t, AARONS, movedToFullBack(3));

    const { flagged, removed } = await queueOf(t);

    expect(flagged).toEqual([
      { ...AARONS, position: "CB", startsElsewhere: 3 },
      { ...BARNES, position: "CB", startsElsewhere: 4 },
    ]);
    expect(removed).toEqual([
      { ...ALLEN, position: "CB" },
      { ...BURN, position: "CB" },
    ]);
  });

  test("never a position the admin set, nor a man who has left the Premier League", async () => {
    const t = freshConvex();
    await holdPlayer(t, BARNES, movedToFullBack(6), ["CB"]);
    await holdPlayer(t, ALLEN, movedToFullBack(4));
    await t.run(async (ctx) => {
      const allen = await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", ALLEN.code)).unique();
      await ctx.db.patch("players", allen!._id, { droppedAt: Date.now() });
    });

    expect(await queueOf(t)).toMatchObject({ flagged: [], removed: [] });
  });

  test("a player's positions, and a search's, show the flag", async () => {
    const t = freshConvex();
    await holdPlayer(t, BARNES, movedToFullBack(3));
    const admin = await asAdmin(t);
    const flaggedCentreBack = { position: "CB", source: "starts", confirmed: true, flaggedElsewhere: 3 };

    expect((await admin.query(api.positions.playerPositions.ofPlayer, { code: BARNES.code })).positions).toContainEqual(flaggedCentreBack);
    const [found] = await admin.query(api.positions.playerPositions.find, { text: "Barnes" });
    expect(found.positions).toContainEqual(flaggedCentreBack);
  });
});

describe("only between gameweeks", () => {
  /** A league whose own deadlines passed on `days`, gameweek 1 on the first. */
  const leagueWithDeadlines = (t: TestConvex, ...days: number[]) =>
    t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", { name: `League ${days.join("-")}`, maxTeams: 4, commissionerEmail: "commish@example.com" });
      for (const [index, day] of days.entries()) {
        await ctx.db.insert("passedDeadlines", { leagueId, gameweek: index + 1, deadline: day * DAY_MS, recordedAt: day * DAY_MS });
      }
      return leagueId;
    });
  /** A league whose own deadlines fall on days 10 and 20. */
  const gameweeksAtDays10And20 = (t: TestConvex) => leagueWithDeadlines(t, 10, 20);
  const READ = {
    ok: true as const,
    matchesRead: 1,
    matchesLeft: 0,
    matchesRefused: [],
    startsAdded: 1,
    unmatchedPlayers: 0,
    labelsReceived: 0,
    labelsChanged: 0,
    unknownFormations: [],
    unknownLabels: [],
  };
  const positionsSyncRanOnDay = (t: TestConvex, day: number, outcome: Doc<"positionsSyncs">["outcome"] = READ) =>
    t.run((ctx) => ctx.db.insert("positionsSyncs", { trigger: "manual", ranAt: day * DAY_MS, outcome }));

  /** Five at centre back to day 5, four at full back to day 9, then two more on days 11 and 12. */
  const acrossTheDeadline = () => [...played(...times(CENTRE_BACK, 5), ...times(RIGHT_BACK, 4)), ...startsFrom(11, ...times(RIGHT_BACK, 2))];

  test("a change is judged on the starts before the last deadline the newest positions sync ran after", async () => {
    const t = freshConvex();
    await holdPlayer(t, BARNES, acrossTheDeadline());
    await gameweeksAtDays10And20(t);

    await positionsSyncRanOnDay(t, 13);
    expect(await queueOf(t)).toMatchObject({ flagged: [{ position: "CB", startsElsewhere: 4 }], removed: [] });

    await positionsSyncRanOnDay(t, 21);
    expect(await queueOf(t)).toMatchObject({ flagged: [], removed: [{ position: "CB" }] });
  });

  test("a sync that failed read nothing, so it moves no boundary", async () => {
    const t = freshConvex();
    await holdPlayer(t, BARNES, acrossTheDeadline());
    await gameweeksAtDays10And20(t);
    await positionsSyncRanOnDay(t, 13);

    await positionsSyncRanOnDay(t, 21, { ok: false, error: "the feed was down" });

    expect(await queueOf(t)).toMatchObject({ flagged: [{ position: "CB", startsElsewhere: 4 }], removed: [] });
  });

  /** `count` failed syncs, each a minute later than the last, from day 22. */
  const failedSyncs = (t: TestConvex, count: number) =>
    t.run(async (ctx) => {
      for (let index = 0; index < count; index += 1) {
        await ctx.db.insert("positionsSyncs", { trigger: "manual", ranAt: 22 * DAY_MS + index, outcome: { ok: false, error: "the feed was down" } });
      }
    });

  test(`a good sync behind ${SYNCS_SEARCHED_MOST - 1} failed ones still moves the boundary; behind ${SYNCS_SEARCHED_MOST} the queue fails loudly`, async () => {
    const t = freshConvex();
    await holdPlayer(t, BARNES, acrossTheDeadline());
    await gameweeksAtDays10And20(t);
    await positionsSyncRanOnDay(t, 21);

    await failedSyncs(t, SYNCS_SEARCHED_MOST - 1);
    expect(await queueOf(t)).toMatchObject({ removed: [{ position: "CB" }] });

    await failedSyncs(t, 1);
    await expect(queueOf(t)).rejects.toThrow(`None of the newest ${SYNCS_SEARCHED_MOST} positions syncs read its starts`);
  });

  test("before any sync, or before the season's first deadline, every start is judged", async () => {
    const t = freshConvex();
    await holdPlayer(t, BARNES, acrossTheDeadline());
    await gameweeksAtDays10And20(t);
    expect((await queueOf(t)).removed).toEqual([{ ...BARNES, position: "CB" }]);

    await positionsSyncRanOnDay(t, 9);

    expect((await queueOf(t)).removed).toEqual([{ ...BARNES, position: "CB" }]);
  });

  test(`with only failed syncs, fewer than ${SYNCS_SEARCHED_MOST}, every start is judged as before any sync`, async () => {
    const t = freshConvex();
    await holdPlayer(t, BARNES, acrossTheDeadline());
    await gameweeksAtDays10And20(t);

    await failedSyncs(t, 3);

    expect((await queueOf(t)).removed).toEqual([{ ...BARNES, position: "CB" }]);
  });

  test("each league judges at its own deadline, never FPL's: a player's positions differ between leagues until both have passed theirs (#895)", async () => {
    const t = freshConvex();
    await holdPlayer(t, BARNES, acrossTheDeadline());
    await t.run((ctx) => ctx.db.insert("gameweeks", { number: 1, deadline: 30 * DAY_MS }));
    const early = await leagueWithDeadlines(t, 10);
    const late = await leagueWithDeadlines(t, 5, 13);
    const positionsIn = (league: PositionsFor) => t.run(async (ctx) => (await positionsNow(ctx, league))(BARNES.code));

    await positionsSyncRanOnDay(t, 12);
    expect(await positionsIn(early)).toEqual(["CB", "FB"]);
    expect(await positionsIn(late)).toEqual(["CB", "FB"]);
    expect(await queueOf(t)).toMatchObject({ flagged: [{ position: "CB", startsElsewhere: 4 }], removed: [] });

    await positionsSyncRanOnDay(t, 14);
    expect(await positionsIn(early)).toEqual(["CB", "FB"]);
    expect(await positionsIn(late)).toEqual(["FB"]);
    expect(await positionsIn(EVERY_LEAGUE)).toEqual(["FB"]);
    expect(await queueOf(t)).toMatchObject({ removed: [{ position: "CB" }] });
  });
});
