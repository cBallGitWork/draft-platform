import { beforeEach, expect, test } from "vitest";
import { offerRefusals } from "../../../convex/trades/tradeOffers";
import { expectRefused } from "../../support/convex/test.harness";
import { PALMER, RICE, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";
import { NEXT } from "../../support/convex/waivers.harness";
import { ANN, CAT } from "../../support/convex/leagues.harness";

// Trades follow the rules in force in the gameweek, never a change waiting for the next: trade
// review and the trade deadline are league rules, and a rule change applies from the next gameweek
// (spec/03, spec/08; #25, #1473).

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
});

const annsSquad = () => w.squadCodes(w.annsTeam);

test("a waiting change to no review leaves today's veto: a trade accepted now still waits for it", async () => {
  expect(await w.tradesChange({ review: "none", deadline: null })).toBe(NEXT);
  const offerId = await w.annTradesForSaka();

  expect(await annsSquad()).not.toContain(SAKA);
  expect((await w.mine(ANN))[0].reviewer).toBe("commissioner");
  await w.reviewEnds(offerId);
  expect(await annsSquad()).toContain(SAKA);
});

test("a waiting change to a vote sends no trade accepted now to one", async () => {
  await w.tradesAre({ review: "none", deadline: null });
  await w.tradesChange({ review: "vote", deadline: null });
  await w.annTradesForSaka();

  expect(await annsSquad()).toContain(SAKA);
  expect(await w.subjectsTo(CAT)).not.toContain("Vote on the trade between Team 1 and Team 2");
});

test("the change takes effect once its gameweek begins", async () => {
  await w.tradesChange({ review: "none", deadline: null });
  await w.gameweekEnds(NEXT);
  await w.annTradesForSaka();

  expect(await annsSquad()).toContain(SAKA);
});

test("a waiting trade deadline doesn't shut trades a gameweek early, and shuts them once in force", async () => {
  await w.gameweekEnds(NEXT);
  expect(await w.tradesChange({ review: "none", deadline: NEXT })).toBe(NEXT + 1);
  await w.offer(CAT, w.bobsTeam, [RICE], [PALMER]);
  expect(await w.offers()).toHaveLength(1);

  await w.gameweekEnds(NEXT + 1);
  await expectRefused(w.offer(CAT, w.bobsTeam, [RICE], [SAKA]), offerRefusals.tradeDeadline);
});
