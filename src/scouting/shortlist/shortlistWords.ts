// What the shortlist says, on Scouting and the player card, in one place for Craig to change in the
// pull request.

import { failedWords } from "../../shared/words";

export { freeAgentWords } from "../../shared/words";
export { goneWords } from "../../playerCard/words";

export const SHORTLIST_TITLE = "Shortlist";
export const loadingShortlistWords = "Loading your shortlist…";
export const emptyShortlistWords = "No one on your shortlist yet. Add a player from his card.";

/** The shortlist's list, for screen readers. */
export const shortlistListLabel = "Your shortlist";

/** The one action, on the shortlist and the player card. */
export const addToShortlistWords = "Add to shortlist";
export const removeFromShortlistWords = "Take off shortlist";
/** On a row of the shortlist, where the list already says what it is. */
export const takeOffWords = "Take off";
/** On the shortlist's Take off button, for screen readers: whom it takes off. */
export const removeNamedLabel = (name: string) => `Take ${name} off your shortlist`;
/** On the player card, beside the action: whether he is on it now. */
export const onShortlistWords = "On your shortlist.";

export const shortlistChangeFailedWords = failedWords("your shortlist didn't change");
