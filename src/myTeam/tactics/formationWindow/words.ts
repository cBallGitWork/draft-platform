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
export const classicsLine = "famous sides, shape and roles";
/** The marks on a group's heading, saying what in it is sample (the approved formation window). */
export const sampleNamesWords = "sample names";
export const samplePointsWords = "points lines: sample";
export const savePresetName = "Save preset…";
export const savePresetLine = "Saves the shape and roles in use now";
export const MODERN = "Modern";
export const toComeWords = "to come";
export const inUseWords = "In use";
export const applyWords = "Use this";
export const cancelWords = "Cancel";
export const appliesHead = "Applies";
export const gainsHead = "Gains";
export const losesHead = "Loses";
export const unlocksHead = "Unlocks";
export const costsHead = "Costs";
/** What a plain formation does when used (spec/05, The pitch). */
export const appliesWords = (name: string) =>
  `The ${name}. Your players stay, each in a slot of his own area where there is one; anyone without a slot goes to the front of the bench. Each keeps his role where his new slot offers it.`;
export const previewLabel = (name: string) => `${name}: each slot's position and the role it would play`;

/** Data not held yet, in its place (plate.md, Marks: a placeholder). */
export const presetsPlaceholder = "Your saved presets show here once saving them is built: each a formation and every slot's role";
export const savePresetPlaceholder = `${savePresetName}: saves the formation and roles in use now, once saving presets is built`;
export const subtitlePlaceholder = (name: string) => `${name}'s line shows here once Craig writes it`;
export const descriptionPlaceholder = (name: string) => `What ${name} does shows here once Craig writes it`;
export const gainsPlaceholder = "What this formation gains shows here once Craig writes it";
export const losesPlaceholder = "What this formation loses shows here once Craig writes it";
export const classicsPlaceholder = "Classic sides, each a formation and all eleven roles, show here once Craig writes their text";
export const modernPlaceholder = "Modern sides show here once they are chosen";
export const unlocksPlaceholder = "The team instructions this formation offers show here once they are built";
export const costsPlaceholder = "What this formation costs shows here once team instructions are built";
