// What every screen's controls say alike: the buttons, glyphs and table heads many screens share.

/** Closes what was opened to change something, changing nothing. */
export const cancelWords = "Cancel";
/** The two answers to "Delete this?": deleting a league and the admin's feedback both ask it. */
export const confirmDeleteWords = { yes: "Delete it", no: "Keep it" };

/** The fixtures' stepper (src/ui/GameweekStepper.tsx): each arrow's label, and CM's arrows,
 *  decoration, as each button carries its label. */
export const previousGameweekLabel = "Previous gameweek";
export const nextGameweekLabel = "Next gameweek";
export const previousGlyph = "◄";
export const nextGlyph = "►";
/** Takes back what the manager put in: a claim, an offer, a patch. */
export const withdrawWords = "Withdraw";
/** Back to where a page was opened from: the player card's, the match page's (S10.9's picture). */
export const backWords = "Back";
/** A panel's or a window's cross, decoration, as its button carries its label. */
export const closeGlyph = "✕";
/** A control drawn as a button that opens a list of choices, decoration, as its label says it. */
export const menuGlyph = "▾";
/** A folding panel's mark, open or folded, decoration, as its button carries its label; the folded
 *  one also ends a link onwards ("Run the league ▸"). */
export const openGlyph = menuGlyph;
export const foldedGlyph = "▸";

/** A sortable table's heads (src/ui/ColumnHeads.tsx): beside the column sorted by, which way, as
 *  decoration, since the head says so to screen readers through aria-sort; and, for screen
 *  readers, what pressing a head does. */
export const ascendingGlyph = "▲";
export const descendingGlyph = "▼";
export const sortByLabel = (column: string) => `Sort by ${column}`;
/** The spoken name of anything showing short words with long ones on hover: the short words it
 *  shows, then its long ones, "GW, Gameweek", or the words once where they're the same, so a
 *  voice-control user can say the words they see (WCAG 2.5.3, label in name; decided 31 Oct 2026,
 *  #775; the Squad's next match, #790). */
export const shortThenLongName = ({ short, long }: { short: string; long: string }) => (short === long ? long : `${short}, ${long}`);
/** A column head's spoken name (src/ui/ColumnHeads.tsx). */
export const columnHeadName = shortThenLongName;
