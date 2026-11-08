// What My team's Tactics tab says (#14), in one place for Craig to change in the pull request.

import { andListWords } from "../../../convex/shared/moments";
import type { Area, Lane } from "../../../convex/lineup/pitch";
import type { Side } from "../../../convex/lineup/instructions";
import { AREA_WORDS, LANE_WORDS } from "../../../convex/lineup/pitchWords";
import { menuWords } from "../../frame/words";
import { failedWords, listSeparator, timeOfDayWords } from "../../shared/words";
import { gameweekShort } from "../header/words";
import { benchShort } from "../words";
import type { MoveRefusal } from "./lineupEdits";

export const TACTICS_TITLE = menuWords.tactics;
export const BENCH_TITLE = "Bench";

export const tacticsLoadingWords = "Loading your lineup…";
export const tacticsNoRulesWords = "This league was made before leagues had rules, so it has no deadline or area limits to set a lineup under.";
export const seasonOverWords = "Every gameweek has begun, so there's no lineup left to set this season.";

const positionsWords = (positions: readonly string[]) => positions.join(listSeparator);

/** The pitch's panel: its plate names the formation the eleven stand in, where it is a preset or a
 *  classic. */
export const pitchTitle = (formation: string | null) => (formation === null ? "Pitch" : `Pitch ${formation}`);
/** A classic once its manager has changed a role (spec/05; Craig, 6 Nov 2026). */
export const customWords = (classic: string) => `${classic} (custom)`;
/** The pitch, named for screen readers, and its cells. */
export const pitchLabel = "The pitch, attack at the top";
const cellWords = (area: Area, lane: Lane) => `${AREA_WORDS[area]}, ${LANE_WORDS[lane]}`;
/** A player the one picked up can swap with, lit on the pitch and in the squad (spec/05, Moving players). */
export const swapLabel = (name: string, other: string) => `Swap ${name} with ${other}`;
/** What a lit player's stars rate: the player who would land in that slot, on his role there (#11). */
export const landingSubject = (name: string, role: string) => `${name} as ${role}`;
export const playerOnPitchLabel = (name: string, positions: readonly string[], area: Area, lane: Lane) =>
  `${name}, ${positionsWords(positions)}, in ${cellWords(area, lane)}`;
export const emptySlotLabel = (area: Area, lane: Lane) => `Empty slot: ${cellWords(area, lane)}`;

/** The desk's switch for the roles' runs on the pitch (spec/05 Runs). */
export const runsWords = "Runs";

/** For screen readers, what is in hand: nobody, or the player picked up. */
export const pickHintWords = "Pick a player, then Move.";
export const movingHintWords = (name: string, positions: readonly string[]) =>
  `Moving ${name} (${positionsWords(positions)}). Escape puts him back.`;

/** The toolbar over the pitch and the table (the approved Tactics picture). */
export const toolbarLabel = "Formation, presets and moves";
/** The Formation keys (spec/05, The pitch): the league's first presets, and the one in use. */
export const presetLabel = "Formation";
export const allFormationsWords = "All formations";
/** The two team instruction pickers, side by side where the one Team tactic was (spec/05; Craig,
 *  6 Nov 2026, on #990: "Attacking: Play out from the back", "Defending: Keep it tight early"). */
export const SIDE_WORDS: Record<Side, string> = { attacking: "Attacking", defensive: "Defending" };
export const instructionLabel = (side: Side) => `${SIDE_WORDS[side]} instruction`;
/** The right column's box (the picture's "4-2-3-1 unlocks"): what the formation offers on each
 *  side, the pick marked. */
export const instructionsTitle = (formation: string | null) => (formation === null ? "Team instructions" : `${formation} unlocks`);
export const pickedWords = "Picked";
export const presetsWords = "Presets";
export const savePresetWords = "Save preset…";
export const quickPickPlaceholder = "Quick Pick: fills the formation with the best eleven by stars, once it is built (#849)";

/** Back one move, through every move since the tab was opened (spec/05, Moving players). */
export const undoWords = "Undo";
/** When the lineup last saved, by the viewer's own clock (spec/05, Moving players). */
export const savedWords = (at: number) => `Lineup saved ${timeOfDayWords(at)}`;
export const saveFailedWords = failedWords("the lineup wasn't saved");
export const planSaveFailedWords = failedWords("the preset wasn't saved");
export const planDeleteFailedWords = failedWords("the preset wasn't deleted");
/** A plan loaded with roles the league no longer offers in their slot (Craig, 6 Nov 2026, #992). */
export const rolesLostWords = (name: string, lost: number) =>
  `${name}: ${lost === 1 ? "1 role is" : `${lost} roles are`} no longer allowed, so ${lost === 1 ? "that slot takes its player's" : "those slots take each player's"} best-star role.`;
/** Why a drop was refused, said in the line under the toolbar (spec/05, The pitch; Craig, 4 Nov
 *  2026): presets only, so the formation changes only by picking one. `nameOf` names a squad player. */
export function refusalWords(refusal: MoveRefusal, nameOf: (playerCode: number) => string): string {
  switch (refusal.kind) {
    case "emptyCell":
      return "Nobody moves into an empty cell: pick a formation instead.";
    case "offThePitch":
      return "A starter leaves the pitch only by swapping with a bench player.";
    case "goal":
      return "Only a keeper plays in goal, and a keeper plays only in goal.";
    case "doesNotPlay":
      return `${nameOf(refusal.playerCode)} doesn't play ${cellWords(refusal.cell.area, refusal.cell.lane).toLowerCase()}.`;
    case "areaLimits":
      return "That breaks the league's area limits.";
  }
}

/** The Selection table beside the pitch: the eleven, then the bench in order. */
export const SELECTION_TITLE = "Selection";
export const startingWords = (starting: number) => `${starting} starting`;
export const onTheBenchWords = (bench: number) => `${bench} on the bench`;
export const selectionTableLabel = "Your squad: the eleven, then the bench in order";
export const selectionColumns = {
  position: { short: "Pos", long: "The slot's position; on the bench, his place and his main position" },
  player: { short: "Player", long: "Player" },
  next: { short: "Next", long: "Next fixture" },
  roleFit: { short: "Role fit", long: "His stars for the role" },
  role: { short: "Role", long: "The role he plays in his slot" },
} as const;
/** Over the bench's Role column: the role each has the most stars for at his main position. */
export const BEST_ROLE_HEAD = "Best role";
/** A bench player's place in the bench order, by his index: "S1", the first on. */
export const benchPlaceWords = (index: number) => benchShort(index + 1);
export const benchPlaceLong = (index: number) => `Substitute ${index + 1}`;
/** A starter's role picker, for screen readers (spec/05 Roles). */
export const roleLabel = (name: string) => `${name}'s role`;
export const emptyBenchWords = "Nobody on the bench.";
/** What a row's stars rate, named on them: "Role fit 4 of 5" (plate.md, Marks: Stars). */
export const ROLE_FIT_SUBJECT = "Role fit";

/** The selected player's panel, on top of the right-hand column (plate.md, Tables and panels). */
export const startingWhereWords = (club: string | null, slot: string) => (club === null ? slot : `${club}, ${slot}`);
export const benchWhereWords = (club: string | null, index: number) => startingWhereWords(club, benchPlaceWords(index));
export const closeSelectedLabel = (name: string) => `Close ${name}'s panel`;
export const rolesHead = (slot: string) => `Role, ${slot} slot`;
export const pointsPerActionHead = "Points per action";
export const nowWords = "now";
export const pointsPerActionPlaceholder = (role: string) => `${role}: what it scores more and less for shows here once roles' scoring is on screen`;
export const teamTacticLinePlaceholder = "What the team instructions score for him shows here once they are scored";
export const playsHead = "Plays";
export const nextThreeHead = "Next 3";
export const lastFiveHead = "Last 5 in role";
export const lastFivePlaceholder = "His points in the role in one of his last five gameweeks: not held yet";
export const pointsHead = "Points";
export const lastShort = "Last";
export const seasonShort = "Season";
export const moveWords = "Move";
export const movingWords = "Moving";
export const moveLabel = (name: string) => `Move ${name}`;
/** A bench player's buttons for the bench order (spec/05 Auto-subs), and what each says. */
export const upWords = "Up";
export const downWords = "Down";
export const upLabel = (name: string) => `Move ${name} up the bench`;
export const downLabel = (name: string) => `Move ${name} down the bench`;
export const playerCardLabel = (name: string) => `${name}'s player card`;

/** The left column's widget under the pitch, and the right column's. */
/** The mark after a player's name while one of his positions is at stake (#23; Craig, 6 Nov 2026),
 *  read on hover and by screen readers. */
export const flaggedMarkLabel = (position: string, startsElsewhere: number) => `Flagged at ${position}: ${startsElsewhere} starts in a row elsewhere`;
export const outOfPositionMarkLabel = (position: string) => `Out of position: no longer plays ${position}`;
export const LINEUP_CHECK_TITLE = "Lineup check";
/** A line of the lineup check for each starter out of position (#23; Craig, 6 Nov 2026). */
export const outOfPositionLineWords = (position: string) => `: out of position at ${position}`;
export const lineupCheckPlaceholder = "Lineup check: who is doubtful, booked, injured or suspended shows here once the status chips' data is settled";
export const opponentTitle = (gameweek: number) => `${gameweekShort(gameweek)} opponent`;

/** Who joined the squad since the lineup was saved. */
export const joinedBenchWords = (names: readonly string[]) => `${andListWords(names)} joined your squad and sit${names.length === 1 ? "s" : ""} at the end of the bench.`;
