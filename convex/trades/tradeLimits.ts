import { DAY_MS } from "../shared/time";

// Trades' fixed numbers, pure, so the screens' words read them rather than retype them
// (ARCHITECTURE.md, Where code lives, rule 2): tradeReview.ts loads the server.

/** How long a review lasts (spec/08: "24 hours"). Craig's answer, so a constant. */
export const REVIEW_MS = DAY_MS;
