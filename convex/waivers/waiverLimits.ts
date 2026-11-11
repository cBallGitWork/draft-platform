import { DAY_MS } from "../shared/time";

// Waivers' fixed numbers, pure, so the letters' and the screens' words read them rather than
// retype them (ARCHITECTURE.md, Where code lives, rule 2).

/** How long a dropped player is on waivers before a run can take him (spec/08: "at least 24
 *  hours"). Craig's answer, so a constant: no league setting holds it. */
export const WAIVER_MS = DAY_MS;

/** The most pending claims one team holds at once, so no team can pile up enough to stop the
 *  league's run (Craig, 11 Nov 2026, #1609: "300 pending claims"). Craig's answer, so a constant. */
export const CLAIMS_PER_TEAM_MOST = 300;
