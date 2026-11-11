import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { REVIEW_MS } from "../../../convex/trades/tradeLimits";
import { refusals } from "../../../convex/shared/leagueAccess";
import { deletes } from "../../support/convex/leagueDeletion.harness";
import { actingAs, COMMISSIONER } from "../../support/convex/leagues.harness";
import { elapse, expectRefused } from "../../support/convex/test.harness";
import { HOUR_MS } from "../../../convex/shared/time";
import { ANN, ANNS_FIRST_DROP, BOB, CAT, RICE, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";

// A trade's review while its league is frozen for deletion (#1493): the clock stops, and after an
// undo the review carries on with the time that was left (Craig, 11 Nov 2026: "The clock stops").

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
});

const undo = async () => (await actingAs(w.t, COMMISSIONER)).mutation(api.leagues.leagueDeletion.undo, { leagueId: w.leagueId });
const reviewOf = async () => (await w.offers())[0]?.review;

describe("a trade in review while its league is frozen (#1493)", () => {
  test("veto: it doesn't go through while frozen, and after an undo the commissioner has the time that was left", async () => {
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.accept(BOB, offerId);
    const acceptedAt = Date.now();
    await elapse(w.t, HOUR_MS);
    await deletes(w.t, COMMISSIONER, w.leagueId);
    await expectRefused(w.block(COMMISSIONER, offerId), refusals.beingDeleted);

    // The review's 24 hours are up while the league is frozen: nothing moves.
    await elapse(w.t, acceptedAt + REVIEW_MS + HOUR_MS / 2 - Date.now());
    expect((await w.offers()).map(({ _id }) => _id)).toEqual([offerId]);
    expect(await w.squadCodes(w.bobsTeam)).toContain(SAKA);

    await undo();
    expect((await reviewOf())?.endsAt).toBe(Date.now() + REVIEW_MS - HOUR_MS);

    // 22 hours on, there's still time to block it, and it is blocked.
    await elapse(w.t, 22 * HOUR_MS);
    await w.block(COMMISSIONER, offerId);
    expect(await w.offers()).toEqual([]);
    expect(await w.squadCodes(w.bobsTeam)).toContain(SAKA);
  });

  test("unblocked, it goes through once the time that was left is up, not before", async () => {
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.accept(BOB, offerId);
    await elapse(w.t, 2 * HOUR_MS);
    await deletes(w.t, COMMISSIONER, w.leagueId);
    await elapse(w.t, 3 * HOUR_MS);
    await undo();

    await elapse(w.t, REVIEW_MS - 2 * HOUR_MS - 1);
    expect(await w.squadCodes(w.bobsTeam)).toContain(SAKA);
    await elapse(w.t, 2);
    expect(await w.offers()).toEqual([]);
    expect(await w.squadCodes(w.annsTeam)).toContain(SAKA);
  });

  test("vote: the votes cast before the freeze still count after the undo", async () => {
    await w.tradesAre({ review: "vote", deadline: null });
    const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.accept(BOB, offerId);
    await w.against(CAT, offerId);
    await elapse(w.t, 2 * HOUR_MS);
    await deletes(w.t, COMMISSIONER, w.leagueId);
    await expectRefused(w.takeBack(CAT, offerId), refusals.beingDeleted);
    // The review's 24 hours are up while the league is frozen.
    await elapse(w.t, REVIEW_MS - HOUR_MS);
    expect((await reviewOf())?.reviewer).toEqual({ kind: "vote", against: [CAT] });

    await undo();
    const endsAt = (await reviewOf())!.endsAt;
    expect(endsAt).toBe(Date.now() + REVIEW_MS - 2 * HOUR_MS);
    // As the scheduler fires it: blocking cancels the job running it, which convex-test refuses.
    vi.setSystemTime(endsAt);
    await w.t.mutation(internal.trades.tradeReview.finish, { offerId });
    expect(await w.offers()).toEqual([]);
    expect(await w.squadCodes(w.bobsTeam)).toContain(SAKA);
    expect(await w.squadCodes(w.catsTeam)).toContain(RICE);
  });
});

describe("an open offer while its league is frozen (#1493)", () => {
  test("one due at a deadline waits, and closes at the first check after an undo", async () => {
    await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    await w.gameweekEnds(5);
    await deletes(w.t, COMMISSIONER, w.leagueId);
    await w.closeDue();
    expect(await w.offers()).toHaveLength(1);

    await undo();
    await w.closeDue();
    expect(await w.offers()).toEqual([]);
  });
});
