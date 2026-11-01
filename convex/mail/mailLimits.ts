// Mail's fixed limits, with no imports, so the screens can read them too. Each is Claude's choice,
// not yet Craig's.

/** How long a commissioner's letter (spec/16) may be: its subject, and its text. */
export const SUBJECT_MAX = 100;
export const BODY_MAX = 2000;
/** The most unread letters the menu counts; past it, it shows this number and a "+". */
export const UNREAD_COUNTED = 99;
/** The most letters the Mail screen lists, newest first. */
export const LETTERS_SHOWN = 100;
/** The most letters a screen's Mail widget shows, newest first (My team's Squad tab). */
export const LATEST_LETTERS = 3;
