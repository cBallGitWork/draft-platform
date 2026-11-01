// What My team's Tactics tab says (#14), in one place for Craig to change in the pull request.

import { STARTER_COUNT } from "../../../convex/lineup/lineup";
import { andListWords } from "../../../convex/shared/moments";
import type { Area, Lane } from "../../../convex/lineup/pitch";
import { AREA_WORDS, LANE_WORDS } from "../../../convex/lineup/pitchWords";
import { menuWords } from "../../frame/words";
import { failedWords, gameweekWords, listSeparator } from "../../shared/words";

export const TACTICS_TITLE = menuWords.tactics;
export const SQUAD_PANEL_TITLE = menuWords.squad;
export const BENCH_TITLE = "Bench";

export const tacticsLoadingWords = "Loading your lineup…";
export const tacticsNoRulesWords = "This league was made before leagues had rules, so it has no deadline or area limits to set a lineup under.";
export const seasonOverWords = "Every gameweek has begun, so there's no lineup left to set this season.";

export const positionsWords = (positions: readonly string[]) => positions.join(listSeparator);
export const startingWords = (starting: number) => `${starting} of ${STARTER_COUNT} starting`;

/** The pitch, named for screen readers, and its cells. */
export const pitchLabel = "The pitch, attack at the top";
const cellWords = (area: Area, lane: Lane) => `${AREA_WORDS[area]}, ${LANE_WORDS[lane]}`;
export const putHereLabel = (name: string, area: Area, lane: Lane) => `Put ${name} in ${cellWords(area, lane)}`;
/** A player the one picked up can swap with, lit on the pitch and in the squad (spec/05, Moving players). */
export const swapLabel = (name: string, other: string) => `Swap ${name} with ${other}`;
export const swapWords = "Swap";
export const playerOnPitchLabel = (name: string, positions: readonly string[], area: Area, lane: Lane) =>
  `${name}, ${positionsWords(positions)}, in ${cellWords(area, lane)}`;

/** The preset picker (spec/05, The pitch), and a slot of the preset picked that is still empty. */
export const presetLabel = "Formation";
export const pickPresetWords = "Pick a preset…";
export const emptySlotLabel = (area: Area, lane: Lane) => `Empty slot: ${cellWords(area, lane)}`;

/** The desk's switch for the roles' runs on the pitch (spec/05 Runs). */
export const runsWords = "Runs";

/** What to do, under the pitch's plate: before a player is picked up, and while one is. */
export const pickHintWords = "Pick a player, then where he goes. Or drag him.";
export const movingHintWords = (name: string, positions: readonly string[]) =>
  `Moving ${name} (${positionsWords(positions)}). Escape puts him back.`;

/** The squad beside the pitch: the eleven, then the bench in order. */
export const squadTableLabel = "Your squad: the eleven, then the bench in order";
export const moveWords = "Move";
export const squadColumns = {
  position: { short: "Pos", long: "Positions" },
  player: { short: "Player", long: "Player" },
  role: { short: "Role", long: "The role he plays in his slot" },
  move: { short: moveWords, long: "Move him" },
} as const;
export const movingWords = "Moving";
export const moveLabel = (name: string) => `Move ${name}`;
export const toBenchWords = (name: string) => `Put ${name} on the bench`;
/** A starter's role picker, for screen readers (spec/05 Roles). */
export const roleLabel = (name: string) => `${name}'s role`;
/** A bench player's buttons for the bench order (spec/05 Auto-subs), and what each says. */
export const upWords = "Up";
export const downWords = "Down";
export const upLabel = (name: string) => `Move ${name} up the bench`;
export const downLabel = (name: string) => `Move ${name} down the bench`;
export const emptyBenchWords = "Nobody on the bench.";

/** Who joined the squad since the lineup was saved. */
export const joinedBenchWords = (names: readonly string[]) => `${andListWords(names)} joined your squad and sit${names.length === 1 ? "s" : ""} at the end of the bench.`;

/** Back one move, through every move since the tab was opened (spec/05, Moving players). */
export const undoWords = "Undo";
export const savedWords = (gameweek: number) => `Saved. It stands from ${gameweekWords(gameweek).toLowerCase()}.`;
export const saveFailedWords = failedWords("the lineup wasn't saved");
