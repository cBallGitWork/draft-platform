import { DAY_MS } from "../shared/time";

// Trades' fixed numbers, pure, so the screens' words read them rather than retype them
// (ARCHITECTURE.md, Where code lives, rule 2): tradeReview.ts loads the server.

/** How long a review lasts (spec/08: "24 hours"). Craig's answer, so a constant. */
export const REVIEW_MS = DAY_MS;

/** The longest note an offer carries: Claude's sizing for "a one-line note". */
export const NOTE_MOST = 140;

/** The most open offers one team has made at once, so no team can pile up enough to stop the
 *  league's trades and waivers (Craig, 11 Nov 2026, #1609: "50 open offers"). Craig's answer, so a
 *  constant. */
export const OFFERS_PER_TEAM_MOST = 50;
