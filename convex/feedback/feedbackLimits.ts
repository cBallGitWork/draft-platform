// Feedback's fixed limits, with no imports, so the screens can read them too. FEEDBACK_MAX and
// FEEDBACK_SHOWN are Claude's choice, not yet Craig's; FEEDBACK_A_DAY is Craig's.

/** How long one piece of feedback may be. Long enough for a bug report with the steps that led to
 *  it (a letter to the league has the same room, mail/mailLimits.ts), short enough that the
 *  admin's list stays readable and no one message can grow a row without end. */
export const FEEDBACK_MAX = 2000;
/** The most pieces of feedback the admin's list shows, newest first; past it, the list says so. */
export const FEEDBACK_SHOWN = 100;
/** The most messages one person may send the admin in a day, counted over the last 24 hours (S15.7;
 *  Craig, 13 Nov 2026, on #395: "5 a day"). */
export const FEEDBACK_A_DAY = 5;
