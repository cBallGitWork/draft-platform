import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { actingAs, ANN, BOB, COMMISSIONER } from "../../support/convex/leagues.harness";
import { ANNS_FIRST_DROP, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";

// A trade letter's one link (S16.2; docs/design/approved/mail, The one link): a letter about an
// offer still to act on, made or in review, ends with a link opening that offer on Trades, as Mail
// reads it; a letter with nowhere to act has none.

let w: TradeLeague;
beforeEach(async () => {
  w = await tradeLeague();
});

/** The links on the letters `email` reads in Mail, newest first. */
const linksTo = async (email: string) => (await (await actingAs(w.t, email)).query(api.mail.mail.letters, { leagueId: w.leagueId })).map(({ subject, link }) => ({ subject, link }));

// The offer letter to its receiver and the commissioner's review letter: BG-205 (tests/convex/mail/needsYou.test.ts).
test("S16.2: an offer's letter links to the offer for the manager who made it too", async () => {
  const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
  expect((await linksTo(ANN))[0]?.link).toEqual({ offer: offerId });
});

test("S16.2: under a veto, both managers' accepted letter and the commissioner's review letter link to the trade in review", async () => {
  await w.tradesAre({ review: "veto", deadline: null });
  const offerId = await w.annTradesForSaka();
  for (const email of [ANN, BOB, COMMISSIONER]) expect((await linksTo(email))[0]?.link).toEqual({ offer: offerId });
});

test("S16.2: a letter with nowhere to act, such as the trade gone through, has no link", async () => {
  await w.tradesAre({ review: "none", deadline: null });
  await w.annTradesForSaka();
  expect((await linksTo(COMMISSIONER))[0]?.link).toBeNull();
});
