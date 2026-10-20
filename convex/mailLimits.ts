// Mail's fixed limits, with no imports, so the screens can read them too.

/** How long a commissioner's letter may be (spec/16): its subject, and its text. */
export const SUBJECT_MAX = 100;
export const BODY_MAX = 2000;
/** The most unread letters the menu counts; past it, it shows this number and a "+". */
export const UNREAD_COUNTED = 99;
/** The most letters the Mail screen lists, newest first. */
export const LETTERS_SHOWN = 100;
