import { v, type Infer } from "convex/values";

// Why trades are shut, in words (tradeShut.ts judges when): pure, so the refusal (tradeOffers.ts)
// and the Trades screen's notice (src/trades/words.ts) read one sentence for one fact
// (ARCHITECTURE.md, Where code lives, rule 2).

/** Why no trade can be offered or accepted now, or null while trades are open. */
export const tradesShutReason = v.union(v.literal("draftLive"), v.literal("tradeDeadline"), v.literal("unusedGameweek"), v.null());

/** Why trades are shut, or null while they are open. */
export type TradesShut = Infer<typeof tradesShutReason>;

/** The sentence for each reason trades are shut. */
export const shutWords: Record<NonNullable<TradesShut>, string> = {
  draftLive: "Trades are shut while the draft is live.",
  tradeDeadline: "The league's trade deadline has passed.",
  unusedGameweek: "Trades are locked through a gameweek the league doesn't play.",
};
