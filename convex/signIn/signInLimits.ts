import { HOUR_MS, SECOND_MS } from "../shared/time";

// Sign-in's fixed numbers, pure, so the page's and the emails' words read them rather than retype
// them (ARCHITECTURE.md, Where code lives, rule 2); auth.ts hands the link's lifetime to Convex Auth.

/** spec/02: a link works once and lasts an hour. */
export const LINK_LIFETIME_MS = HOUR_MS;
/** The same in seconds, as Convex Auth's `maxAge` counts it. */
export const LINK_LIFETIME_S = LINK_LIFETIME_MS / SECOND_MS;
