// What the formation window says (the approved formation window), in one place for Craig to change
// in the pull request.

export { cancelWords } from "../../../shared/words";
export { inUseWords, savePresetWords } from "../words";

export const WINDOW_TITLE = "Formation and presets";
export const inUseNowWords = "In use now";
export const closeWindowLabel = "Close the formation window";
export const groupsLabel = "Groups";
export const YOUR_PRESETS = "Your presets";
export const yourPresetsLine = "a formation and every slot's role, never players";
export const FORMATIONS_HEAD = "Formations";
export const backGroupWords = (back: number | string) => `Back ${back}`;
/** A back group's name as a lookup matches it: any group's, or one's ("Back 4"). */
export const backGroupPattern = (back: number | string = String.raw`\d`) => new RegExp(`^${backGroupWords(back)}`);
export const CLASSIC_FORMATIONS = "Classic formations";
export const classicFormationsLine = "famous sides, formation and roles";
/** The classic formations' text, Claude's until Craig rewrites it (spec/05, The pitch). */
export const sampleTextWords = "text: sample";
export const savePresetLine = "Saves the formation and roles in use now";
export const MODERN = "Modern";
export const toComeWords = "to come";
export const applyWords = "Use this";
export const appliesHead = "Applies";
export const gainsHead = "Gains";
export const losesHead = "Loses";
export const unlocksHead = "Unlocks";
export const costsHead = "Costs";
/** What a plain formation does when used (spec/05, The pitch). */
export const appliesWords = (name: string) =>
  `The ${name}. Your players stay, each in a slot of his own area where there is one; anyone without a slot goes to the front of the bench. Each keeps his role where his new slot offers it.`;
/** What a classic formation does when used (spec/05, The pitch; #991): its shape, roles and
 *  instructions. */
export const classicFormationAppliesWords = (formation: string) =>
  `The ${formation}, all eleven roles and both team instructions, like a preset. Your players stay; anyone without a slot goes to the bench. Change a role or an instruction and it becomes custom.`;
/** A classic formation's preview title after its name: "1988-89, Sacchi, 4-4-2". */
export const classicFormationTitleWords = (subtitle: string, formation: string) => `${subtitle}, ${formation}`;
export const previewLabel = (name: string) => `${name}: each slot's position and the role it would play`;

/** A saved plan (spec/05, Saved plans; Craig, 6 Nov 2026, #992): its preview's line, what loading
 *  it applies, one whose formation the league no longer has, and saving one. */
export const yourPresetWords = (formation: string) => `Your preset, ${formation}`;
export const appliesPlanWords = (formation: string) =>
  `The ${formation} and all eleven roles. Your players stay; anyone without a slot goes to the bench.`;
export const notAllowedWords = "no longer allowed";
export const deletePlanLabel = (name: string) => `Delete ${name}`;
export const planNameLabel = "Preset name";
export const saveWords = "Save";
export const replaceQuestion = (name: string) => `Replace '${name}'?`;
export const replaceWords = "Replace";
export const plansLoadingWords = "Loading your presets…";

/** Data not held yet, in its place (plate.md, Marks: a placeholder). */
export const subtitlePlaceholder = (name: string) => `${name}'s subtitle shows here once Craig writes it`;
export const descriptionPlaceholder = (name: string) => `What ${name} does shows here once Craig writes it`;
export const gainsPlaceholder = "What this formation gains shows here once Craig writes it";
export const losesPlaceholder = "What this formation loses shows here once Craig writes it";
export const modernPlaceholder = "Modern sides show here once they are chosen";
export const unlocksPlaceholder = "The team instructions this formation offers aren't shown here yet";
export const costsPlaceholder = "What this formation costs isn't shown here yet";
