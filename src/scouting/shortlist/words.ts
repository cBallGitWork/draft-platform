// What the shortlist says, on Scouting and the player card, in one place for Craig to change in the
// pull request.

import { failedWords } from "../../shared/words";

export { noLongerInLeagueWords as goneWords } from "../../shared/words";

export const SHORTLIST_TITLE = "Shortlist";
export const loadingShortlistWords = "Loading your shortlist…";
export const emptyShortlistWords = "No one on your shortlist yet.";

/** The shortlist's list, for screen readers. */
export const shortlistListLabel = "Your shortlist";

/** The one action, on the shortlist and the player card. */
export const addToShortlistWords = "Add to shortlist";
export const removeFromShortlistWords = "Take off shortlist";
/** On a row of the shortlist, where the list already says what it is. */
export const takeOffWords = "Take off";
/** On the shortlist's Take off button, for screen readers: whom it takes off. */
export const removeNamedLabel = (name: string) => `Take ${name} off your shortlist`;
/** Feeding the draft queue from a row (spec/04; #1100), its label for screen readers, and what it did. */
export { addToQueueWords } from "../../shared/words";
export const addToQueueNamedLabel = (name: string) => `Add ${name} to your draft queue`;
export const queuedWords = (name: string) => `${name} is in your draft queue.`;
/** On the player card, beside the action: whether he is on it now. */
export const onShortlistWords = "On your shortlist.";

export const shortlistChangeFailedWords = failedWords("your shortlist didn't change");
