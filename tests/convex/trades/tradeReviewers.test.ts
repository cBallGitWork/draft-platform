import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { REVIEW_MS } from "../../../convex/trades/tradeLimits";
import { reviewRefusals } from "../../../convex/trades/tradeReview";
import { draftStarted } from "../../support/convex/draft.harness";
import { actingAs, addManager, COMMISSIONER, CO_COMMISSIONER, ANN, BOB, CAT, TEAM_1, TEAM_2 } from "../../support/convex/leagues.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";
import { noDraft } from "../../support/convex/waivers.harness";

// A trade in review under a commissioner veto follows the role, not the person (#1472; Craig,
// 11 Nov 2026; S08.12): when the commissioner or co-commissioner changes, whoever reviews it now gets the
// review letter, sees it in To review and may Block it; the one who left may not; the 24 hours
// don't restart. With nobody left who may block it, it goes to a league vote.

const NEW_COMMISSIONER = "newcommissioner@example.com";
const BLOCK_IT = `Block the trade between ${TEAM_1} and ${TEAM_2}?`;
const TRADED = `${TEAM_1} and ${TEAM_2} traded`;

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
});

const nameCommissioner = async (email: string) =>
  (await actingAs(w.t, COMMISSIONER)).mutation(api.leagues.leagues.nameCommissioner, { leagueId: w.leagueId, email });
const nameCoCommissioner = async (email: string | null, by = COMMISSIONER) =>
  (await actingAs(w.t, by)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId: w.leagueId, email });
const offersTab = async (email: string) =>
  (await (await actingAs(w.t, email)).query(api.trades.tradeScreen.ofMyTeam, { leagueId: w.leagueId, now: Date.now() })).offers;

describe("when the league is handed to a new commissioner during a review", () => {
  test("the new commissioner gets the review letter, sees it in To review, and may Block it; the 24 hours don't restart", async () => {
    const offerId = await w.annTradesForSaka();
    const endsAt = Date.now() + REVIEW_MS;
    await nameCommissioner(NEW_COMMISSIONER);

    expect(await w.subjectsTo(NEW_COMMISSIONER)).toContain(BLOCK_IT);
    expect(await w.toReview(NEW_COMMISSIONER)).toEqual([expect.objectContaining({ offerId, yours: "block", reviewEndsAt: endsAt })]);
    for (const email of [ANN, BOB]) expect((await offersTab(email))[0]).toMatchObject({ reviewer: "commissioner", reviewEndsAt: endsAt });
    await w.block(NEW_COMMISSIONER, offerId);
    expect(await w.offers()).toEqual([]);
  });

  test("the old commissioner, still a manager, may no longer Block it", async () => {
    await noDraft(w.t, w.leagueId);
    await addManager(w.t, w.leagueId, COMMISSIONER);
    await draftStarted(w.t, w.leagueId, w.teams);
    const offerId = await w.annTradesForSaka();
    await nameCommissioner(NEW_COMMISSIONER);

    expect(await w.toReview(COMMISSIONER)).toEqual([]);
    await expectRefused(w.block(COMMISSIONER, offerId), reviewRefusals.notYourBlock);
  });

  test("a trade the new commissioner is in goes to the co-commissioner", async () => {
    await nameCoCommissioner(CO_COMMISSIONER);
    const offerId = await w.annTradesForSaka();
    await nameCommissioner(ANN);

    expect(await w.subjectsTo(CO_COMMISSIONER)).toContain(BLOCK_IT);
    expect((await offersTab(BOB))[0]).toMatchObject({ reviewer: "coCommissioner" });
    await w.block(CO_COMMISSIONER, offerId);
    expect(await w.offers()).toEqual([]);
  });
});

describe("a trade the commissioner is in, reviewed by the co-commissioner,", () => {
  let offerId: Awaited<ReturnType<TradeLeague["annTradesForSaka"]>>;
  beforeEach(async () => {
    await nameCoCommissioner(CO_COMMISSIONER);
    await nameCommissioner(ANN);
    offerId = await w.annTradesForSaka();
  });

  test("goes to the new co-commissioner when he is replaced", async () => {
    await nameCoCommissioner(CAT, ANN);

    expect(await w.subjectsTo(CAT)).toContain(BLOCK_IT);
    await w.block(CAT, offerId);
    expect(await w.offers()).toEqual([]);
  });

  test("goes to a league vote when he is removed, ending when the review would have", async () => {
    const endsAt = Date.now() + REVIEW_MS;
    await nameCoCommissioner(null, ANN);

    expect(await w.subjectsTo(CAT)).toContain(`Vote on the trade between ${TEAM_1} and ${TEAM_2}`);
    expect(await w.toReview(CAT)).toEqual([expect.objectContaining({ offerId, yours: "against", reviewEndsAt: endsAt })]);
    expect((await offersTab(BOB))[0]).toMatchObject({ reviewer: "vote" });
  });

  // Today's behaviour, pinned until Craig answers the hand-on case (#1736): S08.15 names only a
  // trade accepted fresh, which goes through at once with nobody able to vote.
  test("goes to a vote nobody may cast when he is removed with the others on the auto team, and stays in review until the 24 hours are up", async () => {
    const endsAt = Date.now() + REVIEW_MS;
    await (await actingAs(w.t, CAT)).mutation(api.lineup.autoTeam.set, { leagueId: w.leagueId, teamId: w.catsTeam, on: true });
    await nameCoCommissioner(null, ANN);

    expect(await w.offers()).toEqual([
      expect.objectContaining({ _id: offerId, review: expect.objectContaining({ endsAt, reviewer: { kind: "vote", against: [] } }) }),
    ]);
    expect(await w.subjectsTo(ANN)).not.toContain(TRADED);
    await w.reviewEnds(offerId);
    expect(await w.offers()).toEqual([]);
    expect(await w.subjectsTo(ANN)).toContain(TRADED);
  });
});

test("a change that leaves the reviewer as he was files no new letter", async () => {
  await w.annTradesForSaka();
  await nameCoCommissioner(CO_COMMISSIONER);

  expect((await w.subjectsTo(COMMISSIONER)).filter((subject) => subject === BLOCK_IT)).toHaveLength(1);
  expect(await w.subjectsTo(CO_COMMISSIONER)).not.toContain(BLOCK_IT);
});
