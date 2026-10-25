// Feedback's fixed limits, with no imports, so the screens can read them too. Each is Claude's
// choice, not yet Craig's.

/** How long one piece of feedback may be. Long enough for a bug report with the steps that led to
 *  it (a letter to the league has the same room, mail/mailLimits.ts), short enough that the
 *  admin's list stays readable and no one message can grow a row without end. */
export const FEEDBACK_MAX = 2000;
/** The most pieces of feedback the admin's list shows, newest first; past it, the list says so. */
export const FEEDBACK_SHOWN = 100;
