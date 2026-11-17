import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { leagueDeadlines } from "../../../convex/gameweeks/leagueDeadlines";
import { clockHourOf } from "../../../convex/home/homeAt";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { offerCloses, tradeDeadlineInForce, tradesShut } from "../../../convex/trades/tradeShut";
import { tradesAt } from "../../../convex/trades/tradesAt";
import { actingAs, ANN, BOB } from "../../support/convex/leagues.harness";
import { setUsed } from "../../support/convex/leagueRules.harness";
import { ANNS_FIRST_DROP, SAKA, tradeLeague } from "../../support/convex/trades.harness";
import { NEXT } from "../../support/convex/waivers.harness";

// The Trades read by the hour (#2008): Trades asks for its read once an hour, never each minute,
// and judges it at its minute. Nothing a manager sees changes: at every minute, why trades are
// shut and when each offer closes are what the server worked out when the minute was in the
// query's arguments.

test("every minute of the hours around a deadline shows why trades are shut, each offer's closing and its reviewer from its hour's one read, as the server worked them out at that minute, whether the gameweek is under way or over (S08.9, spec/13)", async () => {
  const w = await tradeLeague();
  const caller = await actingAs(w.t, BOB);
  // Gameweek NEXT unplayed, and a change to a league vote and a trade deadline waiting for it, so
  // its deadline turns all three mid-hour.
  await setUsed(w.t, w.leagueId, NEXT, false);
  expect(await w.tradesChange({ review: "vote", deadline: NEXT })).toBe(NEXT);
  const { offerId } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA]);
  const deadline = await w.t.run(async (ctx) => (await leagueDeadlines(ctx, w.leagueId)).get(NEXT) ?? null);
  if (deadline === null) throw new Error("The trade league holds no deadline for its next gameweek");
  const hours = [...new Set([clockHourOf(deadline - MINUTE_MS), clockHourOf(deadline)])];
  /** Why trades are shut and when the offer closes at `now`, as the server worked them out before #2008. */
  const serverAt = (now: number) =>
    w.t.run(async (ctx) => {
      const league = (await ctx.db.get("leagues", w.leagueId))!;
      const offer = (await ctx.db.get("tradeOffers", offerId))!;
      const deadlines = await leagueDeadlines(ctx, w.leagueId);
      const closes = offerCloses(deadlines, offer.madeAt, await tradeDeadlineInForce(ctx, w.leagueId, deadlines, now));
      return { shut: await tradesShut(ctx, league, deadlines, now), closes };
    });
  const seen = { shut: new Set<string | null>(), reviewer: new Set<string | null>() };
  const compareEachMinute = async () => {
    for (const hour of hours) {
      const held = await caller.query(api.trades.tradeScreen.ofMyTeam, { leagueId: w.leagueId, hour });
      for (let now = hour; now < hour + HOUR_MS; now += MINUTE_MS) {
        const shown = tradesAt(held, now);
        const [offer] = shown.offers;
        expect({ shut: shown.shut, closes: offer.closes }, new Date(now).toISOString()).toEqual(await serverAt(now));
        seen.shut.add(shown.shut);
        seen.reviewer.add(offer.reviewer);
      }
    }
  };

  await compareEachMinute();
  await w.matchIs(NEXT, "fullTime");
  await compareEachMinute();
  // Each answer the deadline turns was judged: open, the unplayed gameweek's lock and the trade
  // deadline; and the veto in force before it, the vote after.
  expect(seen.shut).toEqual(new Set([null, "unusedGameweek", "tradeDeadline"]));
  expect(seen.reviewer).toEqual(new Set(["commissioner", "vote"]));
});
