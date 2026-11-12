import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { CLOSED_READ_MOST } from "../../../convex/trades/closedOffers";
import { MINUTE_MS, seasonStartAt } from "../../../convex/shared/time";
import { actingAs, COMMISSIONER, ANN, BOB, CAT } from "../../support/convex/leagues.harness";
import { nameOf } from "../../support/convex/lineupSquad.harness";
import { ANNS_FIRST_DROP, PALMER, RICE, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";
import { silenceConsoleWarn } from "../../support/convex/test.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

// The Trades screen's Closed offers (#383; docs/design/approved/trades): each offer that ended this
// season without going through, rejected, countered, withdrawn, closed, blocked or unmade, kept with
// why and shown to both its teams, newest first. A trade that goes through isn't one.

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
});

const closedFor = async (email: string) =>
  (await (await actingAs(w.t, email)).query(api.trades.tradeScreen.ofMyTeam, { leagueId: w.leagueId, now: Date.now() })).closed;

/** A minute on, so each close has its own moment. */
const aMinuteOn = () => vi.setSystemTime(Date.now() + MINUTE_MS);

describe("closed offers", () => {
  test("keeps a rejected, a countered and a withdrawn offer, newest first, for both teams", async () => {
    const rejected = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.reject(BOB, rejected.offerId);
    aMinuteOn();
    const countered = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [PALMER]);
    const counter = await w.counter(BOB, countered.offerId, [SAKA], [ANNS_FIRST_DROP]);
    aMinuteOn();
    await w.withdraw(BOB, counter.offerId);

    const closed = await closedFor(ANN);
    expect(closed.map(({ why }) => why)).toEqual(["withdrawn", "countered", "rejected"]);
    expect(closed[2]).toMatchObject({
      fromTeamId: w.annsTeam,
      fromTeamName: teamNumbered(1),
      toTeamId: w.bobsTeam,
      toTeamName: teamNumbered(2),
      gives: [expect.objectContaining({ code: ANNS_FIRST_DROP })],
      gets: [expect.objectContaining({ code: SAKA })],
      picks: null,
      closedAt: expect.any(Number),
    });
    expect(closed[0]).toMatchObject({ fromTeamId: w.bobsTeam, gives: [expect.objectContaining({ code: SAKA })] });
    expect(await closedFor(BOB)).toEqual(closed);
    expect(await closedFor(CAT)).toEqual([]);
  });

  test("keeps one the platform closes, with why", async () => {
    await w.offer(CAT, w.bobsTeam, [RICE], [SAKA]);
    const other = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.tradesAre({ review: "none", deadline: null });
    await w.accept(BOB, other.offerId);

    expect(await closedFor(CAT)).toEqual([expect.objectContaining({ why: "playerLeft", fromTeamId: w.catsTeam })]);
  });

  test("keeps one a drop closes, its letter filed after the drop's (dropAndTell, #1573)", async () => {
    await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    const before = (await w.subjectsTo(BOB)).length;
    await w.drop(ANN, ANNS_FIRST_DROP);

    expect(await closedFor(BOB)).toEqual([expect.objectContaining({ why: "playerLeft", fromTeamId: w.annsTeam })]);
    const filed = (await w.subjectsTo(BOB)).slice(before);
    expect(filed).toHaveLength(2);
    expect(filed[0]).toBe(`Team 1 dropped ${nameOf(ANNS_FIRST_DROP)}`);
  });

  test("keeps a trade blocked in review, but not one that goes through", async () => {
    const blocked = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.accept(BOB, blocked.offerId);
    await w.block(COMMISSIONER, blocked.offerId);
    expect((await closedFor(ANN)).map(({ why }) => why)).toEqual(["blocked"]);

    const made = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.accept(BOB, made.offerId);
    await w.reviewEnds(made.offerId);
    expect((await closedFor(ANN)).map(({ why }) => why)).toEqual(["blocked"]);
  });

  test("shows only this season's, at most the read's most, and logs the ones left out", async () => {
    const warn = silenceConsoleWarn();
    await w.t.run(async (ctx) => {
      const kept = { leagueId: w.leagueId, fromTeamId: w.annsTeam, toTeamId: w.bobsTeam, gives: [], gets: [SAKA], by: ANN, madeAt: 0, why: "rejected" as const };
      await ctx.db.insert("closedTradeOffers", { ...kept, closedAt: seasonStartAt(Date.now()) - 1 });
      for (let each = 0; each <= CLOSED_READ_MOST; each++) {
        await ctx.db.insert("closedTradeOffers", { ...kept, closedAt: Date.now() - each });
      }
    });
    const closed = await closedFor(ANN);
    expect(closed).toHaveLength(CLOSED_READ_MOST);
    expect(closed.every(({ closedAt }) => closedAt >= seasonStartAt(Date.now()))).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`over ${CLOSED_READ_MOST} closed trade offers`));
  });
});
