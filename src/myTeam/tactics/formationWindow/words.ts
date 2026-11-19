// What the formation window says (the approved formation window), in one place for Craig to change
// in the pull request.

export { cancelWords } from "../../../shared/controls/words";
export { inUseWords, savePresetWords } from "../words";

export const WINDOW_TITLE = "Formation and presets";
export const inUseNowWords = "In use now";
export const closeWindowLabel = "Close the formation window";
export const groupsLabel = "Groups";
export const YOUR_PRESETS = "Your presets";
export const yourPresetsLine = "a formation and every position's role, never players";
export const FORMATIONS_HEAD = "Formations";
export const backGroupWords = (back: number | string) => `Back ${back}`;
/** A back group's name as a lookup matches it: any group's, or one's ("Back 4"). */
export const backGroupPattern = (back: number | string = String.raw`\d`) => new RegExp(`^${backGroupWords(back)}`);
export const CLASSIC_FORMATIONS = "Classic formations";
export const classicFormationsLine = "famous sides, formation and roles";
/** The classic formations' text, Claude's until Craig rewrites it (spec/05, The pitch). */
export const sampleTextWords = "Sample text";
export const savePresetLine = "Saves the formation and roles in use now";
export const MODERN = "Modern";
export const toComeWords = "to come";
export const applyWords = "Use this";
export const appliesHead = "Who";
export const gainsHead = "Plus";
export const losesHead = "Minus";
export const unlocksHead = "Instructions";
export const costsHead = "Costs";
/** What a plain formation does when used (spec/05, The pitch). */
export const appliesWords = (name: string) =>
  `The ${name}. Defenders stay in defence, midfielders in midfield and forwards in attack, where there's room. Anyone left over goes to the front of the bench. Each keeps his role if his new place in the formation has it.`;
/** What a classic formation does when used (spec/05, The pitch; #991): its shape, roles and
 *  instructions. */
export const classicFormationAppliesWords = (formation: string) =>
  `The ${formation}, with all eleven roles and both team instructions. Your players stay; anyone without a place in the XI goes to the bench. Change a role or an instruction and it becomes custom.`;
/** A classic formation's preview title after its name: "1988-89, Sacchi, 4-4-2". */
export const classicFormationTitleWords = (subtitle: string, formation: string) => `${subtitle}, ${formation}`;
export const previewLabel = (name: string) => `${name}, each position and its role`;

/** A saved plan (spec/05, Saved plans; Craig, 6 Nov 2026, #992): its preview's line, what loading
 *  it applies, one whose formation the league no longer has, and saving one. */
export const yourPresetWords = (formation: string) => `Your preset, ${formation}`;
export const appliesPlanWords = (formation: string) =>
  `The ${formation} and all eleven roles. Your players stay; anyone without a place in the XI goes to the bench.`;
export const notAllowedWords = "no longer allowed";
export const deletePlanLabel = (name: string) => `Delete ${name}`;
export const planNameLabel = "Preset name";
export const saveWords = "Save";
export const replaceQuestion = (name: string) => `Replace '${name}'?`;
export const replaceWords = "Replace";
export const plansLoadingWords = "Loading your presets…";

/** Data not held yet, in its place (plate.md, Marks: a placeholder). */
export const subtitlePlaceholder = (name: string) => `${name}'s subtitle: not written yet`;
export const descriptionPlaceholder = (name: string) => `What ${name} does: not written yet`;
export const gainsPlaceholder = "What this formation gains: not written yet";
export const losesPlaceholder = "What this formation loses: not written yet";
export const modernPlaceholder = "Modern sides show here once they are chosen";
export const unlocksPlaceholder = "The team instructions this formation offers aren't shown here yet";
export const costsPlaceholder = "What this formation costs isn't shown here yet";
