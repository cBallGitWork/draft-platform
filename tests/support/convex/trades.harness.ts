// The trade tests' shared league (#383), waivers.harness.ts's: Ann, Bob and Cat each manage a
// team, the rest have none; Ann holds the 4-4-2 squad, Bob holds Saka and Palmer, Cat holds Rice;
// gameweek 4 is over and gameweek 5 still to come. Trades are reviewed by a commissioner veto, a
// new league's (Craig, 6 Nov 2026), unless a test says.

import { vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { TradeRules } from "../../../convex/rules/leagueRulesShape";
import { REVIEW_MS } from "../../../convex/trades/tradeLimits";
import { changeEveryRules, rulesRevision } from "./leagueRules.harness";
import { pendingJobs } from "./test.harness";
import { actingAs, COMMISSIONER, type TestConvex } from "./leagues.harness";
import { pickGapPasses } from "./pickWindow.harness";
import { ANN, ANNS_FIRST_DROP, BOB, CAT, PALMER, RICE, SAKA, waiverLeague } from "./waivers.harness";

export { ANN, ANNS_FIRST_DROP, BOB, CAT, PALMER, RICE, SAKA };

/** `teamId`'s pick in `round`, as a pick trade names it. */
export const pickOf = (teamId: Id<"teams">, round: number) => ({ round, teamId });

/** The pick trade tests' steps (#1096, #1457) in the league `current` gives, read at each call, as
 *  each test makes its own in `beforeEach`. */
export function pickTradeSteps(current: () => { t: TestConvex; leagueId: Id<"leagues"> }) {
  const as = (email: string) => actingAs(current().t, email);
  return {
    as,
    /** The commissioner starts the league's draft. */
    start: async () => (await as(COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId: current().leagueId }),
    /** The pick on the clock and the team making it, or null once the draft isn't live. */
    onTheClock: async () => {
      const draft = await (await as(COMMISSIONER)).query(api.draft.draftStart.ofLeague, { leagueId: current().leagueId });
      return draft.status === "live" ? { pick: draft.onTheClock.pick, teamId: draft.onTheClock.teamId } : null;
    },
    /** `email` picks, and the pick's 10 seconds to undo it pass. */
    makePick: async (email: string, playerCode: number) => {
      const { t, leagueId } = current();
      await (await as(email)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode });
      await pickGapPasses(t);
    },
    teamName: async (teamId: Id<"teams">) => (await current().t.run((ctx) => ctx.db.get("teams", teamId)))!.name,
  };
}

export async function tradeLeague() {
  const w = await waiverLeague();
  const { t, leagueId } = w;
  // waiverLeague holds the three players already, so only their places are written.
  await t.run(async (ctx) => {
    for (const playerCode of [SAKA, PALMER]) await ctx.db.insert("squadPlayers", { leagueId, teamId: w.bobsTeam, playerCode });
    await ctx.db.insert("squadPlayers", { leagueId, teamId: w.catsTeam, playerCode: RICE });
  });

  const offers = () => t.run((ctx) => ctx.db.query("tradeOffers").collect());
  /** `email`'s team offers `toTeamId` `gives` for `gets`. */
  const offer = async (email: string, toTeamId: Id<"teams">, gives: number[], gets: number[], note: string | null = null) =>
    (await actingAs(t, email)).mutation(api.trades.tradeOffers.offer, { leagueId, toTeamId, gives, gets, note });
  const accept = async (email: string, offerId: Id<"tradeOffers">) => (await actingAs(t, email)).mutation(api.trades.tradeOffers.accept, { leagueId, offerId });
  return {
    ...w,
    offer,
    accept,
    /** Ann's first drop for Bob's Saka, with `note`, accepted by Bob. The offer's id. */
    annTradesForSaka: async (note: string | null = null) => {
      const { offerId } = await offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA], note);
      await accept(BOB, offerId);
      return offerId;
    },
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
    /** The commissioner changes the trade rules in League settings now: from the next gameweek. */
    tradesChange: async (trades: TradeRules) => {
      const commissioner = await actingAs(t, COMMISSIONER);
      const settings = (await commissioner.query(api.rules.leagueSettings.settings, { leagueId, now: Date.now() }))!.part;
      return commissioner.mutation(api.rules.leagueSettings.changeSettings, { leagueId, settings: { ...settings, trades }, revision: await rulesRevision(t, leagueId) });
    },
    /** The review's 24 hours pass and its timer fires, as the scheduler fires it. */
    reviewEnds: async (offerId: Id<"tradeOffers">) => {
      vi.setSystemTime(Date.now() + REVIEW_MS);
      await t.mutation(internal.trades.tradeReview.finish, { offerId });
    },
    /** The cron's check of open offers, now, and each league's closing it asks for, run as the
     *  scheduler runs them. The clock is set, never advanced, so no other timer fires. */
    closeDue: async () => {
      const asked = new Set((await pendingJobs(t, internal.trades.tradeClose.closeLeagueDue)).map(({ _id }) => _id));
      await t.mutation(internal.trades.tradeClose.closeDue, {});
      for (const job of await pendingJobs(t, internal.trades.tradeClose.closeLeagueDue)) {
        if (asked.has(job._id)) continue;
        await t.mutation(internal.trades.tradeClose.closeLeagueDue, job.args[0] as { leagueId: Id<"leagues"> });
      }
    },
    subjectsTo: async (email: string) => (await w.lettersTo(email)).map(({ subject }) => subject),
  };
}
export type TradeLeague = Awaited<ReturnType<typeof tradeLeague>>;
