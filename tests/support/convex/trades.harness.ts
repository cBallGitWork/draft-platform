// The trade tests' shared league (#383), waivers.harness.ts's: Ann, Bob and Cat each manage a
// team, the rest have none; Ann holds the 4-4-2 squad, Bob holds Saka and Palmer, Cat holds Rice;
// gameweek 4 is over and gameweek 5 still to come. Trades are reviewed by a commissioner veto, a
// new league's (Craig, 6 Nov 2026), unless a test says.

import { vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { TradeRules } from "../../../convex/rules/leagueRulesShape";
import { REVIEW_MS } from "../../../convex/trades/tradeLimits";
import { changeEveryRules } from "./leagueRules.harness";
import { actingAs } from "./leagues.harness";
import { ANN, BOB, CAT, PALMER, RICE, SAKA, waiverLeague } from "./waivers.harness";

export { ANN, BOB, CAT, PALMER, RICE, SAKA };
export { ANNS_FIRST_DROP } from "./waivers.harness";

export async function tradeLeague() {
  const w = await waiverLeague();
  const { t, leagueId } = w;
  // waiverLeague holds the three players already, so only their places are written.
  await t.run(async (ctx) => {
    for (const playerCode of [SAKA, PALMER]) await ctx.db.insert("squadPlayers", { leagueId, teamId: w.bobsTeam, playerCode });
    await ctx.db.insert("squadPlayers", { leagueId, teamId: w.catsTeam, playerCode: RICE });
  });

  const offers = () => t.run((ctx) => ctx.db.query("tradeOffers").collect());
  return {
    ...w,
    /** `email`'s team offers `toTeamId` `gives` for `gets`. */
    offer: async (email: string, toTeamId: Id<"teams">, gives: number[], gets: number[], note: string | null = null) =>
      (await actingAs(t, email)).mutation(api.trades.tradeOffers.offer, { leagueId, toTeamId, gives, gets, note }),
    accept: async (email: string, offerId: Id<"tradeOffers">) => (await actingAs(t, email)).mutation(api.trades.tradeOffers.accept, { leagueId, offerId }),
    reject: async (email: string, offerId: Id<"tradeOffers">) => (await actingAs(t, email)).mutation(api.trades.tradeOffers.reject, { leagueId, offerId }),
    withdraw: async (email: string, offerId: Id<"tradeOffers">) => (await actingAs(t, email)).mutation(api.trades.tradeOffers.withdraw, { leagueId, offerId }),
    counter: async (email: string, offerId: Id<"tradeOffers">, gives: number[], gets: number[]) =>
      (await actingAs(t, email)).mutation(api.trades.tradeOffers.counter, { leagueId, offerId, gives, gets, note: null }),
    block: async (email: string, offerId: Id<"tradeOffers">) => (await actingAs(t, email)).mutation(api.trades.tradeReview.block, { leagueId, offerId }),
    against: async (email: string, offerId: Id<"tradeOffers">) => (await actingAs(t, email)).mutation(api.trades.tradeReview.against, { leagueId, offerId }),
    takeBack: async (email: string, offerId: Id<"tradeOffers">) => (await actingAs(t, email)).mutation(api.trades.tradeReview.takeBack, { leagueId, offerId }),
    /** The trades in review `email` reviews, as the Offers tab's To review group reads them. */
    toReview: async (email: string) => (await actingAs(t, email)).query(api.trades.reviewScreen.toReview, { leagueId }),
    mine: async (email: string) => (await actingAs(t, email)).query(api.trades.tradeOffers.mine, { leagueId }),
    offers,
    /** The league's trade rules, in force at once. */
    tradesAre: (trades: TradeRules) => changeEveryRules(t, leagueId, (rules) => ({ ...rules, trades })),
    /** The review's 24 hours pass and its timer fires, as the scheduler fires it. */
    reviewEnds: async (offerId: Id<"tradeOffers">) => {
      vi.setSystemTime(Date.now() + REVIEW_MS);
      await t.mutation(internal.trades.tradeReview.finish, { offerId });
    },
    /** The cron's check of open offers, now. */
    closeDue: () => t.mutation(internal.trades.tradeClose.closeDue, {}),
    subjectsTo: async (email: string) => (await w.lettersTo(email)).map(({ subject }) => subject),
  };
}
export type TradeLeague = Awaited<ReturnType<typeof tradeLeague>>;
