// What the formation window says (the approved formation window), in one place for Craig to change
// in the pull request.

export const WINDOW_TITLE = "Formation and presets";
export const inUseNowWords = "In use now";
export const closeWindowLabel = "Close the formation window";
export const groupsLabel = "Groups";
export const YOUR_PRESETS = "Your presets";
export const yourPresetsLine = "a formation and every slot's role, never players";
export const FORMATIONS_HEAD = "Formations";
export const backGroupWords = (back: number) => `Back ${back}`;
export const CLASSICS = "Classics";
export const classicsLine = "famous sides, formation and roles";
export const MODERN = "Modern";
export const toComeWords = "to come";
export const inUseWords = "In use";
export const applyWords = "Use this";
export const cancelWords = "Cancel";
export const appliesHead = "Applies";
export const unlocksHead = "Unlocks";
export const costsHead = "Costs";
/** What a plain formation does when used (spec/05, The pitch). */
export const appliesWords = (name: string) =>
  `The ${name}. Your players stay, each in a slot of his own area where there is one; anyone without a slot goes to the front of the bench. Each keeps his role where his new slot offers it.`;
export const previewLabel = (name: string) => `${name}: each slot's position and the role it would play`;

/** Data not held yet, in its place (plate.md, Marks: a placeholder). */
export const presetsPlaceholder = "Your saved presets show here once saving them is built: each a formation and every slot's role";
export const savePresetPlaceholder = "Save preset…: saves the formation and roles in use now, once saving presets is built";
export const classicsPlaceholder = "Classic sides, each a formation and all eleven roles, show here once Craig writes their text";
export const modernPlaceholder = "Modern sides show here once they are chosen";
export const unlocksPlaceholder = "The team tactic this formation unlocks shows here once team tactics are specced";
export const costsPlaceholder = "What this formation costs shows here once team tactics are specced";
