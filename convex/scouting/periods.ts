// The periods Scouting's figures can be over (#1028, story 3; the approved picture's Period): the
// season, or the last 4 or 6 finished Premier League gameweeks (Craig, 9 Nov 2026, on #1028,
// answer 5). Only Convex's validators, so the screens share it; period.ts adds the totals up.

import { v, type Infer } from "convex/values";

export const period = v.union(v.literal("season"), v.literal("last4"), v.literal("last6"));
export type Period = Infer<typeof period>;

/** How many finished gameweeks each period other than the season counts. */
export const PERIOD_GAMEWEEKS = { last4: 4, last6: 6 } as const satisfies Record<Exclude<Period, "season">, number>;

/** Every period, in the picker's order. */
export const PERIODS: readonly Period[] = ["season", "last4", "last6"];
