// The lineup's fixed numbers, with only an import of the calendar's units, so the screens can read
// them too.

import { HOUR_MS } from "../shared/time";

/** How long before a gameweek's deadline Continue starts leading the manager to his Tactics tab
 *  (Craig, 1 Nov 2026: "24 hours"; spec/12). The site's to tune, not a league's rule. */
export const LINEUP_DUE_BEFORE_DEADLINE_MS = 24 * HOUR_MS;
