// What the screens editing a league's rules say alike, in one place for Craig to change in the
// pull request.

import { gameweekWords } from "../shared/words";

export { gameweekWords };

/** Someone else saved the rules while these were being edited (Craig, 22 Oct 2026: warn). The
 *  server's refusal, naming them, replaces this once a save is tried. */
export const overtakenWords = "Someone else saved the league's rules after you started editing, so saving yours will be refused.";
export const loadLatestWords = "Load the latest rules, dropping your changes";

/** The save bar. */
export const appliesFromWords = "Changes apply from";
export const saveWords = "Save changes";
export const discardWords = "Discard changes";
export const unchangedWords = "Nothing changed yet.";
