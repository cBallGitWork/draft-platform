import { beforeEach, describe, expect, test } from "vitest";
import { REVIEW_MS } from "../../../convex/trades/tradeLimits";
import { draftStarted } from "../../support/convex/draft.harness";
import { addManager, COMMISSIONER, MANAGERS } from "../../support/convex/leagues.harness";
import { nameOf } from "../../support/convex/lineupSquad.harness";
import { ANN, ANNS_FIRST_DROP, BOB, CAT, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";
import { noDraft } from "../../support/convex/waivers.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

// The Offers tab's To review group (#383; Craig, 10 Nov 2026; S08.2, S08.4): the trades in review the caller
// reviews, what he may do to each, and only his own vote, never the count.

const DAN = MANAGERS[3];

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
});

const annTradesForSaka = () => w.annTradesForSaka("Fancy it?");

describe("under a commissioner veto", () => {
  test("the commissioner, with no team of his own, sees the trade to Block, both sides and when the review ends", async () => {
    const offerId = await annTradesForSaka();

    expect(await w.toReview(COMMISSIONER)).toEqual([
      expect.objectContaining({
        offerId,
        fromTeamName: teamNumbered(1),
        toTeamName: teamNumbered(2),
        gives: [expect.objectContaining({ code: ANNS_FIRST_DROP, name: nameOf(ANNS_FIRST_DROP) })],
        gets: [expect.objectContaining({ code: SAKA })],
        picks: null,
        note: "Fancy it?",
        reviewEndsAt: Date.now() + REVIEW_MS,
        yours: "block",
      }),
    ]);
  });

  test("nobody else reviews it, the two in it included", async () => {
    await annTradesForSaka();
    for (const email of [ANN, BOB, CAT]) expect(await w.toReview(email)).toEqual([]);
  });

  test("an open offer isn't in review", async () => {
    await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
    expect(await w.toReview(COMMISSIONER)).toEqual([]);
  });
});

describe("under a league vote", () => {
  beforeEach(async () => {
    await w.tradesAre({ review: "vote", deadline: null });
    await noDraft(w.t, w.leagueId);
    await addManager(w.t, w.leagueId, DAN);
    await draftStarted(w.t, w.leagueId, w.teams);
  });

  test("each voter sees Against, then Take back once he has voted, and never anyone else's vote", async () => {
    const offerId = await annTradesForSaka();
    expect((await w.toReview(CAT)).map(({ yours }) => yours)).toEqual(["against"]);

    await w.against(CAT, offerId);
    expect((await w.toReview(CAT)).map(({ yours }) => yours)).toEqual(["takeBack"]);
    expect((await w.toReview(DAN)).map(({ yours }) => yours)).toEqual(["against"]);
    expect(await w.toReview(COMMISSIONER)).toEqual([]);
    expect(await w.toReview(ANN)).toEqual([]);
  });
});
