import { DAY_MS } from "../shared/time";

// Waivers' fixed numbers, pure, so the letters' and the screens' words read them rather than
// retype them (ARCHITECTURE.md, Where code lives, rule 2).

/** How long a dropped player is on waivers before a run can take him (spec/08: "at least 24
 *  hours"). Craig's answer, so a constant: no league setting holds it. */
export const WAIVER_MS = DAY_MS;
