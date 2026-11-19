// The Guide's fixed limits, with no imports, so the screens can read them too. Every figure is
// Claude's sizing, not yet Craig's: room for one page on how the game works (spec/23, S23.1).

/** How long a section's or an entry's title may be: a line down the left. */
export const GUIDE_TITLE_MAX = 60;
/** How long one entry's text may be: a few paragraphs of plain text (S23.9). */
export const GUIDE_TEXT_MAX = 5000;
/** The most sections the Guide holds. */
export const GUIDE_SECTIONS_MOST = 30;
/** The most entries one section holds. */
export const GUIDE_ENTRIES_MOST = 50;
